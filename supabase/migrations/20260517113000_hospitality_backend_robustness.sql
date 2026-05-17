set check_function_bodies = off;

do $$
begin
  create type public.walkie_analysis_provider as enum ('deterministic', 'openai');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.voice_memo_analysis_status as enum ('pending', 'analyzed', 'failed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.privacy_sensitivity as enum ('low', 'medium', 'high');
exception when duplicate_object then null;
end $$;

alter table public.voice_note_memos
  add column if not exists analysis_provider public.walkie_analysis_provider not null default 'deterministic',
  add column if not exists analysis_model text,
  add column if not exists analysis_version text not null default 'guestpulse-v1',
  add column if not exists analysis_status public.voice_memo_analysis_status not null default 'analyzed',
  add column if not exists analysis_error text,
  add column if not exists transcription_model text,
  add column if not exists duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  add column if not exists transcribed_at timestamptz;

alter table public.guest_preferences
  add column if not exists privacy_sensitivity public.privacy_sensitivity not null default 'low',
  add column if not exists normalized_signal_key text,
  add column if not exists analysis_version text not null default 'guestpulse-v1',
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists review_note text;

update public.guest_preferences
set normalized_signal_key = coalesce(
      normalized_signal_key,
      dedupe_key,
      lower(regexp_replace(concat_ws('|', guest_id, category::text, label, detail), '[[:space:]]+', ' ', 'g'))
    ),
    last_seen_at = coalesce(last_seen_at, updated_at)
where normalized_signal_key is null;

alter table public.guest_preference_evidence
  add column if not exists confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column if not exists privacy_sensitivity public.privacy_sensitivity,
  add column if not exists analysis_version text;

create index if not exists voice_note_memos_property_analysis_idx
on public.voice_note_memos(property_id, analysis_status, created_at desc)
where archived_at is null;

create index if not exists guest_preferences_property_guest_last_seen_idx
on public.guest_preferences(property_id, guest_id, last_seen_at desc)
where status <> 'dismissed';

create unique index if not exists guest_preferences_property_guest_normalized_active_idx
on public.guest_preferences(property_id, guest_id, category, normalized_signal_key)
where normalized_signal_key is not null and status <> 'dismissed';

create index if not exists guest_preference_evidence_voice_memo_created_idx
on public.guest_preference_evidence(voice_note_memo_id, created_at desc)
where voice_note_memo_id is not null;

create or replace function private.current_staff_for_property(target_property_id text)
returns table(staff_id text, staff_name text, staff_role public.staff_role)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select staff.id, staff.name, memberships.role
  from public.staff_profiles staff
  join public.staff_property_memberships memberships on memberships.staff_id = staff.id
  where memberships.property_id = target_property_id
    and memberships.auth_user_id = (select auth.uid())
    and memberships.active
  order by staff.on_shift desc, staff.created_at asc
  limit 1;
$$;

create or replace function private.lead_role_for_category(target_category public.ticket_category)
returns public.staff_role
language sql
immutable
set search_path = public, pg_temp
as $$
  select case target_category
    when 'housekeeping' then 'housekeeping_lead'::public.staff_role
    when 'fnb' then 'fnb_captain'::public.staff_role
    when 'spa' then 'spa_supervisor'::public.staff_role
    when 'security' then 'security_lead'::public.staff_role
    when 'room' then 'front_desk'::public.staff_role
    else 'concierge'::public.staff_role
  end;
$$;

create or replace function private.bump_ticket_priority(target_priority public.ticket_priority)
returns public.ticket_priority
language sql
immutable
set search_path = public, pg_temp
as $$
  select case target_priority
    when 'low' then 'medium'::public.ticket_priority
    when 'medium' then 'high'::public.ticket_priority
    else 'urgent'::public.ticket_priority
  end;
$$;

create or replace function private.escalation_target(target_role public.staff_role)
returns public.staff_role
language sql
immutable
set search_path = public, pg_temp
as $$
  select case target_role
    when 'concierge' then 'front_desk'::public.staff_role
    when 'front_desk' then 'manager'::public.staff_role
    else 'manager'::public.staff_role
  end;
$$;

create or replace function public.save_walkie_voice_memo(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_property_id text := coalesce(p_payload->>'propertyId', '00000000-0000-4000-8000-000000000001');
  v_actor_id text;
  v_actor_name text;
  v_source public.voice_note_memo_source := coalesce(p_payload->>'source', 'unfiled')::public.voice_note_memo_source;
  v_status public.voice_note_memo_status := coalesce(p_payload->>'status', 'unfiled')::public.voice_note_memo_status;
  v_memo_id text := coalesce(p_payload->>'memoId', extensions.gen_random_uuid()::text);
  v_unfiled_id text := nullif(p_payload->>'noteId', '');
  v_ticket_id text := nullif(p_payload->>'ticketId', '');
  v_created_event_id text := nullif(p_payload->>'createdEventId', '');
  v_voice_event_id text := nullif(p_payload->>'voiceNoteEventId', '');
  v_guest_id text := nullif(p_payload->>'guestId', '');
  v_transcript text := p_payload->>'transcript';
  v_title text := coalesce(nullif(p_payload->>'title', ''), left(regexp_replace(coalesce(p_payload->>'transcript', ''), '[[:space:]]+', ' ', 'g'), 120));
  v_category public.ticket_category := coalesce(p_payload->>'category', 'guest_relations')::public.ticket_category;
  v_priority public.ticket_priority := coalesce(p_payload->>'priority', 'medium')::public.ticket_priority;
  v_route_confidence numeric := coalesce((p_payload->>'routeConfidence')::numeric, 0.5);
  v_preference_categories public.preference_category[] := '{}'::public.preference_category[];
  v_analysis_provider public.walkie_analysis_provider := coalesce(p_payload->>'analysisProvider', 'deterministic')::public.walkie_analysis_provider;
  v_analysis_model text := nullif(p_payload->>'analysisModel', '');
  v_analysis_version text := coalesce(nullif(p_payload->>'analysisVersion', ''), 'guestpulse-v1');
  v_analysis_status public.voice_memo_analysis_status := coalesce(p_payload->>'analysisStatus', 'analyzed')::public.voice_memo_analysis_status;
  v_analysis_error text := nullif(p_payload->>'analysisError', '');
  v_transcription_model text := nullif(p_payload->>'transcriptionModel', '');
  v_duration_seconds numeric := nullif(p_payload->>'durationSeconds', '')::numeric;
  v_transcribed_at timestamptz := nullif(p_payload->>'transcribedAt', '')::timestamptz;
  v_signal jsonb;
  v_signal_count integer := coalesce(jsonb_array_length(coalesce(p_payload->'signals', '[]'::jsonb)), 0);
  v_pref_id text;
  v_evidence_id text;
  v_pref_category public.preference_category;
  v_pref_label text;
  v_pref_detail text;
  v_pref_confidence numeric;
  v_pref_privacy public.privacy_sensitivity;
  v_normalized_signal_key text;
  v_assigned_to public.staff_role;
  v_preference_ids text[] := '{}';
  v_evidence_ids text[] := '{}';
begin
  if v_transcript is null or length(trim(v_transcript)) = 0 then
    raise exception 'Transcript is required';
  end if;

  if not private.is_property_member(v_property_id) then
    raise exception 'Not an active member of this property';
  end if;

  select staff_id, staff_name
  into v_actor_id, v_actor_name
  from private.current_staff_for_property(v_property_id);

  if v_actor_id is null then
    raise exception 'No active staff profile found for this property';
  end if;

  select coalesce(array_agg(value::public.preference_category), '{}'::public.preference_category[])
  into v_preference_categories
  from jsonb_array_elements_text(coalesce(p_payload->'preferenceCategories', '[]'::jsonb)) as value;

  v_assigned_to := private.lead_role_for_category(v_category);

  if v_source = 'unfiled' then
    v_unfiled_id := coalesce(v_unfiled_id, extensions.gen_random_uuid()::text);
    insert into public.unfiled_voice_notes (id, property_id, transcript, category, priority, created_by)
    values (v_unfiled_id, v_property_id, v_transcript, v_category, v_priority, v_actor_id)
    on conflict (id) do update
    set transcript = excluded.transcript,
        category = excluded.category,
        priority = excluded.priority;
  elsif v_source in ('new_ticket', 'filed_unfiled') then
    if v_guest_id is null then
      raise exception 'Guest is required to create a ticket from a voice memo';
    end if;
    if not exists (select 1 from public.guests where id = v_guest_id and property_id = v_property_id) then
      raise exception 'Guest is not part of this property';
    end if;

    v_ticket_id := coalesce(v_ticket_id, extensions.gen_random_uuid()::text);
    insert into public.tickets (id, property_id, guest_id, category, title, detail, priority, status, created_by, assigned_to_role)
    values (v_ticket_id, v_property_id, v_guest_id, v_category, v_title, v_transcript, v_priority, 'open', v_actor_id, v_assigned_to)
    on conflict (id) do nothing;

    v_created_event_id := coalesce(v_created_event_id, extensions.gen_random_uuid()::text);
    insert into public.ticket_events (id, property_id, ticket_id, type, actor_id, actor_name, body)
    values (v_created_event_id, v_property_id, v_ticket_id, 'created', v_actor_id, v_actor_name, v_transcript)
    on conflict (id) do nothing;
  else
    if v_ticket_id is null then
      raise exception 'Ticket is required to attach a voice memo';
    end if;
    select ticket.guest_id
    into v_guest_id
    from public.tickets ticket
    where ticket.id = v_ticket_id
      and ticket.property_id = v_property_id;

    if v_guest_id is null then
      raise exception 'Ticket is not part of this property';
    end if;
  end if;

  if v_ticket_id is not null then
    v_voice_event_id := coalesce(v_voice_event_id, extensions.gen_random_uuid()::text);
    insert into public.ticket_events (id, property_id, ticket_id, type, actor_id, actor_name, body)
    values (v_voice_event_id, v_property_id, v_ticket_id, 'voice_note', v_actor_id, v_actor_name, v_transcript)
    on conflict (id) do update
    set body = excluded.body;

    update public.tickets
    set updated_at = now()
    where id = v_ticket_id
      and property_id = v_property_id;
  end if;

  if v_source = 'filed_unfiled' and v_unfiled_id is not null then
    update public.unfiled_voice_notes
    set guest_id = v_guest_id,
        ticket_id = v_ticket_id,
        filed_by = v_actor_id,
        filed_at = now()
    where id = v_unfiled_id
      and property_id = v_property_id;
  end if;

  insert into public.voice_note_memos (
    id, property_id, guest_id, ticket_id, ticket_event_id, unfiled_voice_note_id,
    transcript, title, category, priority, status, source, route_confidence, signal_count,
    preference_categories, intelligence, analysis_provider, analysis_model, analysis_version,
    analysis_status, analysis_error, transcription_model, duration_seconds, transcribed_at,
    created_by, filed_by, filed_at
  )
  values (
    v_memo_id, v_property_id, v_guest_id, v_ticket_id, v_voice_event_id, v_unfiled_id,
    v_transcript, v_title, v_category, v_priority, v_status, v_source, v_route_confidence, v_signal_count,
    v_preference_categories, coalesce(p_payload->'intelligence', '{}'::jsonb), v_analysis_provider, v_analysis_model,
    v_analysis_version, v_analysis_status, v_analysis_error, v_transcription_model, v_duration_seconds, v_transcribed_at,
    v_actor_id, case when v_status in ('filed', 'attached') then v_actor_id else null end,
    case when v_status in ('filed', 'attached') then now() else null end
  )
  on conflict (id) do update
  set guest_id = excluded.guest_id,
      ticket_id = excluded.ticket_id,
      ticket_event_id = excluded.ticket_event_id,
      unfiled_voice_note_id = excluded.unfiled_voice_note_id,
      transcript = excluded.transcript,
      title = excluded.title,
      category = excluded.category,
      priority = excluded.priority,
      status = excluded.status,
      source = excluded.source,
      route_confidence = excluded.route_confidence,
      signal_count = excluded.signal_count,
      preference_categories = excluded.preference_categories,
      intelligence = excluded.intelligence,
      analysis_provider = excluded.analysis_provider,
      analysis_model = excluded.analysis_model,
      analysis_version = excluded.analysis_version,
      analysis_status = excluded.analysis_status,
      analysis_error = excluded.analysis_error,
      transcription_model = excluded.transcription_model,
      duration_seconds = excluded.duration_seconds,
      transcribed_at = excluded.transcribed_at,
      filed_by = excluded.filed_by,
      filed_at = excluded.filed_at,
      updated_at = now();

  if v_guest_id is not null then
    for v_signal in select * from jsonb_array_elements(coalesce(p_payload->'signals', '[]'::jsonb))
    loop
      v_pref_category := coalesce(v_signal->>'preferenceCategory', 'service')::public.preference_category;
      v_pref_label := coalesce(nullif(v_signal->>'label', ''), initcap(v_pref_category::text));
      v_pref_detail := coalesce(nullif(v_signal->>'detail', ''), nullif(v_signal->>'value', ''), v_pref_label);
      v_pref_confidence := coalesce((v_signal->>'confidence')::numeric, 0.5);
      v_pref_privacy := coalesce(v_signal->>'privacySensitivity', 'low')::public.privacy_sensitivity;
      v_normalized_signal_key := lower(regexp_replace(concat_ws('|', v_guest_id, v_pref_category::text, v_pref_label, v_pref_detail), '[[:space:]]+', ' ', 'g'));

      insert into public.guest_preferences (
        id, property_id, guest_id, category, label, detail, confidence, status, source_type,
        dedupe_key, normalized_signal_key, privacy_sensitivity, analysis_version, last_seen_at
      )
      values (
        coalesce(v_signal->>'preferenceId', extensions.gen_random_uuid()::text),
        v_property_id, v_guest_id, v_pref_category, v_pref_label, v_pref_detail, v_pref_confidence,
        'candidate', 'voice_note', v_normalized_signal_key, v_normalized_signal_key, v_pref_privacy,
        v_analysis_version, now()
      )
      on conflict (property_id, guest_id, dedupe_key) where dedupe_key is not null and status <> 'dismissed'
      do update
      set confidence = greatest(public.guest_preferences.confidence, excluded.confidence),
          detail = excluded.detail,
          privacy_sensitivity = excluded.privacy_sensitivity,
          analysis_version = excluded.analysis_version,
          normalized_signal_key = excluded.normalized_signal_key,
          last_seen_at = now(),
          updated_at = now()
      returning id into v_pref_id;

      if v_pref_id is null then
        select id
        into v_pref_id
        from public.guest_preferences
        where property_id = v_property_id
          and guest_id = v_guest_id
          and dedupe_key = v_normalized_signal_key
          and status <> 'dismissed'
        limit 1;
      end if;

      if v_pref_id is not null then
        v_preference_ids := array_append(v_preference_ids, v_pref_id);
        v_evidence_id := coalesce(v_signal->>'evidenceId', extensions.gen_random_uuid()::text);
        insert into public.guest_preference_evidence (
          id, property_id, preference_id, ticket_id, ticket_event_id, unfiled_voice_note_id,
          voice_note_memo_id, quote, confidence, privacy_sensitivity, analysis_version
        )
        values (
          v_evidence_id, v_property_id, v_pref_id, v_ticket_id, v_voice_event_id, v_unfiled_id,
          v_memo_id, coalesce(v_signal->>'evidence', v_transcript), v_pref_confidence, v_pref_privacy, v_analysis_version
        )
        on conflict (id) do nothing;
        v_evidence_ids := array_append(v_evidence_ids, v_evidence_id);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'memoId', v_memo_id,
    'noteId', v_unfiled_id,
    'ticketId', v_ticket_id,
    'ticketEventId', v_voice_event_id,
    'preferenceIds', to_jsonb(v_preference_ids),
    'evidenceIds', to_jsonb(v_evidence_ids),
    'status', v_status
  );
end;
$$;

grant execute on function public.save_walkie_voice_memo(jsonb) to authenticated;

create or replace function public.rosepulse_create_ticket(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_property_id text := coalesce(p_payload->>'propertyId', '00000000-0000-4000-8000-000000000001');
  v_actor_id text;
  v_actor_name text;
  v_ticket_id text := coalesce(p_payload->>'ticketId', extensions.gen_random_uuid()::text);
  v_event_id text := coalesce(p_payload->>'createdEventId', extensions.gen_random_uuid()::text);
  v_guest_id text := p_payload->>'guestId';
  v_category public.ticket_category := (p_payload->>'category')::public.ticket_category;
  v_priority public.ticket_priority := coalesce(p_payload->>'priority', 'medium')::public.ticket_priority;
  v_assigned_to public.staff_role := coalesce(nullif(p_payload->>'assignedTo', '')::public.staff_role, private.lead_role_for_category(v_category));
  v_due_at timestamptz := nullif(p_payload->>'dueAt', '')::timestamptz;
begin
  if not private.is_property_member(v_property_id) then
    raise exception 'Not an active member of this property';
  end if;
  if not exists (select 1 from public.guests where id = v_guest_id and property_id = v_property_id) then
    raise exception 'Guest is not part of this property';
  end if;

  select staff_id, staff_name into v_actor_id, v_actor_name from private.current_staff_for_property(v_property_id);
  if v_actor_id is null then
    raise exception 'No active staff profile found for this property';
  end if;

  insert into public.tickets (id, property_id, guest_id, category, title, detail, priority, status, created_by, assigned_to_role, due_at)
  values (
    v_ticket_id, v_property_id, v_guest_id, v_category, p_payload->>'title', p_payload->>'detail',
    v_priority, 'open', v_actor_id, v_assigned_to, v_due_at
  );

  insert into public.ticket_events (id, property_id, ticket_id, type, actor_id, actor_name, body)
  values (v_event_id, v_property_id, v_ticket_id, 'created', v_actor_id, v_actor_name, p_payload->>'detail');

  return jsonb_build_object('ticketId', v_ticket_id, 'eventId', v_event_id);
end;
$$;

create or replace function public.rosepulse_update_ticket_status(
  p_ticket_id text,
  p_status public.ticket_status,
  p_body text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_actor_id text;
  v_actor_name text;
  v_event_id text := extensions.gen_random_uuid()::text;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id;
  if v_ticket.id is null or not private.is_property_member(v_ticket.property_id) then
    raise exception 'Ticket not found for this property';
  end if;
  select staff_id, staff_name into v_actor_id, v_actor_name from private.current_staff_for_property(v_ticket.property_id);

  update public.tickets
  set status = p_status, updated_at = now()
  where id = p_ticket_id;

  insert into public.ticket_events (id, property_id, ticket_id, type, actor_id, actor_name, body, from_status, to_status)
  values (v_event_id, v_ticket.property_id, p_ticket_id, 'status_changed', v_actor_id, v_actor_name, coalesce(p_body, 'Status changed.'), v_ticket.status, p_status);

  return jsonb_build_object('ticketId', p_ticket_id, 'eventId', v_event_id);
end;
$$;

create or replace function public.rosepulse_escalate_ticket(p_ticket_id text, p_note text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_actor_id text;
  v_actor_name text;
  v_event_id text := extensions.gen_random_uuid()::text;
  v_target public.staff_role;
  v_priority public.ticket_priority;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id;
  if v_ticket.id is null or not private.is_property_member(v_ticket.property_id) then
    raise exception 'Ticket not found for this property';
  end if;
  select staff_id, staff_name into v_actor_id, v_actor_name from private.current_staff_for_property(v_ticket.property_id);
  v_target := private.escalation_target(coalesce(v_ticket.assigned_to_role, private.lead_role_for_category(v_ticket.category)));
  v_priority := private.bump_ticket_priority(v_ticket.priority);

  update public.tickets
  set status = 'escalated', priority = v_priority, updated_at = now()
  where id = p_ticket_id;

  insert into public.ticket_events (id, property_id, ticket_id, type, actor_id, actor_name, body, escalated_to)
  values (v_event_id, v_ticket.property_id, p_ticket_id, 'escalated', v_actor_id, v_actor_name, coalesce(p_note, 'Escalated for leadership attention.'), v_target);

  return jsonb_build_object('ticketId', p_ticket_id, 'eventId', v_event_id, 'priority', v_priority, 'escalatedTo', v_target);
end;
$$;

create or replace function public.rosepulse_add_ticket_comment(p_ticket_id text, p_body text)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_actor_id text;
  v_actor_name text;
  v_event_id text := extensions.gen_random_uuid()::text;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id;
  if v_ticket.id is null or not private.is_property_member(v_ticket.property_id) then
    raise exception 'Ticket not found for this property';
  end if;
  select staff_id, staff_name into v_actor_id, v_actor_name from private.current_staff_for_property(v_ticket.property_id);

  update public.tickets set updated_at = now() where id = p_ticket_id;
  insert into public.ticket_events (id, property_id, ticket_id, type, actor_id, actor_name, body)
  values (v_event_id, v_ticket.property_id, p_ticket_id, 'comment', v_actor_id, v_actor_name, p_body);
  return jsonb_build_object('ticketId', p_ticket_id, 'eventId', v_event_id);
end;
$$;

create or replace function public.rosepulse_assign_ticket(p_ticket_id text, p_assigned_to public.staff_role)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_actor_id text;
  v_actor_name text;
  v_event_id text := extensions.gen_random_uuid()::text;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id;
  if v_ticket.id is null or not private.is_property_member(v_ticket.property_id) then
    raise exception 'Ticket not found for this property';
  end if;
  select staff_id, staff_name into v_actor_id, v_actor_name from private.current_staff_for_property(v_ticket.property_id);

  update public.tickets set assigned_to_role = p_assigned_to, updated_at = now() where id = p_ticket_id;
  insert into public.ticket_events (id, property_id, ticket_id, type, actor_id, actor_name, body)
  values (v_event_id, v_ticket.property_id, p_ticket_id, 'assigned', v_actor_id, v_actor_name, concat('Assigned to ', p_assigned_to::text, '.'));
  return jsonb_build_object('ticketId', p_ticket_id, 'eventId', v_event_id);
end;
$$;

create or replace function public.rosepulse_set_ticket_priority(p_ticket_id text, p_priority public.ticket_priority)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id;
  if v_ticket.id is null or not private.is_property_member(v_ticket.property_id) then
    raise exception 'Ticket not found for this property';
  end if;

  update public.tickets set priority = p_priority, updated_at = now() where id = p_ticket_id;
  return jsonb_build_object('ticketId', p_ticket_id, 'priority', p_priority);
end;
$$;

create or replace function public.resolve_guest_preference(
  p_preference_id text,
  p_status public.preference_status,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_preference public.guest_preferences%rowtype;
  v_actor_id text;
begin
  if p_status not in ('confirmed', 'dismissed') then
    raise exception 'Preference can only be confirmed or dismissed';
  end if;

  select * into v_preference from public.guest_preferences where id = p_preference_id;
  if v_preference.id is null or not private.is_property_manager(v_preference.property_id) then
    raise exception 'Only property managers can resolve preference candidates';
  end if;

  select staff_id into v_actor_id from private.current_staff_for_property(v_preference.property_id);

  update public.guest_preferences
  set status = p_status,
      review_note = p_note,
      resolved_by = v_actor_id,
      resolved_at = now(),
      updated_at = now()
  where id = p_preference_id;

  insert into public.audit_log (property_id, actor_id, action, entity_table, entity_id, before, after)
  values (
    v_preference.property_id,
    v_actor_id,
    'resolve_guest_preference',
    'guest_preferences',
    p_preference_id,
    to_jsonb(v_preference),
    jsonb_build_object('status', p_status, 'reviewNote', p_note)
  );

  return jsonb_build_object('preferenceId', p_preference_id, 'status', p_status);
end;
$$;

grant execute on function public.rosepulse_create_ticket(jsonb) to authenticated;
grant execute on function public.rosepulse_update_ticket_status(text, public.ticket_status, text) to authenticated;
grant execute on function public.rosepulse_escalate_ticket(text, text) to authenticated;
grant execute on function public.rosepulse_add_ticket_comment(text, text) to authenticated;
grant execute on function public.rosepulse_assign_ticket(text, public.staff_role) to authenticated;
grant execute on function public.rosepulse_set_ticket_priority(text, public.ticket_priority) to authenticated;
grant execute on function public.resolve_guest_preference(text, public.preference_status, text) to authenticated;

set check_function_bodies = off;

do $$
begin
  create type public.voice_note_memo_status as enum ('unfiled', 'filed', 'attached', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.voice_note_memo_source as enum ('unfiled', 'new_ticket', 'ticket_attachment', 'filed_unfiled');
exception when duplicate_object then null;
end $$;

create table if not exists public.voice_note_memos (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  guest_id text references public.guests(id) on delete set null,
  ticket_id text references public.tickets(id) on delete set null,
  ticket_event_id text references public.ticket_events(id) on delete set null,
  unfiled_voice_note_id text references public.unfiled_voice_notes(id) on delete set null,
  transcript text not null,
  title text not null check (char_length(title) <= 160),
  category public.ticket_category not null default 'guest_relations',
  priority public.ticket_priority not null default 'medium',
  status public.voice_note_memo_status not null default 'unfiled',
  source public.voice_note_memo_source not null default 'unfiled',
  route_confidence numeric not null default 0.5 check (route_confidence >= 0 and route_confidence <= 1),
  signal_count integer not null default 0 check (signal_count >= 0),
  preference_categories public.preference_category[] not null default '{}'::public.preference_category[],
  intelligence jsonb not null default '{}'::jsonb,
  created_by text references public.staff_profiles(id) on delete set null,
  filed_by text references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  filed_at timestamptz,
  archived_at timestamptz
);

alter table public.guest_preferences
  add column if not exists dedupe_key text;

update public.guest_preferences
set dedupe_key = lower(regexp_replace(concat_ws('|', guest_id, category::text, label, detail), '[[:space:]]+', ' ', 'g'))
where dedupe_key is null;

alter table public.guest_preference_evidence
  add column if not exists voice_note_memo_id text references public.voice_note_memos(id) on delete set null;

create index if not exists voice_note_memos_property_created_idx
on public.voice_note_memos(property_id, created_at desc)
where archived_at is null;

create index if not exists voice_note_memos_property_category_idx
on public.voice_note_memos(property_id, category, created_at desc)
where archived_at is null;

create index if not exists voice_note_memos_property_status_idx
on public.voice_note_memos(property_id, status, created_at desc)
where archived_at is null;

create index if not exists voice_note_memos_property_guest_idx
on public.voice_note_memos(property_id, guest_id, created_at desc)
where guest_id is not null and archived_at is null;

create index if not exists voice_note_memos_property_ticket_idx
on public.voice_note_memos(property_id, ticket_id, created_at desc)
where ticket_id is not null and archived_at is null;

create index if not exists voice_note_memos_property_unfiled_idx
on public.voice_note_memos(property_id, created_at desc)
where status = 'unfiled' and archived_at is null;

create unique index if not exists guest_preferences_property_guest_dedupe_active_idx
on public.guest_preferences(property_id, guest_id, dedupe_key)
where dedupe_key is not null and status <> 'dismissed';

create index if not exists guest_preference_evidence_property_voice_memo_idx
on public.guest_preference_evidence(property_id, voice_note_memo_id)
where voice_note_memo_id is not null;

drop trigger if exists voice_note_memos_set_updated_at on public.voice_note_memos;
create trigger voice_note_memos_set_updated_at
before update on public.voice_note_memos
for each row execute function private.set_updated_at();

alter table public.voice_note_memos enable row level security;

drop policy if exists "Members read voice note memos" on public.voice_note_memos;
create policy "Members read voice note memos"
on public.voice_note_memos for select to authenticated
using (private.is_property_member(property_id));

drop policy if exists "Members insert voice note memos" on public.voice_note_memos;
create policy "Members insert voice note memos"
on public.voice_note_memos for insert to authenticated
with check (private.is_property_member(property_id));

drop policy if exists "Members update voice note memos" on public.voice_note_memos;
create policy "Members update voice note memos"
on public.voice_note_memos for update to authenticated
using (private.is_property_member(property_id))
with check (private.is_property_member(property_id));

grant select, insert, update on public.voice_note_memos to authenticated;

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
  v_signal jsonb;
  v_signal_count integer := coalesce(jsonb_array_length(coalesce(p_payload->'signals', '[]'::jsonb)), 0);
  v_pref_id text;
  v_pref_category public.preference_category;
  v_pref_label text;
  v_pref_detail text;
  v_pref_confidence numeric;
  v_dedupe_key text;
  v_assigned_to public.staff_role;
begin
  if v_transcript is null or length(trim(v_transcript)) = 0 then
    raise exception 'Transcript is required';
  end if;

  if not private.is_property_member(v_property_id) then
    raise exception 'Not an active member of this property';
  end if;

  select staff.id, staff.name
  into v_actor_id, v_actor_name
  from public.staff_profiles staff
  join public.staff_property_memberships memberships on memberships.staff_id = staff.id
  where memberships.property_id = v_property_id
    and memberships.auth_user_id = (select auth.uid())
    and memberships.active
  limit 1;

  v_actor_name := coalesce(v_actor_name, 'RosePulse staff');

  select coalesce(array_agg(value::public.preference_category), '{}'::public.preference_category[])
  into v_preference_categories
  from jsonb_array_elements_text(coalesce(p_payload->'preferenceCategories', '[]'::jsonb)) as value;

  v_assigned_to := case v_category
    when 'housekeeping' then 'housekeeping_lead'::public.staff_role
    when 'fnb' then 'fnb_captain'::public.staff_role
    when 'spa' then 'spa_supervisor'::public.staff_role
    when 'security' then 'security_lead'::public.staff_role
    when 'room' then 'front_desk'::public.staff_role
    else 'concierge'::public.staff_role
  end;

  if v_source = 'unfiled' then
    v_unfiled_id := coalesce(v_unfiled_id, extensions.gen_random_uuid()::text);
    insert into public.unfiled_voice_notes (
      id, property_id, transcript, category, priority, created_by
    )
    values (
      v_unfiled_id, v_property_id, v_transcript, v_category, v_priority, v_actor_id
    )
    on conflict (id) do update
    set transcript = excluded.transcript,
        category = excluded.category,
        priority = excluded.priority;
  elsif v_source in ('new_ticket', 'filed_unfiled') then
    if v_guest_id is null then
      raise exception 'Guest is required to create a ticket from a voice memo';
    end if;
    v_ticket_id := coalesce(v_ticket_id, extensions.gen_random_uuid()::text);
    insert into public.tickets (
      id, property_id, guest_id, category, title, detail, priority, status, created_by, assigned_to_role
    )
    values (
      v_ticket_id, v_property_id, v_guest_id, v_category, v_title, v_transcript, v_priority, 'open', v_actor_id, v_assigned_to
    )
    on conflict (id) do nothing;

    v_created_event_id := coalesce(v_created_event_id, extensions.gen_random_uuid()::text);
    insert into public.ticket_events (
      id, property_id, ticket_id, type, actor_id, actor_name, body
    )
    values (
      v_created_event_id, v_property_id, v_ticket_id, 'created', v_actor_id, v_actor_name, v_transcript
    )
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
  end if;

  if v_ticket_id is not null then
    v_voice_event_id := coalesce(v_voice_event_id, extensions.gen_random_uuid()::text);
    insert into public.ticket_events (
      id, property_id, ticket_id, type, actor_id, actor_name, body
    )
    values (
      v_voice_event_id, v_property_id, v_ticket_id, 'voice_note', v_actor_id, v_actor_name, v_transcript
    )
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
    id,
    property_id,
    guest_id,
    ticket_id,
    ticket_event_id,
    unfiled_voice_note_id,
    transcript,
    title,
    category,
    priority,
    status,
    source,
    route_confidence,
    signal_count,
    preference_categories,
    intelligence,
    created_by,
    filed_by,
    filed_at
  )
  values (
    v_memo_id,
    v_property_id,
    v_guest_id,
    v_ticket_id,
    v_voice_event_id,
    v_unfiled_id,
    v_transcript,
    v_title,
    v_category,
    v_priority,
    v_status,
    v_source,
    v_route_confidence,
    v_signal_count,
    v_preference_categories,
    coalesce(p_payload->'intelligence', '{}'::jsonb),
    v_actor_id,
    case when v_status in ('filed', 'attached') then v_actor_id else null end,
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
      v_dedupe_key := lower(regexp_replace(concat_ws('|', v_guest_id, v_pref_category::text, v_pref_label, v_pref_detail), '[[:space:]]+', ' ', 'g'));

      insert into public.guest_preferences (
        id,
        property_id,
        guest_id,
        category,
        label,
        detail,
        confidence,
        status,
        source_type,
        dedupe_key
      )
      values (
        coalesce(v_signal->>'preferenceId', extensions.gen_random_uuid()::text),
        v_property_id,
        v_guest_id,
        v_pref_category,
        v_pref_label,
        v_pref_detail,
        v_pref_confidence,
        'candidate',
        'voice_note',
        v_dedupe_key
      )
      on conflict (property_id, guest_id, dedupe_key) where dedupe_key is not null and status <> 'dismissed'
      do nothing
      returning id into v_pref_id;

      if v_pref_id is null then
        select id
        into v_pref_id
        from public.guest_preferences
        where property_id = v_property_id
          and guest_id = v_guest_id
          and dedupe_key = v_dedupe_key
          and status <> 'dismissed'
        limit 1;
      end if;

      if v_pref_id is not null then
        insert into public.guest_preference_evidence (
          id,
          property_id,
          preference_id,
          ticket_id,
          ticket_event_id,
          unfiled_voice_note_id,
          voice_note_memo_id,
          quote
        )
        values (
          coalesce(v_signal->>'evidenceId', extensions.gen_random_uuid()::text),
          v_property_id,
          v_pref_id,
          v_ticket_id,
          v_voice_event_id,
          v_unfiled_id,
          v_memo_id,
          coalesce(v_signal->>'evidence', v_transcript)
        )
        on conflict (id) do nothing;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'memoId', v_memo_id,
    'noteId', v_unfiled_id,
    'ticketId', v_ticket_id,
    'ticketEventId', v_voice_event_id,
    'status', v_status
  );
end;
$$;

grant execute on function public.save_walkie_voice_memo(jsonb) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.voice_note_memos;
exception when duplicate_object then null;
end $$;

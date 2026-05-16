set check_function_bodies = off;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create schema if not exists private;

do $$
begin
  create type public.staff_role as enum (
    'concierge',
    'front_desk',
    'housekeeping_lead',
    'fnb_captain',
    'spa_supervisor',
    'security_lead',
    'manager'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.guest_status as enum (
    'arriving_today',
    'checked_in',
    'in_house',
    'departing_today',
    'upcoming',
    'checked_out'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.loyalty_tier as enum ('Standard', 'Silver', 'Gold', 'Platinum', 'Founder');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.guest_occasion as enum ('anniversary', 'birthday', 'honeymoon', 'business', 'leisure');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.ticket_category as enum ('guest_relations', 'room', 'housekeeping', 'security', 'fnb', 'spa');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.ticket_status as enum ('open', 'in_progress', 'blocked', 'resolved', 'escalated');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.ticket_event_type as enum ('created', 'status_changed', 'escalated', 'comment', 'voice_note', 'assigned');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.preference_category as enum ('dining', 'room', 'wellness', 'service', 'accessibility', 'security', 'occasion');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.preference_status as enum ('candidate', 'confirmed', 'dismissed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.preference_source_type as enum ('tag', 'note', 'ticket', 'voice_note', 'staff');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.recommendation_status as enum ('pending', 'accepted', 'dismissed');
exception when duplicate_object then null;
end $$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.properties (
  id text primary key default extensions.gen_random_uuid()::text,
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Los_Angeles',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_profiles (
  id text primary key default extensions.gen_random_uuid()::text,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  role public.staff_role not null,
  avatar_url text,
  on_shift boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_property_memberships (
  id text primary key default extensions.gen_random_uuid()::text,
  staff_id text not null references public.staff_profiles(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete cascade,
  property_id text not null references public.properties(id) on delete cascade,
  role public.staff_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, property_id)
);

create table if not exists public.guests (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  pronouns text,
  avatar_url text,
  loyalty_tier public.loyalty_tier not null default 'Standard',
  vip boolean not null default false,
  languages text[] not null default array['en']::text[],
  home_city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.guest_stays (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  guest_id text not null references public.guests(id) on delete cascade,
  arrival_date date not null,
  departure_date date not null,
  status public.guest_status not null,
  room_number text,
  room_type text not null,
  party_size integer not null default 1 check (party_size > 0),
  occasion public.guest_occasion,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (departure_date >= arrival_date)
);

create table if not exists public.guest_tags (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  guest_id text not null references public.guests(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  unique (property_id, guest_id, label)
);

create table if not exists public.guest_notes (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  guest_id text not null references public.guests(id) on delete cascade,
  body text not null,
  created_by text references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.tickets (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  guest_id text not null references public.guests(id) on delete cascade,
  stay_id text references public.guest_stays(id) on delete set null,
  category public.ticket_category not null,
  title text not null check (char_length(title) <= 140),
  detail text not null,
  priority public.ticket_priority not null default 'medium',
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text references public.staff_profiles(id) on delete set null,
  assigned_to_role public.staff_role,
  assigned_to_staff_id text references public.staff_profiles(id) on delete set null,
  due_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.ticket_events (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  ticket_id text not null references public.tickets(id) on delete cascade,
  type public.ticket_event_type not null,
  actor_id text references public.staff_profiles(id) on delete set null,
  actor_name text not null,
  body text,
  audio_url text,
  from_status public.ticket_status,
  to_status public.ticket_status,
  escalated_to public.staff_role,
  created_at timestamptz not null default now()
);

create table if not exists public.unfiled_voice_notes (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  transcript text not null,
  category public.ticket_category not null default 'guest_relations',
  priority public.ticket_priority not null default 'medium',
  guest_id text references public.guests(id) on delete set null,
  ticket_id text references public.tickets(id) on delete set null,
  created_by text references public.staff_profiles(id) on delete set null,
  filed_by text references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  filed_at timestamptz
);

create table if not exists public.voice_note_assets (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  ticket_event_id text references public.ticket_events(id) on delete cascade,
  storage_bucket text not null default 'voice-notes',
  storage_path text not null,
  mime_type text,
  duration_seconds numeric,
  created_by text references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.guest_preferences (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  guest_id text not null references public.guests(id) on delete cascade,
  category public.preference_category not null,
  label text not null,
  detail text not null,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  status public.preference_status not null default 'candidate',
  source_type public.preference_source_type not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_by text references public.staff_profiles(id) on delete set null,
  resolved_at timestamptz
);

create table if not exists public.guest_preference_evidence (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  preference_id text not null references public.guest_preferences(id) on delete cascade,
  ticket_id text references public.tickets(id) on delete set null,
  ticket_event_id text references public.ticket_events(id) on delete set null,
  guest_note_id text references public.guest_notes(id) on delete set null,
  unfiled_voice_note_id text references public.unfiled_voice_notes(id) on delete set null,
  quote text,
  created_at timestamptz not null default now()
);

create table if not exists public.preference_recommendations (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  guest_id text not null references public.guests(id) on delete cascade,
  stay_id text references public.guest_stays(id) on delete set null,
  title text not null,
  rationale text not null,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  status public.recommendation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_by text references public.staff_profiles(id) on delete set null,
  resolved_at timestamptz
);

create table if not exists public.audit_log (
  id text primary key default extensions.gen_random_uuid()::text,
  property_id text not null references public.properties(id) on delete cascade,
  actor_id text references public.staff_profiles(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists staff_profiles_auth_user_id_idx on public.staff_profiles(auth_user_id);
create index if not exists staff_property_memberships_auth_user_id_idx on public.staff_property_memberships(auth_user_id);
create index if not exists staff_property_memberships_property_id_idx on public.staff_property_memberships(property_id);
create index if not exists staff_property_memberships_property_auth_active_idx on public.staff_property_memberships(property_id, auth_user_id) where active;
create index if not exists staff_property_memberships_staff_property_active_idx on public.staff_property_memberships(staff_id, property_id) where active;
create index if not exists guests_property_id_idx on public.guests(property_id);
create index if not exists guest_stays_property_arrival_idx on public.guest_stays(property_id, arrival_date);
create index if not exists guest_stays_guest_id_idx on public.guest_stays(guest_id);
create index if not exists guest_stays_property_guest_idx on public.guest_stays(property_id, guest_id);
create index if not exists guest_tags_guest_id_idx on public.guest_tags(guest_id);
create index if not exists guest_tags_property_guest_idx on public.guest_tags(property_id, guest_id);
create index if not exists guest_notes_guest_id_idx on public.guest_notes(guest_id);
create index if not exists guest_notes_property_guest_idx on public.guest_notes(property_id, guest_id);
create index if not exists tickets_property_status_priority_idx on public.tickets(property_id, status, priority);
create index if not exists tickets_guest_id_idx on public.tickets(guest_id);
create index if not exists tickets_property_guest_idx on public.tickets(property_id, guest_id);
create index if not exists ticket_events_ticket_id_idx on public.ticket_events(ticket_id);
create index if not exists ticket_events_property_ticket_idx on public.ticket_events(property_id, ticket_id);
create index if not exists unfiled_voice_notes_property_filed_idx on public.unfiled_voice_notes(property_id, filed_at);
create index if not exists voice_note_assets_property_event_idx on public.voice_note_assets(property_id, ticket_event_id);
create index if not exists guest_preferences_guest_status_idx on public.guest_preferences(guest_id, status);
create index if not exists guest_preferences_property_guest_status_idx on public.guest_preferences(property_id, guest_id, status);
create index if not exists guest_preference_evidence_property_preference_idx on public.guest_preference_evidence(property_id, preference_id);
create index if not exists preference_recommendations_guest_status_idx on public.preference_recommendations(guest_id, status);
create index if not exists preference_recommendations_property_guest_status_idx on public.preference_recommendations(property_id, guest_id, status);
create index if not exists audit_log_property_entity_idx on public.audit_log(property_id, entity_table, entity_id);
create index if not exists guest_preferences_embedding_idx on public.guest_preferences using ivfflat (embedding vector_cosine_ops) with (lists = 32);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties for each row execute function private.set_updated_at();
drop trigger if exists staff_profiles_set_updated_at on public.staff_profiles;
create trigger staff_profiles_set_updated_at before update on public.staff_profiles for each row execute function private.set_updated_at();
drop trigger if exists staff_property_memberships_set_updated_at on public.staff_property_memberships;
create trigger staff_property_memberships_set_updated_at before update on public.staff_property_memberships for each row execute function private.set_updated_at();
drop trigger if exists guests_set_updated_at on public.guests;
create trigger guests_set_updated_at before update on public.guests for each row execute function private.set_updated_at();
drop trigger if exists guest_stays_set_updated_at on public.guest_stays;
create trigger guest_stays_set_updated_at before update on public.guest_stays for each row execute function private.set_updated_at();
drop trigger if exists guest_notes_set_updated_at on public.guest_notes;
create trigger guest_notes_set_updated_at before update on public.guest_notes for each row execute function private.set_updated_at();
drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at before update on public.tickets for each row execute function private.set_updated_at();
drop trigger if exists guest_preferences_set_updated_at on public.guest_preferences;
create trigger guest_preferences_set_updated_at before update on public.guest_preferences for each row execute function private.set_updated_at();
drop trigger if exists preference_recommendations_set_updated_at on public.preference_recommendations;
create trigger preference_recommendations_set_updated_at before update on public.preference_recommendations for each row execute function private.set_updated_at();

create or replace function private.is_property_member(target_property_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_property_memberships memberships
    where memberships.property_id = target_property_id
      and memberships.auth_user_id = (select auth.uid())
      and memberships.active
  );
$$;

create or replace function private.is_property_manager(target_property_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_property_memberships memberships
    where memberships.property_id = target_property_id
      and memberships.auth_user_id = (select auth.uid())
      and memberships.active
      and memberships.role = 'manager'
  );
$$;

create or replace function private.can_see_staff(target_staff_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_property_memberships viewer
    join public.staff_property_memberships subject on subject.property_id = viewer.property_id
    where viewer.auth_user_id = (select auth.uid())
      and viewer.active
      and subject.staff_id = target_staff_id
      and subject.active
  );
$$;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;

alter table public.properties enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_property_memberships enable row level security;
alter table public.guests enable row level security;
alter table public.guest_stays enable row level security;
alter table public.guest_tags enable row level security;
alter table public.guest_notes enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;
alter table public.unfiled_voice_notes enable row level security;
alter table public.voice_note_assets enable row level security;
alter table public.guest_preferences enable row level security;
alter table public.guest_preference_evidence enable row level security;
alter table public.preference_recommendations enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "Property members can read properties" on public.properties;
create policy "Property members can read properties"
on public.properties for select to authenticated
using (private.is_property_member(id));

drop policy if exists "Property managers can update properties" on public.properties;
create policy "Property managers can update properties"
on public.properties for update to authenticated
using (private.is_property_manager(id))
with check (private.is_property_manager(id));

drop policy if exists "Property members can read visible staff" on public.staff_profiles;
create policy "Property members can read visible staff"
on public.staff_profiles for select to authenticated
using (private.can_see_staff(id));

drop policy if exists "Managers can manage staff profiles" on public.staff_profiles;
create policy "Managers can manage staff profiles"
on public.staff_profiles for update to authenticated
using (exists (
  select 1
  from public.staff_property_memberships memberships
  where memberships.staff_id = staff_profiles.id
    and private.is_property_manager(memberships.property_id)
))
with check (exists (
  select 1
  from public.staff_property_memberships memberships
  where memberships.staff_id = staff_profiles.id
    and private.is_property_manager(memberships.property_id)
));

drop policy if exists "Members can read property memberships" on public.staff_property_memberships;
create policy "Members can read property memberships"
on public.staff_property_memberships for select to authenticated
using (private.is_property_member(property_id));

drop policy if exists "Managers can insert property memberships" on public.staff_property_memberships;
create policy "Managers can insert property memberships"
on public.staff_property_memberships for insert to authenticated
with check (private.is_property_manager(property_id));

drop policy if exists "Managers can update property memberships" on public.staff_property_memberships;
create policy "Managers can update property memberships"
on public.staff_property_memberships for update to authenticated
using (private.is_property_manager(property_id))
with check (private.is_property_manager(property_id));

drop policy if exists "Members read guests" on public.guests;
create policy "Members read guests" on public.guests for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert guests" on public.guests;
create policy "Members insert guests" on public.guests for insert to authenticated with check (private.is_property_member(property_id));
drop policy if exists "Members update guests" on public.guests;
create policy "Members update guests" on public.guests for update to authenticated using (private.is_property_member(property_id)) with check (private.is_property_member(property_id));

drop policy if exists "Members read guest stays" on public.guest_stays;
create policy "Members read guest stays" on public.guest_stays for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert guest stays" on public.guest_stays;
create policy "Members insert guest stays" on public.guest_stays for insert to authenticated with check (private.is_property_member(property_id));
drop policy if exists "Members update guest stays" on public.guest_stays;
create policy "Members update guest stays" on public.guest_stays for update to authenticated using (private.is_property_member(property_id)) with check (private.is_property_member(property_id));

drop policy if exists "Members read guest tags" on public.guest_tags;
create policy "Members read guest tags" on public.guest_tags for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert guest tags" on public.guest_tags;
create policy "Members insert guest tags" on public.guest_tags for insert to authenticated with check (private.is_property_member(property_id));
drop policy if exists "Members update guest tags" on public.guest_tags;
create policy "Members update guest tags" on public.guest_tags for update to authenticated using (private.is_property_member(property_id)) with check (private.is_property_member(property_id));

drop policy if exists "Members read guest notes" on public.guest_notes;
create policy "Members read guest notes" on public.guest_notes for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert guest notes" on public.guest_notes;
create policy "Members insert guest notes" on public.guest_notes for insert to authenticated with check (private.is_property_member(property_id));
drop policy if exists "Members update guest notes" on public.guest_notes;
create policy "Members update guest notes" on public.guest_notes for update to authenticated using (private.is_property_member(property_id)) with check (private.is_property_member(property_id));

drop policy if exists "Members read tickets" on public.tickets;
create policy "Members read tickets" on public.tickets for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert tickets" on public.tickets;
create policy "Members insert tickets" on public.tickets for insert to authenticated with check (private.is_property_member(property_id));
drop policy if exists "Members update tickets" on public.tickets;
create policy "Members update tickets" on public.tickets for update to authenticated using (private.is_property_member(property_id)) with check (private.is_property_member(property_id));

drop policy if exists "Members read ticket events" on public.ticket_events;
create policy "Members read ticket events" on public.ticket_events for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert ticket events" on public.ticket_events;
create policy "Members insert ticket events" on public.ticket_events for insert to authenticated with check (private.is_property_member(property_id));

drop policy if exists "Members read unfiled voice notes" on public.unfiled_voice_notes;
create policy "Members read unfiled voice notes" on public.unfiled_voice_notes for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert unfiled voice notes" on public.unfiled_voice_notes;
create policy "Members insert unfiled voice notes" on public.unfiled_voice_notes for insert to authenticated with check (private.is_property_member(property_id));
drop policy if exists "Members update unfiled voice notes" on public.unfiled_voice_notes;
create policy "Members update unfiled voice notes" on public.unfiled_voice_notes for update to authenticated using (private.is_property_member(property_id)) with check (private.is_property_member(property_id));

drop policy if exists "Members read voice note assets" on public.voice_note_assets;
create policy "Members read voice note assets" on public.voice_note_assets for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert voice note assets" on public.voice_note_assets;
create policy "Members insert voice note assets" on public.voice_note_assets for insert to authenticated with check (private.is_property_member(property_id));
drop policy if exists "Members update voice note assets" on public.voice_note_assets;
create policy "Members update voice note assets" on public.voice_note_assets for update to authenticated using (private.is_property_member(property_id)) with check (private.is_property_member(property_id));

drop policy if exists "Members read guest preferences" on public.guest_preferences;
create policy "Members read guest preferences" on public.guest_preferences for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert guest preferences" on public.guest_preferences;
create policy "Members insert guest preferences" on public.guest_preferences for insert to authenticated with check (private.is_property_member(property_id));
drop policy if exists "Managers resolve guest preferences" on public.guest_preferences;
create policy "Managers resolve guest preferences" on public.guest_preferences for update to authenticated using (private.is_property_manager(property_id)) with check (private.is_property_manager(property_id));

drop policy if exists "Members read preference evidence" on public.guest_preference_evidence;
create policy "Members read preference evidence" on public.guest_preference_evidence for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert preference evidence" on public.guest_preference_evidence;
create policy "Members insert preference evidence" on public.guest_preference_evidence for insert to authenticated with check (private.is_property_member(property_id));

drop policy if exists "Members read preference recommendations" on public.preference_recommendations;
create policy "Members read preference recommendations" on public.preference_recommendations for select to authenticated using (private.is_property_member(property_id));
drop policy if exists "Members insert preference recommendations" on public.preference_recommendations;
create policy "Members insert preference recommendations" on public.preference_recommendations for insert to authenticated with check (private.is_property_member(property_id));
drop policy if exists "Managers resolve preference recommendations" on public.preference_recommendations;
create policy "Managers resolve preference recommendations" on public.preference_recommendations for update to authenticated using (private.is_property_manager(property_id)) with check (private.is_property_manager(property_id));

drop policy if exists "Managers read audit log" on public.audit_log;
create policy "Managers read audit log" on public.audit_log for select to authenticated using (private.is_property_manager(property_id));
drop policy if exists "Members insert audit log" on public.audit_log;
create policy "Members insert audit log" on public.audit_log for insert to authenticated with check (private.is_property_member(property_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', false, 26214400, array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Property members can read voice-note objects" on storage.objects;
create policy "Property members can read voice-note objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'voice-notes'
  and private.is_property_member((storage.foldername(name))[1])
);

drop policy if exists "Property members can upload voice-note objects" on storage.objects;
create policy "Property members can upload voice-note objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'voice-notes'
  and private.is_property_member((storage.foldername(name))[1])
);

drop policy if exists "Property members can update voice-note objects" on storage.objects;
create policy "Property members can update voice-note objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'voice-notes'
  and private.is_property_member((storage.foldername(name))[1])
)
with check (
  bucket_id = 'voice-notes'
  and private.is_property_member((storage.foldername(name))[1])
);

do $$
begin
  alter publication supabase_realtime add table public.tickets;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ticket_events;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.unfiled_voice_notes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.guest_preferences;
exception when duplicate_object then null;
end $$;

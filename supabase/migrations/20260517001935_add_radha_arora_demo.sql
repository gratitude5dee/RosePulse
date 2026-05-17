set check_function_bodies = off;

insert into public.properties (id, name, slug, timezone)
values
  ('00000000-0000-4000-8000-000000000001', 'Rosewood Manor', 'rosewood-manor', 'America/Los_Angeles')
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    timezone = excluded.timezone;

insert into public.staff_profiles (id, name, role, avatar_url, on_shift)
values
  ('s_001', 'Amara Singh', 'concierge', null, true)
on conflict (id) do update
set name = excluded.name,
    role = excluded.role,
    avatar_url = excluded.avatar_url,
    on_shift = excluded.on_shift;

insert into public.guests (
  id,
  property_id,
  first_name,
  last_name,
  preferred_name,
  pronouns,
  avatar_url,
  loyalty_tier,
  vip,
  languages,
  home_city
)
values (
  'guest_radha_arora_demo',
  '00000000-0000-4000-8000-000000000001',
  'Radha',
  'Arora',
  null,
  'he/him',
  '/images/guests/radha-arora.webp',
  'Founder',
  true,
  array['en']::text[],
  'Los Angeles area'
)
on conflict (id) do update
set property_id = excluded.property_id,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    preferred_name = excluded.preferred_name,
    pronouns = excluded.pronouns,
    avatar_url = excluded.avatar_url,
    loyalty_tier = excluded.loyalty_tier,
    vip = excluded.vip,
    languages = excluded.languages,
    home_city = excluded.home_city;

insert into public.guest_stays (
  id,
  property_id,
  guest_id,
  arrival_date,
  departure_date,
  status,
  room_number,
  room_type,
  party_size,
  occasion
)
values (
  'stay_guest_radha_arora_demo',
  '00000000-0000-4000-8000-000000000001',
  'guest_radha_arora_demo',
  '2026-05-16',
  '2026-05-18',
  'arriving_today',
  'Villa 1',
  'Villa Suite',
  1,
  'business'
)
on conflict (id) do update
set property_id = excluded.property_id,
    guest_id = excluded.guest_id,
    arrival_date = excluded.arrival_date,
    departure_date = excluded.departure_date,
    status = excluded.status,
    room_number = excluded.room_number,
    room_type = excluded.room_type,
    party_size = excluded.party_size,
    occasion = excluded.occasion;

insert into public.guest_tags (id, property_id, guest_id, label)
values
  ('tag_guest_radha_arora_demo_1', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'Sense of place'),
  ('tag_guest_radha_arora_demo_2', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'Design details and lighting'),
  ('tag_guest_radha_arora_demo_3', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'Dining and mixology'),
  ('tag_guest_radha_arora_demo_4', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'Wellness and nature'),
  ('tag_guest_radha_arora_demo_5', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'Security discreet movement'),
  ('tag_guest_radha_arora_demo_6', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'Assistant or SMS contact'),
  ('tag_guest_radha_arora_demo_7', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'High privacy sensitivity')
on conflict (id) do update
set property_id = excluded.property_id,
    guest_id = excluded.guest_id,
    label = excluded.label;

insert into public.guest_notes (id, property_id, guest_id, body, created_by)
values (
  'note_guest_radha_arora_demo',
  '00000000-0000-4000-8000-000000000001',
  'guest_radha_arora_demo',
  'Fictional executive VIP demo profile based only on public professional and travel preference signals. Guest is on property for an executive hospitality innovation review and is likely to value discreet, polished service, exact property details, sense of place, local cultural expression, dining, wellness, and experiences that feel specific to Rosewood Sand Hill rather than generic luxury.',
  's_001'
)
on conflict (id) do update
set property_id = excluded.property_id,
    guest_id = excluded.guest_id,
    body = excluded.body,
    created_by = excluded.created_by;

insert into public.tickets (
  id,
  property_id,
  guest_id,
  stay_id,
  category,
  title,
  detail,
  priority,
  status,
  created_at,
  updated_at,
  created_by,
  assigned_to_role,
  due_at
)
values
  ('t_radha_001', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'stay_guest_radha_arora_demo', 'guest_relations', 'Prepare executive innovation arrival brief', 'Guest is reviewing how Rosewood Sand Hill expresses Silicon Valley sense of place. Concierge and manager should align on locally grounded details before late-afternoon arrival.', 'high', 'in_progress', '2026-05-16T23:19:17.367Z', '2026-05-16T23:19:17.367Z', 's_001', 'concierge', '2026-05-17T01:19:17.367Z'),
  ('t_radha_002', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'stay_guest_radha_arora_demo', 'room', 'Stage villa suite with local design cues', 'Add a concise card on residential architecture, garden views, and handcrafted details. Keep setup polished, uncluttered, and executive-discreet.', 'high', 'open', '2026-05-16T22:19:17.367Z', '2026-05-16T23:19:17.367Z', 's_001', 'front_desk', null),
  ('t_radha_003', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'stay_guest_radha_arora_demo', 'fnb', 'Curate Madera dining and mixology notes', 'Prepare a short, locally grounded dining and mixology brief with authentic cuisine options and no generic luxury language.', 'high', 'open', '2026-05-16T22:19:17.367Z', '2026-05-16T23:19:17.367Z', 's_001', 'fnb_captain', '2026-05-17T04:19:17.367Z'),
  ('t_radha_004', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'stay_guest_radha_arora_demo', 'spa', 'Hold Asaya nature-wellness window', 'Offer a locally inspired treatment or short nature walk only if schedule allows. Keep recommendation optional and time-aware.', 'medium', 'open', '2026-05-16T21:19:17.367Z', '2026-05-16T23:19:17.367Z', 's_001', 'spa_supervisor', null),
  ('t_radha_005', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'stay_guest_radha_arora_demo', 'security', 'Protect assistant and SMS protocol', 'Route updates through assistant or SMS, avoid public room callouts, and keep lobby movement discreet during the executive visit.', 'medium', 'open', '2026-05-16T23:19:17.367Z', '2026-05-16T23:19:17.367Z', 's_001', 'security_lead', null)
on conflict (id) do update
set property_id = excluded.property_id,
    guest_id = excluded.guest_id,
    stay_id = excluded.stay_id,
    category = excluded.category,
    title = excluded.title,
    detail = excluded.detail,
    priority = excluded.priority,
    status = excluded.status,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    created_by = excluded.created_by,
    assigned_to_role = excluded.assigned_to_role,
    due_at = excluded.due_at;

insert into public.ticket_events (
  id,
  property_id,
  ticket_id,
  type,
  actor_id,
  actor_name,
  body,
  audio_url,
  from_status,
  to_status,
  escalated_to,
  created_at
)
values
  ('t_radha_001_e_created', '00000000-0000-4000-8000-000000000001', 't_radha_001', 'created', 's_001', 'Amara Singh', 'Guest is reviewing how Rosewood Sand Hill expresses Silicon Valley sense of place. Concierge and manager should align on locally grounded details before late-afternoon arrival.', null, null, null, null, '2026-05-16T23:19:17.367Z'),
  ('t_radha_002_e_created', '00000000-0000-4000-8000-000000000001', 't_radha_002', 'created', 's_001', 'Amara Singh', 'Add a concise card on residential architecture, garden views, and handcrafted details. Keep setup polished, uncluttered, and executive-discreet.', null, null, null, null, '2026-05-16T22:19:17.367Z'),
  ('t_radha_003_e_created', '00000000-0000-4000-8000-000000000001', 't_radha_003', 'created', 's_001', 'Amara Singh', 'Prepare a short, locally grounded dining and mixology brief with authentic cuisine options and no generic luxury language.', null, null, null, null, '2026-05-16T22:19:17.367Z'),
  ('t_radha_004_e_created', '00000000-0000-4000-8000-000000000001', 't_radha_004', 'created', 's_001', 'Amara Singh', 'Offer a locally inspired treatment or short nature walk only if schedule allows. Keep recommendation optional and time-aware.', null, null, null, null, '2026-05-16T21:19:17.367Z'),
  ('t_radha_005_e_created', '00000000-0000-4000-8000-000000000001', 't_radha_005', 'created', 's_001', 'Amara Singh', 'Route updates through assistant or SMS, avoid public room callouts, and keep lobby movement discreet during the executive visit.', null, null, null, null, '2026-05-16T23:19:17.367Z')
on conflict (id) do update
set property_id = excluded.property_id,
    ticket_id = excluded.ticket_id,
    type = excluded.type,
    actor_id = excluded.actor_id,
    actor_name = excluded.actor_name,
    body = excluded.body,
    audio_url = excluded.audio_url,
    from_status = excluded.from_status,
    to_status = excluded.to_status,
    escalated_to = excluded.escalated_to,
    created_at = excluded.created_at;

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
  dedupe_key,
  created_at,
  updated_at
)
values
  ('pref_guest_radha_arora_demo_1', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'service', 'Sense of place', 'Carry this signal into ticket triage, pre-arrival review, and staff handoff notes.', 0.72, 'confirmed', 'tag', 'guest_radha_arora_demo|service|sense of place|carry this signal into ticket triage, pre-arrival review, and staff handoff notes.', '2026-05-15T12:19:17.374Z', '2026-05-15T12:19:17.374Z'),
  ('pref_guest_radha_arora_demo_2', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'room', 'Design details and lighting', 'Carry this signal into ticket triage, pre-arrival review, and staff handoff notes.', 0.77, 'candidate', 'tag', 'guest_radha_arora_demo|room|design details and lighting|carry this signal into ticket triage, pre-arrival review, and staff handoff notes.', '2026-05-14T00:19:17.375Z', '2026-05-14T00:19:17.375Z'),
  ('pref_guest_radha_arora_demo_3', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'dining', 'Dining and mixology', 'Carry this signal into ticket triage, pre-arrival review, and staff handoff notes.', 0.82, 'candidate', 'tag', 'guest_radha_arora_demo|dining|dining and mixology|carry this signal into ticket triage, pre-arrival review, and staff handoff notes.', '2026-05-12T12:19:17.375Z', '2026-05-12T12:19:17.375Z'),
  ('pref_guest_radha_arora_demo_4', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'wellness', 'Wellness and nature', 'Carry this signal into ticket triage, pre-arrival review, and staff handoff notes.', 0.87, 'candidate', 'tag', 'guest_radha_arora_demo|wellness|wellness and nature|carry this signal into ticket triage, pre-arrival review, and staff handoff notes.', '2026-05-11T00:19:17.375Z', '2026-05-11T00:19:17.375Z'),
  ('pref_guest_radha_arora_demo_5', '00000000-0000-4000-8000-000000000001', 'guest_radha_arora_demo', 'security', 'Security discreet movement', 'Coordinate movements and communications with reduced exposure and minimal interruption.', 0.92, 'candidate', 'tag', 'guest_radha_arora_demo|security|security discreet movement|coordinate movements and communications with reduced exposure and minimal interruption.', '2026-05-09T12:19:17.375Z', '2026-05-09T12:19:17.375Z')
on conflict (id) do update
set property_id = excluded.property_id,
    guest_id = excluded.guest_id,
    category = excluded.category,
    label = excluded.label,
    detail = excluded.detail,
    confidence = excluded.confidence,
    status = excluded.status,
    source_type = excluded.source_type,
    dedupe_key = excluded.dedupe_key,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;

insert into public.guest_preference_evidence (id, property_id, preference_id, ticket_event_id, quote)
values
  ('evidence_pref_guest_radha_arora_demo_1_1', '00000000-0000-4000-8000-000000000001', 'pref_guest_radha_arora_demo_1', 't_radha_001_e_created', 'Sense of place'),
  ('evidence_pref_guest_radha_arora_demo_2_1', '00000000-0000-4000-8000-000000000001', 'pref_guest_radha_arora_demo_2', 't_radha_002_e_created', 'Design details and lighting'),
  ('evidence_pref_guest_radha_arora_demo_3_1', '00000000-0000-4000-8000-000000000001', 'pref_guest_radha_arora_demo_3', 't_radha_003_e_created', 'Dining and mixology'),
  ('evidence_pref_guest_radha_arora_demo_4_1', '00000000-0000-4000-8000-000000000001', 'pref_guest_radha_arora_demo_4', 't_radha_004_e_created', 'Wellness and nature'),
  ('evidence_pref_guest_radha_arora_demo_5_1', '00000000-0000-4000-8000-000000000001', 'pref_guest_radha_arora_demo_5', 't_radha_005_e_created', 'Security discreet movement')
on conflict (id) do update
set property_id = excluded.property_id,
    preference_id = excluded.preference_id,
    ticket_event_id = excluded.ticket_event_id,
    quote = excluded.quote;

insert into public.preference_recommendations (
  id,
  property_id,
  guest_id,
  title,
  rationale,
  confidence,
  status,
  created_at
)
values (
  'rec_guest_radha_arora_demo',
  '00000000-0000-4000-8000-000000000001',
  'guest_radha_arora_demo',
  'Personalize the Sand Hill sense-of-place briefing',
  'Use the sense of place, local design, dining, wellness, and discreet-service signals before the next staff touchpoint.',
  0.9,
  'pending',
  '2026-05-16T23:59:17.375Z'
)
on conflict (id) do update
set property_id = excluded.property_id,
    guest_id = excluded.guest_id,
    title = excluded.title,
    rationale = excluded.rationale,
    confidence = excluded.confidence,
    status = excluded.status,
    created_at = excluded.created_at;

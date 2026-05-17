begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into public.properties (id, name, slug)
values
  ('test_property_a', 'Test Property A', 'test-property-a'),
  ('test_property_b', 'Test Property B', 'test-property-b')
on conflict (id) do nothing;

insert into public.staff_profiles (id, auth_user_id, name, role, on_shift)
values
  ('test_staff_a', '11111111-1111-4111-8111-111111111111', 'RLS Member', 'concierge', true),
  ('test_manager_a', '22222222-2222-4222-8222-222222222222', 'RLS Manager', 'manager', true),
  ('test_staff_b', '33333333-3333-4333-8333-333333333333', 'RLS Other', 'concierge', true)
on conflict (id) do nothing;

insert into public.staff_property_memberships (id, staff_id, auth_user_id, property_id, role, active)
values
  ('test_member_a', 'test_staff_a', '11111111-1111-4111-8111-111111111111', 'test_property_a', 'concierge', true),
  ('test_manager_member_a', 'test_manager_a', '22222222-2222-4222-8222-222222222222', 'test_property_a', 'manager', true),
  ('test_member_b', 'test_staff_b', '33333333-3333-4333-8333-333333333333', 'test_property_b', 'concierge', true)
on conflict (id) do nothing;

insert into public.guests (id, property_id, first_name, last_name)
values
  ('test_guest_a', 'test_property_a', 'Ada', 'A'),
  ('test_guest_b', 'test_property_b', 'Bea', 'B')
on conflict (id) do nothing;

insert into public.guest_preferences (id, property_id, guest_id, category, label, detail, confidence, status, source_type)
values ('test_pref_b', 'test_property_b', 'test_guest_b', 'service', 'Cross property preference', 'Should not be visible to property A.', 0.7, 'candidate', 'staff')
on conflict (id) do nothing;

insert into public.guest_preference_evidence (id, property_id, preference_id, quote)
values ('test_evidence_b', 'test_property_b', 'test_pref_b', 'Cross-property evidence')
on conflict (id) do nothing;

insert into public.voice_note_memos (id, property_id, transcript, title, category, priority, status, source)
values ('test_memo_b', 'test_property_b', 'Cross-property memo', 'Cross-property memo', 'guest_relations', 'medium', 'unfiled', 'unfiled')
on conflict (id) do nothing;

set local role anon;
select is((select count(*) from public.guests), 0::bigint, 'anon cannot read guests');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*) from public.guests where property_id = 'test_property_a'), 1::bigint, 'property member can read own property guests');
select is((select count(*) from public.guests where property_id = 'test_property_b'), 0::bigint, 'property member cannot read cross-property guests');

insert into public.tickets (id, property_id, guest_id, category, title, detail, priority, status, created_by)
values ('test_ticket_a', 'test_property_a', 'test_guest_a', 'guest_relations', 'Confirm greeting', 'RLS insert test.', 'medium', 'open', 'test_staff_a');
select ok(exists(select 1 from public.tickets where id = 'test_ticket_a'), 'property member can insert tickets');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into public.guest_preferences (id, property_id, guest_id, category, label, detail, confidence, status, source_type)
values ('test_pref_a', 'test_property_a', 'test_guest_a', 'service', 'Quiet greeting', 'Use a low-friction arrival touchpoint.', 0.7, 'candidate', 'staff');
insert into public.guest_preference_evidence (id, property_id, preference_id, quote)
values ('test_evidence_a', 'test_property_a', 'test_pref_a', 'Quiet greeting evidence');
select ok(exists(select 1 from public.guest_preference_evidence where id = 'test_evidence_a'), 'property member can insert and read preference evidence');
insert into public.voice_note_memos (id, property_id, guest_id, ticket_id, transcript, title, category, priority, status, source)
values ('test_memo_a', 'test_property_a', 'test_guest_a', 'test_ticket_a', 'Quiet greeting voice memo', 'Quiet greeting', 'guest_relations', 'medium', 'filed', 'new_ticket');
select ok(exists(select 1 from public.voice_note_memos where id = 'test_memo_a'), 'property member can insert and read voice note memos');
insert into public.guest_preference_evidence (id, property_id, preference_id, voice_note_memo_id, quote)
values ('test_evidence_memo_a', 'test_property_a', 'test_pref_a', 'test_memo_a', 'Voice memo evidence');
select ok(exists(select 1 from public.guest_preference_evidence where voice_note_memo_id = 'test_memo_a'), 'property member can link preference evidence to a voice memo');
select is(
  (public.save_walkie_voice_memo(jsonb_build_object(
    'propertyId', 'test_property_a',
    'source', 'new_ticket',
    'status', 'filed',
    'memoId', 'test_rpc_memo_a',
    'ticketId', 'test_rpc_ticket_a',
    'voiceNoteEventId', 'test_rpc_voice_event_a',
    'guestId', 'test_guest_a',
    'transcript', 'Guest has a nut allergy for dinner and prefers quiet room placement.',
    'category', 'fnb',
    'priority', 'urgent',
    'routeConfidence', 0.84,
    'analysisProvider', 'deterministic',
    'analysisStatus', 'analyzed',
    'signals', jsonb_build_array(jsonb_build_object(
      'preferenceCategory', 'dining',
      'label', 'Allergy & Safety',
      'detail', 'Nut allergy for dinner service',
      'value', 'Nut allergy for dinner service',
      'evidence', 'Guest has a nut allergy for dinner',
      'confidence', 0.9,
      'privacySensitivity', 'high'
    ))
  ))->>'memoId'),
  'test_rpc_memo_a',
  'property member can atomically save a walkie memo'
);
select ok(exists(select 1 from public.guest_preference_evidence where voice_note_memo_id = 'test_rpc_memo_a'), 'walkie memo RPC links preference evidence');
select is((select count(*) from public.guest_preference_evidence where property_id = 'test_property_b'), 0::bigint, 'property member cannot read cross-property preference evidence');
select is((select count(*) from public.voice_note_memos where property_id = 'test_property_b'), 0::bigint, 'property member cannot read cross-property voice memos');
update public.guest_preferences
set status = 'confirmed'
where id = 'test_pref_a';
select is((select status::text from public.guest_preferences where id = 'test_pref_a'), 'candidate', 'non-manager cannot resolve preferences');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
insert into public.staff_property_memberships (id, staff_id, auth_user_id, property_id, role, active)
values ('test_manager_created_member', 'test_staff_a', '11111111-1111-4111-8111-111111111111', 'test_property_a', 'concierge', true)
on conflict (id) do update set active = excluded.active;
select ok(exists(select 1 from public.staff_property_memberships where id = 'test_manager_created_member'), 'manager can manage memberships');
select is(
  (public.resolve_guest_preference('test_pref_a', 'confirmed', 'approved by manager')->>'status'),
  'confirmed',
  'manager can resolve preference candidates'
);

select * from finish();

rollback;

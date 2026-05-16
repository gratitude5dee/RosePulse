# RosePulse Supabase Backend

This folder contains the Phase 2 backend scaffold for RosePulse.

## Local Setup

1. Install the Supabase CLI.
2. Run `supabase start` from the repo root.
3. Run `pnpm supabase:seed:export` after fixture changes.
4. Run `supabase db reset` to apply `supabase/migrations/*` and `supabase/seed.sql`.
5. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_ROSEPULSE_PROPERTY_ID`

## Auth Bootstrap

RLS requires a signed-in Supabase Auth user whose `auth.users.id` appears in `staff_property_memberships.auth_user_id`.
The seed keeps staff rows provider-neutral, so the first real project needs one admin update after creating a manager user:

```sql
update public.staff_profiles
set auth_user_id = '<manager-auth-user-id>'
where id = 's_007';

update public.staff_property_memberships
set auth_user_id = '<manager-auth-user-id>'
where staff_id = 's_007'
  and property_id = '00000000-0000-4000-8000-000000000001';
```

After that, the manager can invite or map additional staff through future admin UI.

## AI Provider Mode

The Edge Functions default to deterministic fallback behavior. Set `ROSEPULSE_AI_PROVIDER` later when wiring an LLM or embedding provider. The schema is pgvector-ready through `guest_preferences.embedding`, but no provider key is required for Phase 2 scaffolding.

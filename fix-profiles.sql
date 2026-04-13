-- Run this in Supabase → SQL Editor → New query → Run
-- Fixes the 406 error on profiles table

-- Drop and recreate profiles policies cleanly
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;

alter table public.profiles enable row level security;

-- Allow anyone authenticated to read any profile
create policy "profiles_select" on public.profiles
  for select using (true);

-- Allow users to insert their own profile
create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());

-- Allow users to update their own profile
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid());

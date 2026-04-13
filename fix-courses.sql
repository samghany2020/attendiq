-- Run this in Supabase → SQL Editor → New query → Run
-- Fixes course creation permissions

-- Drop all existing course policies and recreate them cleanly
drop policy if exists "courses_select" on public.courses;
drop policy if exists "courses_insert" on public.courses;
drop policy if exists "courses_update" on public.courses;
drop policy if exists "courses_delete" on public.courses;
drop policy if exists "allow_all_courses" on public.courses;

-- Make sure RLS is enabled
alter table public.courses enable row level security;

-- Recreate policies
create policy "courses_select" on public.courses
  for select using (teacher_uid = auth.uid());

create policy "courses_insert" on public.courses
  for insert with check (teacher_uid = auth.uid());

create policy "courses_update" on public.courses
  for update using (teacher_uid = auth.uid());

create policy "courses_delete" on public.courses
  for delete using (teacher_uid = auth.uid());

-- Make sure sync_session_status exists
create or replace function public.sync_session_status()
returns void language plpgsql security definer as $$
begin
  update public.sessions set status = 'active'
  where status = 'scheduled'
    and scheduled_start is not null and scheduled_start <= now()
    and (scheduled_end is null or scheduled_end > now());
  update public.sessions set status = 'ended'
  where status = 'active'
    and scheduled_end is not null and scheduled_end <= now();
end; $$;

-- Verify courses table has correct columns
alter table public.courses add column if not exists name_ar text;
alter table public.courses add column if not exists code   text;

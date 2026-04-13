-- ============================================================
-- AttendIQ v5 — Quick Fix SQL
-- Run this FIRST if the app is stuck loading after login.
-- This adds missing columns/functions to your existing tables.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Add missing columns to sessions table (if upgrading from v4)
alter table public.sessions add column if not exists name_ar       text;
alter table public.sessions add column if not exists subject_ar    text;
alter table public.sessions add column if not exists scheduled_start timestamptz;
alter table public.sessions add column if not exists scheduled_end   timestamptz;
alter table public.sessions add column if not exists university    text;
alter table public.sessions add column if not exists faculty       text;
alter table public.sessions add column if not exists department    text;

-- Fix status check constraint to include 'scheduled'
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('scheduled','active','ended'));

-- Add missing columns to profiles table
alter table public.profiles add column if not exists university  text;
alter table public.profiles add column if not exists faculty     text;
alter table public.profiles add column if not exists department  text;
alter table public.profiles add column if not exists language    text default 'en';

-- Add missing columns to courses table
alter table public.courses add column if not exists name_ar text;

-- Add offline_submitted to attendance
alter table public.attendance add column if not exists offline_submitted boolean default false;

-- Create sync_session_status function (needed for auto open/close)
create or replace function public.sync_session_status()
returns void language plpgsql security definer as $$
begin
  -- Auto-open scheduled sessions whose start time has passed
  update public.sessions set status = 'active'
  where status = 'scheduled'
    and scheduled_start is not null
    and scheduled_start <= now()
    and (scheduled_end is null or scheduled_end > now());

  -- Auto-close active sessions whose end time has passed
  update public.sessions set status = 'ended'
  where status = 'active'
    and scheduled_end is not null
    and scheduled_end <= now();
end; $$;

-- Make sure courses table exists (in case it didn't before)
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_ar     text,
  code        text,
  teacher_uid uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now()
);

-- Enable RLS on courses
alter table public.courses enable row level security;

-- Drop and recreate courses policies cleanly
drop policy if exists "courses_select" on public.courses;
drop policy if exists "courses_insert" on public.courses;
drop policy if exists "courses_update" on public.courses;
drop policy if exists "courses_delete" on public.courses;
create policy "courses_select" on public.courses for select using (teacher_uid = auth.uid());
create policy "courses_insert" on public.courses for insert with check (teacher_uid = auth.uid());
create policy "courses_update" on public.courses for update using (teacher_uid = auth.uid());
create policy "courses_delete" on public.courses for delete using (teacher_uid = auth.uid());

-- Make sure checkin_attempts table exists
create table if not exists public.checkin_attempts (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null,
  fingerprint  text not null,
  attempted_at timestamptz default now()
);
alter table public.checkin_attempts enable row level security;
drop policy if exists "attempts_insert" on public.checkin_attempts;
drop policy if exists "attempts_select" on public.checkin_attempts;
create policy "attempts_insert" on public.checkin_attempts for insert with check (true);
create policy "attempts_select" on public.checkin_attempts for select using (true);

-- Enable realtime
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.attendance;

-- Done!

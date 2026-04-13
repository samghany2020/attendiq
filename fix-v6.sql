-- AttendIQ v6 — Database Upgrades
-- Run in Supabase → SQL Editor → New query → Run

-- 1. Add students to courses (course roster)
create table if not exists public.course_students (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid references public.courses(id) on delete cascade not null,
  student_id   text not null,
  name         text,
  group_name   text,  -- e.g. "Group 1", "Group 2", "A", "B"
  created_at   timestamptz default now(),
  unique(course_id, student_id)
);

alter table public.course_students enable row level security;
create policy "cs_select" on public.course_students for select using (
  exists (select 1 from public.courses c where c.id = course_id and c.teacher_uid = auth.uid())
);
create policy "cs_insert" on public.course_students for insert with check (
  exists (select 1 from public.courses c where c.id = course_id and c.teacher_uid = auth.uid())
);
create policy "cs_delete" on public.course_students for delete using (
  exists (select 1 from public.courses c where c.id = course_id and c.teacher_uid = auth.uid())
);
create policy "cs_update" on public.course_students for update using (
  exists (select 1 from public.courses c where c.id = course_id and c.teacher_uid = auth.uid())
);

-- 2. Add group to attendance records
alter table public.attendance add column if not exists group_name text;

-- 3. Add IP detection to attendance
alter table public.attendance add column if not exists ip_address text;
alter table public.attendance add column if not exists is_external_ip boolean default false;

-- 4. Add QR settings to sessions (rotating interval, fixed vs rotating)
alter table public.sessions add column if not exists qr_mode text default 'rotating' 
  check (qr_mode in ('fixed', 'rotating'));
alter table public.sessions add column if not exists qr_interval integer default 30;

-- 5. Widen token validation window (fixes clock skew between devices)
-- handled in app code

-- 6. Index for course_students
create index if not exists idx_course_students_course on public.course_students(course_id);

-- Realtime for course_students
alter publication supabase_realtime add table public.course_students;

-- ============================================================
-- AttendIQ v5 — Database Setup
-- SAFE TO RUN even if you had a previous version installed.
-- This drops old tables and recreates everything cleanly.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

drop table if exists public.checkin_attempts cascade;
drop table if exists public.attendance cascade;
drop table if exists public.sessions cascade;
drop table if exists public.courses cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email        text,
  university   text,
  faculty      text,
  department   text,
  language     text default 'en',
  is_admin     boolean default false,
  created_at   timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), new.email);
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_ar     text,
  code        text,
  teacher_uid uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now()
);

create table public.sessions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_ar         text,
  subject         text,
  subject_ar      text,
  date            date,
  scheduled_start timestamptz,
  scheduled_end   timestamptz,
  course_id       uuid references public.courses(id) on delete set null,
  teacher_uid     uuid references auth.users(id) on delete cascade not null,
  teacher_name    text,
  university      text,
  faculty         text,
  department      text,
  status          text default 'scheduled' check (status in ('scheduled','active','ended')),
  students        jsonb default '[]'::jsonb,
  qr_config       jsonb default '{"fgColor":"#1a3a2a","bgColor":"#ffffff","size":256,"level":"H"}'::jsonb,
  created_at      timestamptz default now()
);

create table public.attendance (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid references public.sessions(id) on delete cascade not null,
  student_id        text not null,
  name              text,
  photo_data        text,
  offline_submitted boolean default false,
  checked_in_at     timestamptz default now(),
  unique(session_id, student_id)
);

create table public.checkin_attempts (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null,
  fingerprint  text not null,
  attempted_at timestamptz default now()
);

create index idx_courses_teacher    on public.courses(teacher_uid);
create index idx_sessions_teacher   on public.sessions(teacher_uid);
create index idx_sessions_status    on public.sessions(status);
create index idx_sessions_scheduled on public.sessions(scheduled_start, scheduled_end);
create index idx_sessions_created   on public.sessions(created_at desc);
create index idx_attendance_session on public.attendance(session_id);
create index idx_attempts_fp        on public.checkin_attempts(session_id, fingerprint, attempted_at);

alter table public.profiles         enable row level security;
alter table public.courses          enable row level security;
alter table public.sessions         enable row level security;
alter table public.attendance       enable row level security;
alter table public.checkin_attempts enable row level security;

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update using (id = auth.uid());

create policy "courses_select" on public.courses for select using (teacher_uid = auth.uid());
create policy "courses_insert" on public.courses for insert with check (teacher_uid = auth.uid());
create policy "courses_update" on public.courses for update using (teacher_uid = auth.uid());
create policy "courses_delete" on public.courses for delete using (teacher_uid = auth.uid());

create policy "sessions_select" on public.sessions for select using (true);
create policy "sessions_insert" on public.sessions for insert with check (teacher_uid = auth.uid());
create policy "sessions_update" on public.sessions for update using (teacher_uid = auth.uid());
create policy "sessions_delete" on public.sessions for delete using (teacher_uid = auth.uid());

create policy "attendance_read" on public.attendance for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.teacher_uid = auth.uid())
);
create policy "attendance_insert" on public.attendance for insert with check (
  exists (select 1 from public.sessions s where s.id = session_id and s.status = 'active')
);

create policy "attempts_insert" on public.checkin_attempts for insert with check (true);
create policy "attempts_select" on public.checkin_attempts for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.teacher_uid = auth.uid())
);

create or replace function public.sync_session_status()
returns void language plpgsql security definer as $$
begin
  update public.sessions set status = 'active'
  where status = 'scheduled' and scheduled_start is not null and scheduled_start <= now()
  and (scheduled_end is null or scheduled_end > now());
  update public.sessions set status = 'ended'
  where status = 'active' and scheduled_end is not null and scheduled_end <= now();
end; $$;

create or replace function public.anonymise_student(student_id_input text)
returns int language plpgsql security definer as $$
declare updated_count int;
begin
  update public.attendance set name = 'Anonymised',
    student_id = 'ANON-' || substr(md5(student_id_input), 1, 8), photo_data = null
  where upper(student_id) = upper(student_id_input);
  get diagnostics updated_count = row_count;
  return updated_count;
end; $$;

alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.sessions;

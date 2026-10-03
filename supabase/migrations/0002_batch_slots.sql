-- ============================================================
-- GlottoLearn — Migration 0002: Batch slots + recording visibility
-- Run ONCE in Supabase SQL Editor. Idempotent (safe to re-run).
--
-- 1. batches.max_students        → batch capacity
-- 2. batch_enrollments           → student picks a live-class slot (seat)
-- 3. recordings policy tightened → live-class replays ONLY for that batch,
--                                  course recordings for all enrolled students
-- 4. quizzes.week_no             → weekly tests label
-- ============================================================

-- ---------- 1. Batch capacity ----------
alter table public.batches add column if not exists max_students int not null default 10;

-- ---------- 2. Batch enrollments (seat booking) ----------
create table if not exists public.batch_enrollments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (batch_id, student_id)
);
alter table public.batch_enrollments enable row level security;

-- anyone authenticated can read (needed to show seats filled)
create policy "batch_enrollments readable"
  on public.batch_enrollments for select to authenticated using (true);

-- students reserve their own seat — capacity is enforced by trigger below
create policy "students reserve own seat"
  on public.batch_enrollments for insert to authenticated
  with check (student_id = auth.uid());

-- students can release their own seat; staff too
create policy "own seat or staff can remove"
  on public.batch_enrollments for delete to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.batches b
      where b.id = batch_id and b.teacher_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- capacity check — refuse booking when the batch is full
create or replace function public.check_batch_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_count int;
begin
  select coalesce(max_students, 9999) into v_max from public.batches where id = new.batch_id;
  select count(*) into v_count from public.batch_enrollments where batch_id = new.batch_id;
  if v_count >= v_max then
    raise exception 'This batch is full (%/% seats taken)', v_count, v_max;
  end if;
  return new;
end $$;

drop trigger if exists batch_capacity_guard on public.batch_enrollments;
create trigger batch_capacity_guard
  before insert on public.batch_enrollments
  for each row execute function public.check_batch_capacity();

create index if not exists idx_batch_enrollments_batch on public.batch_enrollments(batch_id);
create index if not exists idx_batch_enrollments_student on public.batch_enrollments(student_id);

-- ---------- 3. Recordings visibility ----------
-- Live-class replays (batch_id set) → only students who booked THAT batch.
-- Course recordings (batch_id null)  → all enrolled students.
drop policy if exists "recordings readable by enrolled or staff" on public.recordings;
create policy "recordings readable (course vs batch)"
  on public.recordings for select to authenticated using (
    -- staff
    exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    -- course-wide recording (no batch) → any enrolled student
    or (
      batch_id is null
      and exists (select 1 from public.enrollments e where e.course_id = recordings.course_id and e.student_id = auth.uid())
    )
    -- live-class replay → only that batch's students
    or (
      batch_id is not null
      and exists (
        select 1 from public.batch_enrollments be
        where be.batch_id = recordings.batch_id and be.student_id = auth.uid()
      )
    )
  );

-- ---------- 4. Weekly tests ----------
alter table public.quizzes add column if not exists week_no int;

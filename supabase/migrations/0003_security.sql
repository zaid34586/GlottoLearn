-- ============================================================
-- GlottoLearn — Migration 0003: Security hardening
-- Run ONCE in Supabase SQL Editor. Idempotent (safe to re-run).
--
-- 1. app_flags        → runtime feature flags (demo payments on/off)
-- 2. payments         → clients can no longer write payment rows;
--                       demo checkout goes through a gated RPC
-- 3. enrollments      → no client INSERT; enroll_in_course() validates
--                       (free = auto, paid = requires a 'paid' payment)
-- 4. quizzes          → correct_answer hidden from students,
--                       grading moves server-side (submit_quiz_attempt)
-- 5. videos/materials → storage read requires course enrollment/staff
-- 6. live classes     → students need course enrollment + booked seat
--                       (can_join_batch); seat booking requires enrollment
--
-- !!! PRODUCTION STEPS (run after going live with Paddle) !!!
--   update public.app_flags set value = 'off' where key = 'demo_payments';
--   -- disables demo checkout so payments can only be marked paid
--   -- by the Paddle webhook (service role).
-- ============================================================

-- ---------- 1. Feature flags ----------
create table if not exists public.app_flags (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
drop policy if exists "app_flags admin only" on public.app_flags;
create policy "app_flags admin only"
  on public.app_flags for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Demo payments stay ON for now (no Paddle token yet, whole flow must be testable).
-- Flip to 'off' in production — see header above.
insert into public.app_flags (key, value) values ('demo_payments', 'on')
on conflict (key) do nothing;

-- ---------- 2. Payments: no client writes ----------
-- Students could previously insert/update their own rows with status='paid'.
-- All payment writes now happen through:
--   * record_demo_payment()  (gated by app_flags.demo_payments)
--   * paddle-webhook edge function (service role, signature-verified)
drop policy if exists "students create own payment" on public.payments;
drop policy if exists "students update own payment" on public.payments;
-- "payments readable by owner or admin" and "admins manage payments" stay.

create unique index if not exists uniq_payments_gateway_ref
  on public.payments (gateway, gateway_ref)
  where gateway_ref is not null;

-- ---------- 3. Enrollments: no client INSERT ----------
-- Free courses and paid courses both go through enroll_in_course().
drop policy if exists "students create own enrollment" on public.enrollments;
-- "students read own enrollments" and "admins delete enrollments" stay.

create or replace function public.enroll_in_course(p_course_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_course public.courses%rowtype;
  v_enrollment uuid;
  v_payment uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to enroll';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if not found or v_course.status <> 'published' then
    raise exception 'Course not available';
  end if;

  select id into v_enrollment from public.enrollments
    where course_id = p_course_id and student_id = auth.uid();
  if v_enrollment is not null then
    return v_enrollment;
  end if;

  if v_course.price_inr > 0 then
    select id into v_payment from public.payments
      where course_id = p_course_id and student_id = auth.uid() and status = 'paid'
      order by created_at desc limit 1;
    if v_payment is null then
      raise exception 'Payment required for this course';
    end if;
  end if;

  insert into public.enrollments (course_id, student_id, payment_id)
  values (p_course_id, auth.uid(), v_payment)
  on conflict (course_id, student_id) do update set course_id = excluded.course_id
  returning id into v_enrollment;
  return v_enrollment;
end $$;

create or replace function public.record_demo_payment(p_course_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_course public.courses%rowtype;
  v_payment uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if coalesce((select value from public.app_flags where key = 'demo_payments'), 'off') <> 'on' then
    raise exception 'Demo payments are disabled on this deployment';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if not found or v_course.status <> 'published' then
    raise exception 'Course not available';
  end if;
  if v_course.price_inr <= 0 then
    raise exception 'This course is free — no payment needed';
  end if;

  select id into v_payment from public.payments
    where course_id = p_course_id and student_id = auth.uid()
      and status = 'paid' and gateway = 'demo'
    order by created_at desc limit 1;

  if v_payment is null then
    insert into public.payments (student_id, course_id, amount, currency, gateway, gateway_ref, status)
    values (auth.uid(), p_course_id, v_course.price_inr, 'INR', 'demo',
            'DEMO-' || gen_random_uuid()::text, 'paid')
    returning id into v_payment;
  end if;

  insert into public.enrollments (course_id, student_id, payment_id)
  values (p_course_id, auth.uid(), v_payment)
  on conflict (course_id, student_id) do nothing;

  return v_payment;
end $$;

-- ---------- 4a. Quiz questions: hide answers from students ----------
-- Students used to SELECT the full row incl. correct_answer.
-- Course staff keep full access (question editor + grading).
drop policy if exists "questions readable by enrolled or staff" on public.questions;
create policy "questions readable by course staff"
  on public.questions for select to authenticated using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and (
      exists (select 1 from public.courses c where c.id = q.course_id and c.teacher_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    ))
  );

-- Safe question payload for test-takers (no correct_answer).
create or replace function public.get_quiz_questions(p_quiz_id uuid)
returns table (
  id uuid, quiz_id uuid, text text, type text,
  options jsonb, marks int, "position" int
)
language sql security definer set search_path = public stable as $$
  select q.id, q.quiz_id, q.text, q.type, q.options, q.marks, q.position
  from public.questions q
  where q.quiz_id = p_quiz_id
    and exists (
      select 1 from public.quizzes z
      join public.courses c on c.id = z.course_id
      where z.id = p_quiz_id
        and (
          exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = auth.uid())
          or c.teacher_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  order by q.position asc;
$$;

-- ---------- 4b. Attempts: no client score tampering ----------
-- Students previously could UPDATE their own attempt (score, status, ...).
-- Submission now goes through submit_quiz_attempt() only.
drop policy if exists "students update own attempts" on public.quiz_attempts;
drop policy if exists "students create own attempts" on public.quiz_attempts;
create policy "students create own attempts"
  on public.quiz_attempts for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'in_progress'
    and submitted_at is null
    and score = 0
    and total_marks = 0
  );
-- "attempts readable by owner or staff" and "staff grade attempts" stay.

-- Answers: students may only write answers while the attempt is in progress.
drop policy if exists "owner writes answers" on public.answers;
create policy "owner writes answers"
  on public.answers for all to authenticated
  using (
    (exists (select 1 from public.quiz_attempts a
             where a.id = attempt_id and a.student_id = auth.uid() and a.status = 'in_progress'))
    or exists (select 1 from public.quiz_attempts a
               join public.quizzes q on q.id = a.quiz_id
               join public.courses c on c.id = q.course_id
               where a.id = attempt_id and c.teacher_id = auth.uid())
    or (exists (select 1 from public.quiz_attempts a where a.id = attempt_id)
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  )
  with check (
    (exists (select 1 from public.quiz_attempts a
             where a.id = attempt_id and a.student_id = auth.uid() and a.status = 'in_progress'))
    or exists (select 1 from public.quiz_attempts a
               join public.quizzes q on q.id = a.quiz_id
               join public.courses c on c.id = q.course_id
               where a.id = attempt_id and c.teacher_id = auth.uid())
    or (exists (select 1 from public.quiz_attempts a where a.id = attempt_id)
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  );

-- Server-side grading: the client never sees correct_answer and never
-- computes a score. Short answers are stored with status='submitted'
-- for the teacher to grade; objective-only quizzes come back 'graded'.
create or replace function public.submit_quiz_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.quiz_attempts%rowtype;
  q public.questions%rowtype;
  v_score numeric := 0;
  v_total numeric := 0;
  v_has_short boolean := false;
  v_answer text;
  v_correct boolean;
begin
  select * into a from public.quiz_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;
  if a.student_id <> auth.uid() then
    raise exception 'This is not your attempt';
  end if;
  if a.status <> 'in_progress' then
    raise exception 'This attempt is already submitted';
  end if;

  for q in select * from public.questions where quiz_id = a.quiz_id order by position loop
    v_total := v_total + q.marks;
    select answer_text into v_answer from public.answers
      where attempt_id = a.id and question_id = q.id;
    v_answer := coalesce(trim(v_answer), '');

    if q.type = 'short' then
      v_has_short := true;
      insert into public.answers (attempt_id, question_id, answer_text, is_correct, marks_awarded)
      values (a.id, q.id, v_answer, null, 0)
      on conflict (attempt_id, question_id)
        do update set answer_text = excluded.answer_text;
    else
      v_correct := v_answer <> '' and lower(v_answer) = lower(trim(q.correct_answer));
      if v_correct then
        v_score := v_score + q.marks;
      end if;
      insert into public.answers (attempt_id, question_id, answer_text, is_correct, marks_awarded)
      values (a.id, q.id, v_answer, v_correct, case when v_correct then q.marks else 0 end)
      on conflict (attempt_id, question_id)
        do update set is_correct = excluded.is_correct, marks_awarded = excluded.marks_awarded;
    end if;
  end loop;

  update public.quiz_attempts
    set submitted_at = now(),
        score = v_score,
        total_marks = v_total,
        status = case when v_has_short then 'submitted' else 'graded' end
    where id = a.id;

  return jsonb_build_object(
    'score', v_score,
    'total_marks', v_total,
    'status', case when v_has_short then 'submitted' else 'graded' end
  );
end $$;

-- Result page payload: attempt + quiz + questions (incl. correct_answer
-- for review) + saved answers. Owner or course staff only.
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'attempt', to_jsonb(a),
    'quiz', to_jsonb(z),
    'questions', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.position)
      from public.questions q where q.quiz_id = z.id), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(to_jsonb(an) order by an.question_id)
      from public.answers an where an.attempt_id = a.id), '[]'::jsonb)
  )
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  where a.id = p_attempt_id
    and (
      a.student_id = auth.uid()
      or exists (select 1 from public.courses c where c.id = z.course_id and c.teacher_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    );
$$;

-- ---------- 5. Storage: private content requires enrollment ----------
-- videos + materials live under "<courseId>/<file>" (see CourseBuilder /
-- LiveClassroom uploads). Old policy let ANY authenticated user read
-- the whole videos bucket.
drop policy if exists "public read covers" on storage.objects;
create policy "public read covers"
  on storage.objects for select
  using (bucket_id in ('covers','avatars'));

drop policy if exists "authenticated read videos (private bucket, unguessable paths)" on storage.objects;
drop policy if exists "enrolled read course media" on storage.objects;
create policy "enrolled read course media"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('videos','materials')
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    and (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      or exists (select 1 from public.courses c
                 where c.id::text = split_part(name, '/', 1) and c.teacher_id = auth.uid())
      or exists (select 1 from public.enrollments e
                 where e.course_id::text = split_part(name, '/', 1) and e.student_id = auth.uid())
    )
  );

-- Staff upload/manage/delete policies from 0001 stay unchanged.

-- ---------- 6. Live classes: enrollment + booked seat ----------
create or replace function public.can_join_batch(p_batch_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.batches b
    where b.id = p_batch_id
      and (
        b.teacher_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        or (
          exists (select 1 from public.enrollments e
                  where e.course_id = b.course_id and e.student_id = auth.uid())
          and exists (select 1 from public.batch_enrollments be
                      where be.batch_id = b.id and be.student_id = auth.uid())
        )
      )
  );
$$;

-- Seat booking requires a course enrollment (prevents seat squatting
-- by users who never enrolled).
drop policy if exists "students reserve own seat" on public.batch_enrollments;
create policy "students reserve own seat"
  on public.batch_enrollments for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.batches b
      join public.enrollments e on e.course_id = b.course_id
      where b.id = batch_id and e.student_id = auth.uid()
    )
  );

-- Attendance rows only for people actually allowed in that class.
drop policy if exists "own attendance write" on public.attendance;
create policy "own attendance write"
  on public.attendance for all to authenticated
  using (
    (student_id = auth.uid() and public.can_join_batch(batch_id))
    or exists (select 1 from public.batches b where b.id = batch_id and b.teacher_id = auth.uid())
  )
  with check (
    (student_id = auth.uid() and public.can_join_batch(batch_id))
    or exists (select 1 from public.batches b where b.id = batch_id and b.teacher_id = auth.uid())
  );

-- ---------- Grants: sensitive RPCs are authenticated-only ----------
revoke execute on function public.enroll_in_course(uuid) from public, anon;
revoke execute on function public.record_demo_payment(uuid) from public, anon;
revoke execute on function public.submit_quiz_attempt(uuid) from public, anon;
revoke execute on function public.get_quiz_questions(uuid) from public, anon;
revoke execute on function public.get_attempt_review(uuid) from public, anon;
revoke execute on function public.can_join_batch(uuid) from public, anon;
grant execute on function public.enroll_in_course(uuid) to authenticated;
grant execute on function public.record_demo_payment(uuid) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;
grant execute on function public.get_quiz_questions(uuid) to authenticated;
grant execute on function public.get_attempt_review(uuid) to authenticated;
grant execute on function public.can_join_batch(uuid) to authenticated;

-- ---------- Extra indexes ----------
create index if not exists idx_payments_course on public.payments(course_id);
create index if not exists idx_answers_attempt on public.answers(attempt_id);

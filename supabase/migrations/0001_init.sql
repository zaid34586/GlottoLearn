-- ============================================================
-- GlottoLearn — Initial Schema (run once in Supabase SQL Editor)
-- Safe to re-run: idempotent (drop-if-exists guards everywhere)
-- ============================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  role text not null default 'student' check (role in ('student','teacher','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Auto-create profile on signup. FIRST EVER user becomes admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare admin_count int;
begin
  select count(*) into admin_count from public.profiles where role = 'admin';
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when admin_count = 0 then 'admin' else 'student' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent non-admins from changing roles
create or replace function public.prevent_role_escalation() returns trigger
language plpgsql as $$
begin
  if new.role <> old.role then
    if auth.uid() is null or not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'Only admins can change roles';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard before update on public.profiles
  for each row execute function public.prevent_role_escalation();

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- LANGUAGES ----------
create table if not exists public.languages (
  id bigint generated always as identity primary key,
  name text not null unique,
  code text not null,
  description text default '',
  is_active boolean not null default true
);
alter table public.languages enable row level security;
drop policy if exists "languages public read" on public.languages;
create policy "languages public read" on public.languages for select using (true);
drop policy if exists "admins write languages" on public.languages;
create policy "admins write languages" on public.languages for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.languages (name, code, description) values
  ('English','en','Global language of business'),
  ('French','fr','Language of art and diplomacy'),
  ('German','de','Gateway to Europe'),
  ('Spanish','es','Spoken across 20+ countries'),
  ('Japanese','ja','Language of innovation'),
  ('Korean','ko','Language of K-culture'),
  ('Chinese','zh','Language of opportunity'),
  ('Arabic','ar','Language of heritage')
on conflict (name) do nothing;

-- ---------- COURSES ----------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  language_id bigint references public.languages(id),
  level text not null default 'Beginner',
  price_inr numeric(10,2) not null default 0,
  cover_url text,
  teacher_id uuid references public.profiles(id),
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);
alter table public.courses enable row level security;
drop policy if exists "published courses readable by everyone" on public.courses;
create policy "published courses readable by everyone"
  on public.courses for select using (status = 'published');
drop policy if exists "staff read all courses" on public.courses;
create policy "staff read all courses"
  on public.courses for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or (p.role = 'teacher' and teacher_id = auth.uid()))));
drop policy if exists "staff create courses" on public.courses;
create policy "staff create courses"
  on public.courses for insert to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher') and teacher_id = auth.uid())
  );
drop policy if exists "staff update courses" on public.courses;
create policy "staff update courses"
  on public.courses for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (teacher_id = auth.uid())
  );
drop policy if exists "staff delete courses" on public.courses;
create policy "staff delete courses"
  on public.courses for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------- ENROLLMENTS (created BEFORE lessons — their RLS references it) ----------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid,
  enrolled_at timestamptz not null default now(),
  unique (course_id, student_id)
);
alter table public.enrollments enable row level security;
drop policy if exists "students read own enrollments" on public.enrollments;
create policy "students read own enrollments"
  on public.enrollments for select to authenticated
  using (student_id = auth.uid()
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "students create own enrollment" on public.enrollments;
create policy "students create own enrollment"
  on public.enrollments for insert to authenticated
  with check (student_id = auth.uid());
drop policy if exists "admins delete enrollments" on public.enrollments;
create policy "admins delete enrollments"
  on public.enrollments for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------- PAYMENTS ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'INR',
  gateway text not null default 'demo',
  gateway_ref text,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
drop policy if exists "payments readable by owner or admin" on public.payments;
create policy "payments readable by owner or admin"
  on public.payments for select to authenticated
  using (student_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "students create own payment" on public.payments;
create policy "students create own payment"
  on public.payments for insert to authenticated
  with check (student_id = auth.uid());
drop policy if exists "students update own payment" on public.payments;
create policy "students update own payment"
  on public.payments for update to authenticated
  using (student_id = auth.uid());
drop policy if exists "admins manage payments" on public.payments;
create policy "admins manage payments"
  on public.payments for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (true);

-- ---------- MODULES ----------
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position int not null default 0
);
alter table public.modules enable row level security;
drop policy if exists "modules readable for published courses" on public.modules;
create policy "modules readable for published courses"
  on public.modules for select using (
    exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or exists (select 1 from public.courses c2 where c2.id = course_id and c2.teacher_id = auth.uid())))
  );
drop policy if exists "staff write modules" on public.modules;
create policy "staff write modules"
  on public.modules for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  );

-- ---------- LESSONS ----------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  type text not null default 'video' check (type in ('video','material')),
  video_path text,
  content text default '',
  duration_sec int default 0,
  position int not null default 0
);
alter table public.lessons enable row level security;
-- readable only by enrolled students / course teacher / admin (video paths stay hidden pre-purchase)
drop policy if exists "lessons readable by enrolled or staff" on public.lessons;
create policy "lessons readable by enrolled or staff"
  on public.lessons for select to authenticated using (
    exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid())
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "staff write lessons" on public.lessons;
create policy "staff write lessons"
  on public.lessons for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  );

-- Public syllabus RPC (titles only — no video paths) for the course detail page
create or replace function public.get_course_syllabus(p_course_id uuid)
returns table (module_title text, module_position int, lesson_title text, lesson_position int)
language sql security definer set search_path = public stable as $$
  select m.title, m.position, l.title, l.position
  from public.modules m
  left join public.lessons l on l.module_id = m.id
  where m.course_id = p_course_id
    and exists (select 1 from public.courses c where c.id = p_course_id and c.status = 'published')
  order by m.position asc, l.position asc;
$$;
grant execute on function public.get_course_syllabus(uuid) to anon, authenticated;

-- ---------- BATCHES (live class schedule) ----------
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  title text not null,
  scheduled_at timestamptz not null,
  duration_min int not null default 60,
  status text not null default 'scheduled' check (status in ('scheduled','live','completed','cancelled')),
  created_at timestamptz not null default now()
);
alter table public.batches enable row level security;
drop policy if exists "batches readable" on public.batches;
create policy "batches readable" on public.batches for select to authenticated using (true);
drop policy if exists "staff write batches" on public.batches;
create policy "staff write batches"
  on public.batches for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or teacher_id = auth.uid()
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or teacher_id = auth.uid()
  );

-- ---------- LESSON PROGRESS ----------
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  completed boolean not null default false,
  seconds_watched int not null default 0,
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_id)
);
alter table public.lesson_progress enable row level security;
drop policy if exists "own progress" on public.lesson_progress;
create policy "own progress" on public.lesson_progress for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---------- RECORDINGS (saved live classes) ----------
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  title text not null,
  video_path text not null,
  duration_sec int default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.recordings enable row level security;
drop policy if exists "recordings readable by enrolled or staff" on public.recordings;
create policy "recordings readable by enrolled or staff"
  on public.recordings for select to authenticated using (
    exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid())
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "staff write recordings" on public.recordings;
create policy "staff write recordings"
  on public.recordings for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  );

-- ---------- QUIZZES ----------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text default '',
  time_limit_min int default 0,
  is_graded boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.quizzes enable row level security;
drop policy if exists "quizzes readable by enrolled or staff" on public.quizzes;
create policy "quizzes readable by enrolled or staff"
  on public.quizzes for select to authenticated using (
    exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid())
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "staff write quizzes" on public.quizzes;
create policy "staff write quizzes"
  on public.quizzes for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  );

-- ---------- QUESTIONS ----------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  text text not null,
  type text not null default 'mcq' check (type in ('mcq','truefalse','short')),
  options jsonb not null default '[]',
  correct_answer text not null default '',
  marks int not null default 1,
  position int not null default 0
);
alter table public.questions enable row level security;
drop policy if exists "questions readable by enrolled or staff" on public.questions;
create policy "questions readable by enrolled or staff"
  on public.questions for select to authenticated using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and (
      exists (select 1 from public.enrollments e where e.course_id = q.course_id and e.student_id = auth.uid())
      or exists (select 1 from public.courses c where c.id = q.course_id and c.teacher_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    ))
  );
drop policy if exists "staff write questions" on public.questions;
create policy "staff write questions"
  on public.questions for all to authenticated
  using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and (
      exists (select 1 from public.courses c where c.id = q.course_id and c.teacher_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    ))
  )
  with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and (
      exists (select 1 from public.courses c where c.id = q.course_id and c.teacher_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    ))
  );

-- ---------- QUIZ ATTEMPTS ----------
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(10,2) not null default 0,
  total_marks numeric(10,2) not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','graded')),
  unique (quiz_id, student_id)
);
alter table public.quiz_attempts enable row level security;
drop policy if exists "attempts readable by owner or staff" on public.quiz_attempts;
create policy "attempts readable by owner or staff"
  on public.quiz_attempts for select to authenticated using (
    student_id = auth.uid()
    or exists (select 1 from public.quizzes q join public.courses c on c.id = q.course_id
               where q.id = quiz_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "students create own attempts" on public.quiz_attempts;
create policy "students create own attempts"
  on public.quiz_attempts for insert to authenticated
  with check (student_id = auth.uid());
drop policy if exists "students update own attempts" on public.quiz_attempts;
create policy "students update own attempts"
  on public.quiz_attempts for update to authenticated
  using (student_id = auth.uid());
drop policy if exists "staff grade attempts" on public.quiz_attempts;
create policy "staff grade attempts"
  on public.quiz_attempts for update to authenticated
  using (
    exists (select 1 from public.quizzes q join public.courses c on c.id = q.course_id
            where q.id = quiz_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------- ANSWERS ----------
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_text text default '',
  is_correct boolean,
  marks_awarded numeric(10,2) default 0,
  unique (attempt_id, question_id)
);
alter table public.answers enable row level security;
drop policy if exists "answers readable by owner or staff" on public.answers;
create policy "answers readable by owner or staff"
  on public.answers for select to authenticated using (
    exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.student_id = auth.uid())
    or exists (select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
               join public.courses c on c.id = q.course_id
               where a.id = attempt_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "owner writes answers" on public.answers;
create policy "owner writes answers"
  on public.answers for all to authenticated
  using (
    exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.student_id = auth.uid())
    or exists (select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
               join public.courses c on c.id = q.course_id
               where a.id = attempt_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.student_id = auth.uid())
    or exists (select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
               join public.courses c on c.id = q.course_id
               where a.id = attempt_id and c.teacher_id = auth.uid())
  );

-- ---------- MATERIALS ----------
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  file_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.materials enable row level security;
drop policy if exists "materials readable by enrolled or staff" on public.materials;
create policy "materials readable by enrolled or staff"
  on public.materials for select to authenticated using (
    exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid())
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "staff write materials" on public.materials;
create policy "staff write materials"
  on public.materials for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  );

-- ---------- ANNOUNCEMENTS ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  author_id uuid references public.profiles(id),
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "announcements readable" on public.announcements;
create policy "announcements readable"
  on public.announcements for select to authenticated using (
    course_id is null
    or exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid())
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "staff write announcements" on public.announcements;
create policy "staff write announcements"
  on public.announcements for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (course_id is null and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (course_id is null and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
    or exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  );

-- ---------- ATTENDANCE ----------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  duration_sec int default 0,
  unique (batch_id, student_id)
);
alter table public.attendance enable row level security;
drop policy if exists "attendance readable by staff or own" on public.attendance;
create policy "attendance readable by staff or own"
  on public.attendance for select to authenticated using (
    student_id = auth.uid()
    or exists (select 1 from public.batches b where b.id = batch_id and b.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "own attendance write" on public.attendance;
create policy "own attendance write"
  on public.attendance for all to authenticated
  using (student_id = auth.uid()
    or exists (select 1 from public.batches b where b.id = batch_id and b.teacher_id = auth.uid()))
  with check (student_id = auth.uid()
    or exists (select 1 from public.batches b where b.id = batch_id and b.teacher_id = auth.uid()));

-- ---------- STORAGE BUCKETS ----------
insert into storage.buckets (id, name, public) values
  ('covers','covers',true),
  ('avatars','avatars',true),
  ('materials','materials',true),
  ('videos','videos',false)
on conflict (id) do nothing;

drop policy if exists "public read covers" on storage.objects;
create policy "public read covers" on storage.objects for select
  using (bucket_id in ('covers','avatars','materials'));
drop policy if exists "staff upload media" on storage.objects;
create policy "staff upload media" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('covers','avatars','materials','videos')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher','admin'))
  );
drop policy if exists "staff manage media" on storage.objects;
create policy "staff manage media" on storage.objects for update to authenticated
  using (
    bucket_id in ('covers','avatars','materials','videos')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher','admin'))
  );
drop policy if exists "staff delete media" on storage.objects;
create policy "staff delete media" on storage.objects for delete to authenticated
  using (
    bucket_id in ('covers','avatars','materials','videos')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher','admin'))
  );
drop policy if exists "authenticated read videos (private bucket, unguessable paths)" on storage.objects;
create policy "authenticated read videos (private bucket, unguessable paths)"
  on storage.objects for select to authenticated
  using (bucket_id = 'videos');

-- ---------- PERFORMANCE INDEXES ----------
create index if not exists idx_courses_status on public.courses(status);
create index if not exists idx_courses_teacher on public.courses(teacher_id);
create index if not exists idx_lessons_course on public.lessons(course_id);
create index if not exists idx_modules_course on public.modules(course_id);
create index if not exists idx_enrollments_course on public.enrollments(course_id);
create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_payments_student on public.payments(student_id);
create index if not exists idx_batches_course on public.batches(course_id);
create index if not exists idx_batches_status on public.batches(status);

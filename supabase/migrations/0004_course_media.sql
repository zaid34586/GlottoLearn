-- 0004: course media & public class info
--
-- 1. courses.demo_video_path  → path of a public preview/teaser video
-- 2. 'demos' bucket (public)  → anyone can watch the preview before buying
-- 3. public read covers policy includes 'demos'
-- 4. batches readable         → anon/visitors see scheduled+live class times
--                                on the public course page; staff still see
--                                their own everything, admins see all.

alter table public.courses
  add column if not exists demo_video_path text;

-- (courses cover_url + demo_video_path are written via the existing
--  "staff update courses" policy — teachers/admins only. No client write
--  policy changes needed.)

insert into storage.buckets (id, name, public) values ('demos', 'demos', true)
on conflict (id) do nothing;

drop policy if exists "public read covers" on storage.objects;
create policy "public read covers"
  on storage.objects for select
  using (bucket_id in ('covers', 'avatars', 'demos'));

drop policy if exists "staff upload media" on storage.objects;
create policy "staff upload media" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('covers', 'avatars', 'materials', 'videos', 'demos')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher', 'admin'))
  );

drop policy if exists "staff manage media" on storage.objects;
create policy "staff manage media" on storage.objects for update to authenticated
  using (
    bucket_id in ('covers', 'avatars', 'materials', 'videos', 'demos')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher', 'admin'))
  );

drop policy if exists "staff delete media" on storage.objects;
create policy "staff delete media" on storage.objects for delete to authenticated
  using (
    bucket_id in ('covers', 'avatars', 'materials', 'videos', 'demos')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher', 'admin'))
  );

-- Batches: was "authenticated sees every row". Now:
--   * everyone (incl. anon) sees scheduled/live rows  → public course page
--     can show upcoming class times before login
--   * a teacher sees all of their own rows (incl. past)
--   * admins see everything
--   * a student sees batches they hold a seat in (past replays / room links)
drop policy if exists "batches readable" on public.batches;
create policy "batches readable" on public.batches for select
  using (
    status in ('scheduled', 'live')
    or teacher_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.batch_enrollments be where be.batch_id = public.batches.id and be.student_id = auth.uid())
  );

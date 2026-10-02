# GlottoLearn 🌐

Premium language-learning SaaS — **live classes, recorded lessons, tests/quizzes, materials and payments, all inside one platform.** No Zoom, no Google Meet: the live classroom is built into the app with WebRTC.

**Stack:** React + Vite + TypeScript + Tailwind CSS v4 · Supabase (Auth, Postgres, Realtime, Storage) · Vercel deploy · GitHub

---

## Roles

| Role | Capabilities |
|---|---|
| **Student** | Browse & buy courses, watch recorded lessons, join live in-app classes, take quizzes, download materials, track progress |
| **Teacher** | Build courses (modules/lessons/videos), schedule live classes, record classes, create quizzes, upload materials, post announcements, view/grade results |
| **Admin** | Full control: courses, pricing, publishing, teacher/student roles, payments, revenue analytics |

> **First-ever registered user automatically becomes admin.** Everyone after that signs up as a student (admin can promote to teacher from People Manager).

---

## 1. Database setup (one time)

1. Open your Supabase project → **SQL Editor**
2. Paste the full contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and **Run**.
3. This creates all tables, RLS security policies, triggers, storage buckets and seeds the languages.

## 2. Local development

```bash
npm install
npm run dev
```

Configuration (in priority order):

1. Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (copy `env.example` → `.env.local`)
2. Built-in fallback: the app already carries the project's public Supabase URL + publishable key, so it runs out of the box.

Optional: set `VITE_RAZORPAY_KEY_ID` to enable real Razorpay checkout. Without it the app runs in clearly-labelled **demo payment mode** (payments are recorded as paid so the full flow is testable).

## 3. Deploy on Vercel

1. Push this repo to GitHub (already configured: `github.com/zaid34586/GlottoLearn`)
2. In Vercel: **Add New Project → Import** the repo (framework auto-detected: Vite)
3. Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key
   - `VITE_RAZORPAY_KEY_ID` = (optional, for live payments)
4. Deploy — SPA rewrites are handled by [`vercel.json`](vercel.json).

---

## The Live Classroom (in-app)

- WebRTC peer-to-peer video/audio mesh via Supabase Realtime signaling — teacher + students meet in a room that lives at `/live/:batchId`
- Chat, raise-hand, participants list, screen share, mic/camera controls
- Teacher can **Record** the class (camera/mic) — the recording is uploaded to Supabase Storage and automatically appears as a **Recorded lesson** for enrolled students
- Attendance (join/leave + duration) is logged per student

**Note:** P2P mesh is ideal for batches up to ~10–15 students. For larger batches, add a TURN server or upgrade to an SFU (e.g. LiveKit) later — the UI stays the same.

## Security

- Row Level Security on every table: students can only read content of courses they purchased; teachers manage only their own courses; payments are owner/admin-only
- Lesson video paths are never exposed before purchase (RLS-gated) and videos live in a **private** storage bucket served via signed URLs
- The publishable key is public browser config by design — all protection happens in database policies

## Project structure

```
supabase/migrations/0001_init.sql   # Full DB schema + RLS + storage + seed
src/lib/                            # supabase client, types, payments, utils
src/context/AuthContext.tsx         # Session + profile + role
src/components/                     # Layout, guards, UI kit, course card
src/pages/
  Landing / Courses / CourseDetail / Login / Signup / Profile
  student/   StudentDashboard, MyCourses, CoursePlayer, LiveClasses, QuizTake, QuizResult
  teacher/   TeacherDashboard, TeacherBatches, CourseBuilder (content/quizzes/materials/students)
  classroom/ LiveClassroom (WebRTC)
  admin/     AdminOverview, AdminCourses, AdminPeople, AdminPayments
```

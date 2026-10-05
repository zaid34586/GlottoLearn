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
2. Run each file **in order** (paste full contents → Run):
   1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — schema, RLS, storage, languages
   2. [`supabase/migrations/0002_batch_slots.sql`](supabase/migrations/0002_batch_slots.sql) — batch seats, weekly tests
   3. [`supabase/migrations/0003_security.sql`](supabase/migrations/0003_security.sql) — hardened payment/enrollment/quiz/media access
   4. [`supabase/migrations/0004_course_media.sql`](supabase/migrations/0004_course_media.sql) — demo/preview video, public class times
   5. [`supabase/seed_content.sql`](supabase/seed_content.sql) — sample course (optional)
3. All migrations are idempotent (safe to re-run).

## 2. Local development

```bash
npm install
npm run dev
```

Configuration (in priority order):

1. Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (copy `env.example` → `.env.local`)
2. Built-in fallback: the app already carries the project's public Supabase URL + publishable key, so it runs out of the box.

Optional: set `VITE_PADDLE_CLIENT_TOKEN` to enable real Paddle checkout. Without it the app runs in clearly-labelled **demo payment mode** (server records a demo payment via the gated `record_demo_payment()` RPC so the full flow is testable).

## 3. Deploy on Vercel

1. Push this repo to GitHub (already configured: `github.com/zaid34586/GlottoLearn`)
2. In Vercel: **Add New Project → Import** the repo (framework auto-detected: Vite)
3. Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key
   - `VITE_PADDLE_CLIENT_TOKEN` = (optional, for live payments)
   - `VITE_PADDLE_ENV` = (optional, `sandbox` for test mode)
4. Deploy — SPA rewrites are handled by [`vercel.json`](vercel.json).

## 4. Paddle webhook (required for live payments)

Live payments are verified server-side — the client cannot mark a payment as paid.

```bash
# one-time setup
npm install -g supabase
supabase login
supabase secrets set PADDLE_WEBHOOK_SECRET=<secret from Paddle dashboard>

# deploy the webhook function
supabase functions deploy paddle-webhook --no-verify-jwt
```

Then in **Paddle → Notifications**, add a webhook endpoint:

- URL: `https://<project-ref>.supabase.co/functions/v1/paddle-webhook`
- Events: `transaction.completed`, `payment.succeeded`

The webhook verifies the `Paddle-Signature` HMAC, records the payment (amount from your own price list) and creates the enrollment — idempotent on retries.

### Production hardening (run once, after Paddle is live)

```sql
-- disables demo checkout so payments can only be marked paid by the webhook
update public.app_flags set value = 'off' where key = 'demo_payments';
```

> **Note:** while `app_flags.demo_payments = 'on'` (the default), any signed-in user can self-record a demo payment. Keep it `on` only for demo/testing deployments.

---

## The Live Classroom (in-app)

- WebRTC peer-to-peer video/audio mesh via Supabase Realtime signaling — teacher + students meet in a room that lives at `/live/:batchId`
- Chat, raise-hand, participants list, screen share, mic/camera controls
- Teacher can **Record** the class (camera/mic) — the recording is uploaded to Supabase Storage and automatically appears as a **Recorded lesson** for enrolled students
- Attendance (join/leave + duration) is logged per student

**Note:** P2P mesh is ideal for batches up to ~10–15 students. For larger batches, add a TURN server or upgrade to an SFU (e.g. LiveKit) later — the UI stays the same.

## Security

- Row Level Security on every table: students only read content of courses they enrolled in; teachers manage only their own courses; payments are owner/admin-read only
- **Payments:** clients cannot write payment rows at all — live payments are recorded only by the signature-verified `paddle-webhook` edge function; demo payments go through a server-gated RPC (`app_flags.demo_payments`)
- **Enrollment:** no direct INSERT — `enroll_in_course()` validates published status and, for paid courses, requires an existing `paid` payment
- **Quizzes:** `correct_answer` never reaches the client (students get questions via `get_quiz_questions()`); grading happens server-side in `submit_quiz_attempt()`; attempts cannot be updated by students
- **Media:** `videos` + `materials` buckets require course enrollment (or staff) — signed URLs are checked against RLS
- **Live classes:** `can_join_batch()` enforces course enrollment + a booked seat; seat booking itself requires enrollment (no seat squatting)
- The publishable key is public browser config by design — all protection happens in database policies
- First-ever registered user becomes admin (bootstrap) — flip `app_flags.demo_payments` off and review admin roles before production

## Project structure

```
supabase/migrations/0001_init.sql       # Full DB schema + RLS + storage + seed
supabase/migrations/0002_batch_slots.sql # Batch seats, weekly tests
supabase/migrations/0003_security.sql    # Payment/enrollment/quiz/media hardening
supabase/migrations/0004_course_media.sql # Demo video bucket, public class times
supabase/functions/paddle-webhook/       # Paddle webhook (signature-verified)
supabase/seed_content.sql                # Sample course content
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

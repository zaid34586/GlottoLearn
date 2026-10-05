# GlottoLearn — E2E Manual Test Checklist

> **⚠️ Deploy order (bahut zaroori):**
> 1. Pehle SQL migrations `0001` → `0002` → **`0003`** → **`0004`** Supabase SQL Editor mein run karo
> 2. Uske baad hi frontend deploy/refresh karo — naya client code `0003` ke RPCs (`enroll_in_course`, `submit_quiz_attempt`, etc.) maangta hai
>
> **Test accounts banalo (incognito/logical order):**
> - **Admin** = first-ever signup (ya jo pehle se admin hai) → `/admin/login`
> - **Teacher** = naya account → admin People Manager se *Teacher* banaye
> - **Student A** aur **Student B** = do naye accounts → `/login`
>
> **Setup:** `0003` ke baad demo payments ON hona chahiye (`app_flags.demo_payments = 'on'`). Teacher ne ek **paid course** (jaise seeded ₹2000 French) + ek **free course** banaya ho, dono mein 2-3 lessons, ek video, ek quiz (MCQ + short dono), ek material, aur 1-2 batches ho.

---

## 1. Auth & Roles

| # | Steps | Expected |
|---|---|---|
| 1.1 | Naya signup (pehle account, fresh DB) | Role = admin |
| 1.2 | Doosra signup | Role = student |
| 1.3 | Student `/login` se login → `/admin` URL manually kholo | "access denied" screen, redirect nahi hota silently |
| 1.4 | Admin `/login` pe try karo | Main login admin ko reject karta hai — `/admin/login` bhejta hai |
| 1.5 | Admin se student ko Teacher promote karo (People Manager) | Student ab `/teach` access kar sakta hai |
| 1.6 | Bina login `/dashboard` kholo | Login page redirect |

## 2. Admin

| # | Steps | Expected |
|---|---|---|
| 2.1 | `/admin` overview | Counts + revenue sahi (paid payments hi count) |
| 2.2 | Course manager: price edit, publish/unpublish, Paddle price ID set | Save + UI reflect |
| 2.3 | People: role dropdown se promote/demote | Trigger sirf admin ko allow karta hai |
| 2.4 | Payments page | Sirf `paid` entries revenue mein; "mark failed" kaam karta hai |

## 3. Teacher — Course Building

| # | Steps | Expected |
|---|---|---|
| 3.1 | `/teach` se course create (paid, language, level) | Draft mein save |
| 3.2 | Module + lessons add, video upload | Video upload → lesson mein "Video uploaded" |
| 3.3 | Quiz create: 1 MCQ + 1 true/false + 1 short (alag marks) | Questions save, correct_answer dikhta hai teacher ko |
| 3.4 | Material upload (PDF) | Upload + list mein dikhe |
| 3.5 | Announcement post | Student ke course "Updates" tab mein dikhe |
| 3.6 | Course **publish** toggle | Public `/courses` mein appear |
| 3.7 | Batch schedule: date/time, **max students = 2** | Batch list mein dikhe |
| 3.8 | Teacher ko doosre teacher ka course edit karo (URL se) | Access denied |

## 4. Enrollment & Payments (demo mode)

| # | Steps | Expected |
|---|---|---|
| 4.1 | Student A: **free course** detail → "Enroll for Free" | Turant enroll + `/learn/` pe redirect |
| 4.2 | Student A: **paid course** → "Buy & Enroll Now" | Demo checkout → enroll + redirect. ⚠ Demo banner dikhe |
| 4.3 | Student A: wahi paid course dobara kholo | "Continue Learning" dikhe (double enroll nahi) |
| 4.4 | DB check (SQL Editor): `select * from payments` | Row = `gateway: demo`, `status: paid`, amount = course price |
| 4.5 | **Demo flag OFF test (SQL):** `update app_flags set value='off' where key='demo_payments'` → Student B se paid course buy → phir ON | OFF pe error "Demo payments are disabled" |

## 5. Course Player (Student A, enrolled course)

| # | Steps | Expected |
|---|---|---|
| 5.1 | `/learn/:id` → Lessons tab, video play | Signed URL se video chalta hai |
| 5.2 | Lesson "mark complete" → dashboard progress | % badhta hai |
| 5.3 | Materials tab → download | Signed download chalta hai |
| 5.4 | Tests tab → quiz list | Quizzes dikhti hain |
| 5.5 | **Student B (not enrolled)** `/learn/:id` (URL se) | Content access nahi (lessons empty/denied) |

## 6. Quiz — normal flow

| # | Steps | Expected |
|---|---|---|
| 6.1 | Student A quiz start | Questions dikhti hain, **`correct_answer` field NAHI** (Console → Network → `rpc/get_quiz_questions` check) |
| 6.2 | Answers select → browser close → wapas kholo | Resume — purane answers wapas |
| 6.3 | Submit (timer wala quiz: time ruko) | Auto-submit → result page |
| 6.4 | Result: score + per-question ✓/✗ (MCQ/TF) | **Server ka score** dikhe; short → "reviewed by your teacher" |
| 6.5 | Short-answer wala quiz submit hone ke baad | Attempt status = `submitted` (SQL check), teacher grading table mein dikhe |
| 6.6 | Teacher grading: short answer ka score set | Status → `graded`, student result mein naya score |

## 7. Quiz — anti-tamper (security)

| # | Steps | Expected |
|---|---|---|
| 7.1 | Quiz kholke Browser Console se network response check karo — kahin `correct_answer` hai? | **Bilkul nahi** (sirf teacher ke editor mein) |
| 7.2 | Submit ke baad Console snippet **T4** (neeche) se apna score forge karo | 0 rows update / error |
| 7.3 | Submit ke baad answers change karne ki koshish (snippet **T5**) | Blocked (attempt `in_progress` nahi hai) |
| 7.4 | Doosre student ka result URL kholo (`/quiz-result/<their-attempt-id>`) | Empty/not found — data nahi milta |

## 8. Live Classes & Seats

| # | Steps | Expected |
|---|---|---|
| 8.1 | Student A: `/live-classes` → slot dikhe (seats-left badge) | Sirf enrolled courses ke batches |
| 8.2 | Reserve Seat | "Seat booked" + My Live Classes mein dikhe |
| 8.3 | Full batch (max=2, 2 reserved) doosre student se | Reserve fail → "batch is full" |
| 8.4 | Student A seat ke bina `/live/:batchId` (URL se) | 🔒 Access denied (can_join_batch = false) |
| 8.5 | Student A **seat leke** join (15 min window) | Classroom join, video/audio/chat |
| 8.6 | Teacher join without seat | Teacher ko seat ki zaroorat nahi — directly join |
| 8.7 | Student A class chhode → attendance row | `joined_at`, `duration_sec` set |
| 8.8 | **Student C (bina enrollment) seat try** (snippet **T6**) | 403 — seat squatting blocked |

## 9. Recording (Teacher)

| # | Steps | Expected |
|---|---|---|
| 9.1 | Teacher class mein Record on → off | Upload → Recordings tab (batch students ke liye) |
| 9.2 | Batch seat wale Student A: recording play | Chalta hai |
| 9.3 | Doosre batch ka student ya non-enrolled (URL/path se) | Access nahi (storage RLS + recordings RLS) |

## 10. Security attack tests (Console snippets)

> Logged-in tab mein **Browser Console** me paste karo. Har test ke baad **expected result** verify karo.

```js
// Common setup — Supabase REST + auth token (project ke hisaab se adjust)
const REF = 'psrmojhyevtkimvqwrmm'
const KEY = 'sb_publishable_ti3Ju3yv7n2vJMeSU6-Fmg_jQ2PIPHq'
const S = JSON.parse(localStorage.getItem(`sb-${REF}-auth-token`))
const H = { apikey: KEY, Authorization: 'Bearer ' + S.access_token, 'content-type': 'application/json' }
const REST = `https://${REF}.supabase.co/rest/v1`
const uid = S.currentUser.id
```

```js
// T1: Bina payment paid-course me enroll karne ki koshish (direct table insert)
// EXPECT: 403 — new row-level security / policy violation
await fetch(`${REST}/enrollments`, { method: 'POST', headers: H,
  body: JSON.stringify({ course_id: '<PAID_COURSE_ID>', student_id: uid }) }).then(r => r.status)
```

```js
// T2: Khud ko 'paid' payment row daalna (bina gateway)
// EXPECT: 403 — students can no longer write payments
await fetch(`${REST}/payments`, { method: 'POST', headers: H,
  body: JSON.stringify({ student_id: uid, course_id: '<PAID_COURSE_ID>',
    amount: 1, gateway: 'fake', gateway_ref: 'x', status: 'paid' }) }).then(r => r.status)
```

```js
// T3: RPC se bina payment enroll — enroll_in_course() ka server check
// EXPECT: {"code":"PGRST202"...,"message":"Payment required for this course"}
await fetch(`${REST}/rpc/enroll_in_course`, { method: 'POST', headers: H,
  body: JSON.stringify({ p_course_id: '<PAID_COURSE_ID>' }) }).then(r => r.json())
```

```js
// T4: Apna quiz score forge karna (student UPDATE tha pehle)
// EXPECT: "0" rows — students can no longer update attempts
const tok = S.access_token
await fetch(`${REST}/quiz_attempts?id=eq.<MY_ATTEMPT_ID>`, { method: 'PATCH', headers: H,
  body: JSON.stringify({ score: 100, status: 'graded' }) }).then(r => r.headers.get('content-range'))
```

```js
// T5: submit ke baad apne answers badalna
// EXPECT: "0" rows — answer writes only while attempt is in_progress
await fetch(`${REST}/answers?attempt_id=eq.<MY_ATTEMPT_ID>`, { method: 'PATCH', headers: H,
  body: JSON.stringify({ is_correct: true, marks_awarded: 10 }) }).then(r => r.headers.get('content-range'))
```

```js
// T6: Bina enrollment seat booking (seat squatting)
// EXPECT: 403 — insert policy requires course enrollment
await fetch(`${REST}/batch_enrollments`, { method: 'POST', headers: H,
  body: JSON.stringify({ batch_id: '<BATCH_ID>', student_id: uid }) }).then(r => r.status)
```

```js
// T7: Doosre course ke questions ke answers chori (student RLS)
// EXPECT: [] — students can't select the questions table at all
await fetch(`${REST}/questions?quiz_id=eq.<OTHER_COURSE_QUIZ>&select=text,correct_answer`,
  { headers: H }).then(r => r.json())
```

```js
// T8: Bina enrollment doosre course ka lesson data
// EXPECT: [] — lessons RLS still enrolled-only
await fetch(`${REST}/lessons?course_id=eq.<OTHER_COURSE_ID>&select=title,video_path`,
  { headers: H }).then(r => r.json())
```

```js
// T9: Private video bucket se signed URL banane ki koshish (non-enrolled)
// EXPECT: 4xx error — storage SELECT requires enrollment/staff
await fetch(`https://${REF}.supabase.co/storage/v1/object/sign/videos/<OTHER_COURSE_ID>/some-file.webm`,
  { method: 'POST', headers: H, body: JSON.stringify({ expiresIn: 3600 }) }).then(r => r.status)
```

```js
// T10: Seat ke bina classroom access
// EXPECT: false
await fetch(`${REST}/rpc/can_join_batch`, { method: 'POST', headers: H,
  body: JSON.stringify({ p_batch_id: '<BATCH_ID>' }) }).then(r => r.json())
```

## 11. Paddle live mode (jab token hoga — optional abhi)

| # | Steps | Expected |
|---|---|---|
| 11.1 | `VITE_PADDLE_CLIENT_TOKEN` set + course pe `paddle_price_id` | Overlay checkout khulta hai (demo banner nahi) |
| 11.2 | Sandbox payment complete | Webhook fire → payment row `gateway: paddle` + enrollment (60s tak poll) |
| 11.3 | Webhook ko bina signature bhejo (curl se random body) | `401 Invalid signature` |
| 11.4 | Wahi event 2 baar replay karo | 2nd time duplicate payment nahi (uniq index + idempotent) |
| 11.5 | **Production:** `update app_flags set value='off' where key='demo_payments'` | Demo RPC band, sirf webhook se payment |

---

## 12. Course media & builder v2 (naye features)

### 12A. Quiz editor (scroll + type fields)

| # | Steps | Expected |
|---|---|---|
| 12A.1 | Teacher → Course → Tests → "Edit Questions" → 8-10 questions add karo | Modal poora scroll hota hai, kuch cut nahi hota (ab max-height + scroll hai) |
| 12A.2 | Type = Multiple choice select karo | Sirf 4 options + correct answer dikhta hai (True/False fields nahi) |
| 12A.3 | Type = True / False | Sirf "Correct answer" dropdown (True/False), options inputs nahi |
| 12A.4 | Type = Short answer | Ek hi "Expected answer" input (blank = teacher graded) |
| 12A.5 | Question add hone ke baad | Type wapas "Multiple choice" pe reset ho jata hai |
| 12A.6 | MCQ ka answer option ke text se alag likho (student side) | Wrong marking (exact match chahiye — hint text bhi hai) |

### 12B. Thumbnail (cover image)

| # | Steps | Expected |
|---|---|---|
| 12B.1 | Teacher → Dashboard → "+ New Course" modal | Naya "Cover thumbnail" upload box dikhta hai (optional) |
| 12B.2 | Image choose karo → Create Course | Image upload hoti hai, course card pe thumbnail dikhta hai |
| 12B.3 | Admin → Course Manager → "+ New Course" | Wahi cover upload box |
| 12B.4 | Teacher → Course → **Settings** tab → cover Replace/Remove | Card + course page dono pe live update |
| 12B.5 | Logged-out browser me `/courses` | Cover image sabko dikhti hai (public bucket) |

### 12C. Demo / preview video (public)

| # | Steps | Expected |
|---|---|---|
| 12C.1 | Teacher → Course → **Settings** → "Demo / preview video" upload (MP4) | Video upload + inline preview player dikhta hai |
| 12C.2 | Course page (`/courses/:id`) kholo **bina login** | Upar "Free preview — watch before you buy" player, bina enroll play hota hai |
| 12C.3 | Settings → "Remove video" | Player gayab |
| 12C.4 | Student jisne course kharida nahi wahi player dekh paye | Haan — ye public hai (demos bucket), videos bucket phir bhi private |

### 12D. Live Classes tab (course ke andar hi)

| # | Steps | Expected |
|---|---|---|
| 12D.1 | Course → **Live Classes** tab | List dikhti hai + "+ Schedule Class" button (batches page pe jaane ki zaroorat nahi) |
| 12D.2 | Class schedule karo (date/time) | Course page pe "Upcoming live classes" me turant dikhta hai |
| 12D.3 | Class ka card → Cancel | Status CANCELLED, past list me chala jata hai |
| 12D.4 | `/teach/batches` page | Wahi batches + seats wahan bhi (dono jgh same data) |

### 12E. Public live-class visibility

| # | Steps | Expected |
|---|---|---|
| 12E.1 | Logged-out browser me published course kholo jisme class scheduled hai | "Upcoming live classes" list dikhti hai (pehle sirf logged-in ko dikhta tha) |
| 12E.2 | Logged-out `/courses` pe course card | 🔴 "Next class Tue 7:00 pm" chip dikhta hai (0004 policy ke wajah se) |
| 12E.3 | Teacher ka past/cancelled batch logged-out me dhoondho | Row milti nahi — sirf scheduled/live publicly visible hain |

### 12F. Recordings — YouTube style

| # | Steps | Expected |
|---|---|---|
| 12F.1 | Student → Course → Recordings tab | 3-column grid (mobile pe 1, tablet pe 2), thumbnail frame + duration chip bottom-right |
| 12F.2 | Card pe hover → video controls | Play/seek chalta hai (file poori download nahi — `preload=metadata`) |
| 12F.3 | Title 2 line se zyada | `line-clamp-2` — card ka layout nahi tootta |

### 12G. Catalog search

| # | Steps | Expected |
|---|---|---|
| 12G.1 | `/courses` pe search box | Course title, description, language, teacher naam se filter |
| 12G.2 | Kuch nahi mila | "No courses found" empty state |
| 12G.3 | Search + language chip dono | Dono filter saath chalte hain (AND) |

---

## Pass/Fail log

| Date | Section | Issue found | Status |
|---|---|---|---|
|  |  |  |  |

**Agar koi test fail ho:** Console/network error + SQL row dump note karo, phir batana — main fix kar dunga.

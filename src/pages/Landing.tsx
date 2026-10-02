import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CourseCard } from '../components/CourseCard'
import { supabase } from '../lib/supabase'
import { greetings } from '../lib/langTheme'
import type { Course } from '../lib/types'

const FEATURES = [
  { icon: '🎥', title: 'Live Classes In-App', body: 'Join real-time video classrooms with chat, screen share and raise-hand — no Zoom, no external apps.', bg: 'bg-teal-100 text-teal-600' },
  { icon: '⏺️', title: 'Recorded Lessons', body: 'Every class gets recorded. Rewatch anytime, resume exactly where you left off.', bg: 'bg-sky-100 text-sky-600' },
  { icon: '📝', title: 'Tests & Quizzes', body: 'Auto-graded quizzes, timed exams and instant results to track your mastery.', bg: 'bg-violet-100 text-violet-600' },
  { icon: '📈', title: 'Progress Tracking', body: 'Lesson-by-lesson progress bars keep your learning streak alive and visible.', bg: 'bg-amber-100 text-amber-600' },
  { icon: '📎', title: 'Study Materials', body: 'Notes, PDFs and worksheets from your teacher — always one click away.', bg: 'bg-rose-100 text-rose-600' },
  { icon: '🎓', title: 'Expert Teachers', body: 'Learn from hand-picked teachers, verified and assigned by our team.', bg: 'bg-lime-100 text-lime-600' },
]

const STEPS = [
  { n: '1', title: 'Choose your language', body: 'Browse courses across 8+ languages — Beginner to Mastery.', bg: 'bg-teal-500' },
  { n: '2', title: 'Enroll in seconds', body: 'Secure checkout, instant access in My Learning.', bg: 'bg-sky-500' },
  { n: '3', title: 'Learn live & recorded', body: 'Attend in-app live classes, rewatch recordings, download notes.', bg: 'bg-violet-500' },
  { n: '4', title: 'Test & track mastery', body: 'Take quizzes, see instant scores, watch progress climb.', bg: 'bg-amber-500' },
]

const TESTIMONIALS = [
  { name: 'Priya S.', emoji: '👩🏽', bg: 'bg-rose-100', text: 'The live classes feel like a real classroom — but I attend from home. The quiz results keep me motivated!' },
  { name: 'Arjun M.', emoji: '🧑🏻', bg: 'bg-sky-100', text: 'I missed a live class once — the recording was right there in my course. Resumed exactly where I left off.' },
  { name: 'Sana K.', emoji: '👩🏼', bg: 'bg-amber-100', text: 'Premium feel, simple to use. My German went from zero to conversational in 3 months.' },
]

/** Bright "live class" mock — colorful CSS illustration, no external images */
function ClassMock() {
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-indigo-500/10">
        {/* window bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 text-xs font-extrabold text-slate-400">GlottoLearn · Live Class</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" /> LIVE
          </span>
        </div>
        {/* participant tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { e: '👩‍🏫', n: 'Teacher', bg: 'bg-amber-100' },
            { e: '🧑🏻‍💻', n: 'Aarav', bg: 'bg-sky-100' },
            { e: '👩🏽', n: 'Sana', bg: 'bg-rose-100' },
            { e: '🧑🏿', n: 'John', bg: 'bg-emerald-100' },
            { e: '👩🏼', n: 'Yuki', bg: 'bg-violet-100' },
            { e: '🧑‍💻', n: 'You', bg: 'bg-teal-100' },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl p-3 text-center" style={{ background: undefined }}>
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl ${s.bg}`}>
                {s.e}
              </div>
              <p className="mt-1.5 text-[11px] font-extrabold text-slate-500">{s.n}</p>
            </div>
          ))}
        </div>
        {/* chat bubbles */}
        <div className="mt-4 space-y-2">
          <div className="w-fit rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-600">
            <span className="mr-1.5 font-extrabold text-amber-600">Sana:</span> Bonjour! 😊
          </div>
          <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-gradient-to-r from-teal-500 to-sky-500 px-3.5 py-2 text-xs font-bold text-white">
            Je m'appelle Aarav ✓
          </div>
        </div>
      </div>

      {/* floating greeting chips */}
      <div className="animate-floaty absolute -left-5 -top-5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-lg">
        🇫🇷 Bonjour!
      </div>
      <div className="animate-floaty absolute -right-4 top-16 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-lg" style={{ animationDelay: '1.2s' }}>
        🇯🇵 こんにちは
      </div>
      <div className="animate-floaty absolute -bottom-5 left-8 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-lg" style={{ animationDelay: '2s' }}>
        🇪🇸 ¡Hola!
      </div>
      <div className="animate-floaty absolute -bottom-4 right-10 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-lg" style={{ animationDelay: '2.8s' }}>
        📝 Quiz: 9/10 🎉
      </div>
    </div>
  )
}

export default function Landing() {
  const { session, role } = useAuth()
  const [featured, setFeatured] = useState<Course[]>([])

  useEffect(() => {
    document.title = 'GlottoLearn — Learn Any Language'
    supabase
      .from('courses')
      .select('*, language:languages(*), teacher:profiles!courses_teacher_id_fkey(*)')
      .eq('status', 'published')
      .limit(6)
      .then(({ data }) => setFeatured((data as unknown as Course[]) ?? []))
  }, [])

  const dash = role ? (role === 'admin' ? '/admin' : role === 'teacher' ? '/teach' : '/dashboard') : '/signup'

  return (
    <div>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-1.5 text-xs font-extrabold text-teal-600 ring-1 ring-teal-200">
              ✦ Premium language learning, all-in-one
            </div>
            <h1 className="font-display text-5xl font-bold leading-[1.06] text-slate-900 sm:text-6xl">
              Speak a new language with{' '}
              <span className="text-gradient">confidence</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-500 sm:text-lg">
              Live classes, recorded lessons, quizzes and study material — everything happens inside GlottoLearn. No external apps. Just pure learning.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to={dash} className="btn-primary !px-7 !py-3 !text-base">
                {session ? 'Go to Dashboard' : 'Start Learning Free'} →
              </Link>
              <Link to="/courses" className="btn-ghost !px-7 !py-3 !text-base">Browse Courses</Link>
            </div>
            <div className="mt-10 flex gap-10 text-sm">
              {[['8+', 'Languages'], ['100%', 'In-app classes'], ['24/7', 'Recorded access']].map(([v, l]) => (
                <div key={l}>
                  <p className="font-display text-3xl font-extrabold text-slate-900">{v}</p>
                  <p className="font-semibold text-slate-400">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '0.15s' }}>
            <ClassMock />
          </div>
        </div>

        {/* Greeting marquee — color-coded chips */}
        <div className="relative border-y border-slate-200 bg-white/70 py-5">
          <div className="flex overflow-hidden">
            <div className="animate-marquee flex shrink-0 items-center gap-3 pr-3">
              {[...greetings, ...greetings].map((g, i) => (
                <span
                  key={i}
                  className="whitespace-nowrap rounded-full px-5 py-2 text-lg font-extrabold text-white"
                  style={{ background: `linear-gradient(100deg, ${g.accent}, ${g.accent}cc)` }}
                >
                  {g.word}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- FEATURED COURSES ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">Courses</p>
            <h2 className="font-display mt-1 text-3xl font-bold text-slate-900">Featured Courses</h2>
          </div>
          <Link to="/courses" className="text-sm font-bold text-indigo-600 hover:text-indigo-500">View all →</Link>
        </div>
        {featured.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-sm font-semibold text-slate-400">
            Courses are being crafted. Check back soon!
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-600">Why GlottoLearn</p>
          <h2 className="font-display mt-1 text-3xl font-bold text-slate-900">Everything inside one platform</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Live classes, recordings, quizzes, materials — no external tools, ever.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass glass-hover rounded-3xl p-6">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${f.bg}`}>
                {f.icon}
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-violet-600">Simple steps</p>
          <h2 className="font-display mt-1 text-3xl font-bold text-slate-900">How it works</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="glass glass-hover relative rounded-3xl p-6">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-extrabold text-white ${s.bg}`}>
                {s.n}
              </span>
              <h3 className="font-display mt-4 text-lg font-bold text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- TESTIMONIALS ---------------- */}
      <section id="testimonials" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-rose-500">Testimonials</p>
          <h2 className="font-display mt-1 text-3xl font-bold text-slate-900">Loved by learners</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="glass glass-hover rounded-3xl p-6">
              <p className="text-amber-500">★★★★★</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">"{t.text}"</p>
              <div className="mt-5 flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${t.bg}`}>{t.emoji}</span>
                <p className="font-display text-sm font-bold text-slate-900">{t.name}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-teal-500 via-indigo-500 to-fuchsia-500 p-10 text-center shadow-2xl shadow-indigo-500/30 md:p-14">
          <span className="font-display absolute left-6 top-6 text-2xl font-extrabold text-white/25">Bonjour</span>
          <span className="font-display absolute right-8 top-10 text-2xl font-extrabold text-white/25">Hola</span>
          <span className="font-display absolute bottom-6 left-12 text-2xl font-extrabold text-white/25">こんにちは</span>
          <h2 className="font-display relative text-3xl font-bold text-white md:text-4xl">Ready to start speaking?</h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/85">Join GlottoLearn today. Your first lesson is closer than you think.</p>
          <Link to={dash} className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-extrabold text-indigo-600 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl">
            Get Started →
          </Link>
        </div>
      </section>
    </div>
  )
}

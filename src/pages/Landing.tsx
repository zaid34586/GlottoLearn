import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CourseCard } from '../components/CourseCard'
import { supabase } from '../lib/supabase'
import { greetings } from '../lib/langTheme'
import type { Course } from '../lib/types'

function Hero3D() {
  const sceneRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const el = sceneRef.current
      if (!el) return
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      el.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 10}deg)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="scene-3d relative mx-auto hidden h-80 w-full max-w-md md:block">
      <div ref={sceneRef} className="word-3d relative h-full w-full transition-transform duration-200 ease-out">
        {/* Globe */}
        <div className="animate-floaty absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-indigo-500/50 via-violet-500/40 to-transparent shadow-[0_0_90px_-10px_rgba(99,102,241,0.8)]">
          <div className="absolute inset-0 rounded-full border border-white/20" />
          <div className="absolute inset-0 rounded-full border border-white/10 [transform:translateZ(30px)]" />
          <div className="absolute inset-0 rounded-full border border-white/10 [transform:translateZ(-30px)]" />
        </div>
        {/* Orbiting greetings — each in its language colour */}
        {greetings.map((g, i) => {
          const angle = (i / greetings.length) * Math.PI * 2
          const rx = Math.cos(angle) * 130
          const rz = Math.sin(angle) * 90
          return (
            <span
              key={g.word}
              className="absolute left-1/2 top-1/2 whitespace-nowrap rounded-full border bg-white/5 px-3 py-1 text-sm font-semibold text-white/90 backdrop-blur"
              style={{
                borderColor: `${g.accent}55`,
                boxShadow: `0 0 18px -6px ${g.accent}88`,
                transform: `translate(calc(-50% + ${rx}px), calc(-50% + ${Math.sin(angle) * 40 - 60}px)) translateZ(${rz}px)`,
                animation: `floaty ${5 + (i % 4)}s ease-in-out ${i * 0.4}s infinite`,
              }}
            >
              {g.word}
            </span>
          )
        })}
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: '🎥', title: 'Live Classes In-App', body: 'Join real-time video classrooms with chat, screen share and raise-hand — no Zoom, no external apps.' },
  { icon: '⏺️', title: 'Recorded Lessons', body: 'Every class gets recorded. Rewatch anytime with resume-where-you-left playback.' },
  { icon: '📝', title: 'Tests & Quizzes', body: 'Auto-graded quizzes, timed exams and instant result analytics to track your mastery.' },
  { icon: '📈', title: 'Progress Tracking', body: 'Lesson-by-lesson progress bars keep your learning streak alive and visible.' },
  { icon: '📎', title: 'Study Materials', body: 'Notes, PDFs and worksheets from your teacher, always one click away.' },
  { icon: '🎓', title: 'Expert Teachers', body: 'Learn from hand-picked language teachers assigned and verified by our team.' },
]

const STEPS = [
  { n: '01', title: 'Choose your language', body: 'Browse courses across 8+ languages and levels — from Beginner to Mastery.' },
  { n: '02', title: 'Enroll in seconds', body: 'Secure checkout and instant access. Your course appears in My Learning immediately.' },
  { n: '03', title: 'Learn live & recorded', body: 'Attend live classes in-app, rewatch recordings, download materials.' },
  { n: '04', title: 'Test & track mastery', body: 'Take quizzes, see instant results and watch your progress climb.' },
]

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
        <div className="glow-orb -left-32 top-10 h-96 w-96 bg-indigo-600/50" />
        <div className="glow-orb -right-24 top-40 h-80 w-80 bg-fuchsia-600/40" />
        <div className="glow-orb bottom-0 left-1/3 h-72 w-72 bg-amber-400/25" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
          <div className="animate-fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-indigo-200 backdrop-blur">
              ✦ Premium language learning, all-in-one
            </div>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              Speak a new language with{' '}
              <span className="text-gradient font-bold italic">confidence</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/60 sm:text-lg">
              Live classes, recorded lessons, quizzes and study material — everything happens inside GlottoLearn. No external apps. Just pure learning.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to={dash} className="btn-primary !px-7 !py-3 !text-base">
                {session ? 'Go to Dashboard' : 'Start Learning Free'} →
              </Link>
              <Link to="/courses" className="btn-ghost !px-7 !py-3 !text-base">Browse Courses</Link>
            </div>
            <div className="mt-10 flex gap-8 text-sm">
              {[['8+', 'Languages'], ['100%', 'In-app classes'], ['24/7', 'Recorded access']].map(([v, l]) => (
                <div key={l}>
                  <p className="font-display text-2xl font-bold text-white">{v}</p>
                  <p className="text-white/45">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <Hero3D />
        </div>

        {/* Language marquee — colour-coded greetings */}
        <div className="relative border-y border-white/10 py-5">
          <div className="flex overflow-hidden">
            <div className="animate-marquee flex shrink-0 items-center gap-4 pr-4">
              {[...greetings, ...greetings].map((g, i) => (
                <span
                  key={i}
                  className="font-display whitespace-nowrap rounded-full border px-5 py-2 text-lg font-semibold"
                  style={{ borderColor: `${g.accent}44`, color: g.accent, background: `${g.accent}0d` }}
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
            <h2 className="font-display text-3xl font-bold text-white">Featured Courses</h2>
            <p className="mt-1 text-white/50">Hand-crafted courses by our expert teachers.</p>
          </div>
          <Link to="/courses" className="text-sm font-semibold text-indigo-300 hover:text-indigo-200">View all →</Link>
        </div>
        {featured.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-white/50">
            Courses are being crafted. Check back soon!
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section className="relative mx-auto max-w-6xl px-4 py-16">
        <div className="glow-orb right-0 top-20 h-72 w-72 bg-violet-600/30" />
        <h2 className="font-display mb-10 text-center text-3xl font-bold text-white">Everything you need, <span className="text-gradient">inside one platform</span></h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass glass-hover rounded-2xl p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/20 text-xl">
                {f.icon}
              </div>
              <h3 className="font-display text-base font-bold text-white">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display mb-10 text-center text-3xl font-bold text-white">How it <span className="text-gradient">works</span></h2>
        <div className="grid gap-5 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="glass relative rounded-2xl p-6" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="font-display text-4xl font-extrabold text-white/10">{s.n}</span>
              <h3 className="font-display mt-2 text-base font-bold text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm text-white/50">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- TESTIMONIALS ---------------- */}
      <section id="testimonials" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display mb-10 text-center text-3xl font-bold text-white">Loved by <span className="text-gradient">learners</span></h2>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { name: 'Priya S.', text: 'The live classes feel like a real classroom — but I attend from home. The quiz results keep me motivated!' },
            { name: 'Arjun M.', text: 'I missed a live class once, the recording was right there in my course. Resumed exactly where I left off.' },
            { name: 'Sana K.', text: 'Premium feel, simple to use. My German went from zero to conversational in 3 months.' },
          ].map((t) => (
            <div key={t.name} className="glass glass-hover rounded-2xl p-6">
              <p className="text-amber-300">★★★★★</p>
              <p className="mt-3 text-sm leading-relaxed text-white/70">"{t.text}"</p>
              <p className="font-display mt-4 text-sm font-bold text-white">{t.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="glass-strong relative overflow-hidden rounded-3xl p-10 text-center">
          <div className="glow-orb left-10 top-0 h-56 w-56 bg-indigo-500/40" />
          <div className="glow-orb bottom-0 right-10 h-56 w-56 bg-amber-400/30" />
          <h2 className="font-display relative text-3xl font-bold text-white">Ready to start speaking?</h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/60">Join GlottoLearn today. Your first lesson is closer than you think.</p>
          <Link to={dash} className="btn-primary relative mt-7 !px-8 !py-3 !text-base">Get Started →</Link>
        </div>
      </section>
    </div>
  )
}

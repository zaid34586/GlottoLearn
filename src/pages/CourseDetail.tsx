import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Badge, PageLoader, EmptyState } from '../components/ui'
import { formatINR, formatDate } from '../lib/utils'
import { startCheckout, isDemoPayments } from '../lib/payments'
import { getLangTheme } from '../lib/langTheme'
import type { Course, Batch } from '../lib/types'

interface SyllabusRow { module_title: string; module_position: number; lesson_title: string | null; lesson_position: number | null }

export default function CourseDetail() {
  const { courseId } = useParams()
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [syllabus, setSyllabus] = useState<SyllabusRow[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [enrolled, setEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    Promise.all([
      supabase.from('courses').select('*, language:languages(*), teacher:profiles!courses_teacher_id_fkey(*)').eq('id', courseId).single(),
      supabase.rpc('get_course_syllabus', { p_course_id: courseId }),
      supabase.from('batches').select('*, course:courses(title)').eq('course_id', courseId).in('status', ['scheduled', 'live']).gte('scheduled_at', new Date(Date.now() - 2 * 3600_000).toISOString()).order('scheduled_at'),
    ]).then(async ([c, s, b]) => {
      setCourse((c.data as unknown as Course) ?? null)
      setSyllabus((s.data as SyllabusRow[]) ?? [])
      setBatches((b.data as unknown as Batch[]) ?? [])
      if (session && c.data) {
        const { data: e } = await supabase.from('enrollments').select('id').eq('course_id', courseId).eq('student_id', session.user.id).maybeSingle()
        setEnrolled(!!e)
      }
      setLoading(false)
    })
  }, [courseId, session])

  async function buy() {
    if (!session || !course || !profile) {
      navigate('/login', { state: { from: `/courses/${courseId}` } })
      return
    }
    if (course.price_inr === 0) {
      // Free course — enroll directly
      const { error } = await supabase.from('enrollments').insert({ course_id: course.id, student_id: session.user.id })
      if (error && !error.message.includes('duplicate')) return setMessage(error.message)
      setEnrolled(true)
      navigate(`/learn/${course.id}`)
      return
    }
    setBuying(true)
    await startCheckout({
      course,
      studentName: profile.full_name,
      studentEmail: session.user.email ?? '',
      userId: session.user.id,
      onPaid: async (paymentId) => {
        const { error } = await supabase.from('enrollments').insert({ course_id: course.id, student_id: session.user.id, payment_id: paymentId })
        setBuying(false)
        if (error && !error.message.includes('duplicate')) return setMessage(error.message)
        navigate(`/learn/${course.id}`)
      },
      onError: (msg) => { setBuying(false); setMessage(msg) },
    })
  }

  if (loading) return <PageLoader />
  if (!course) return <div className="mx-auto max-w-6xl px-4 py-16"><EmptyState icon="🫥" title="Course not found" action={<Link to="/courses" className="btn-ghost mt-2">Back to courses</Link>} /></div>

  const modules = Array.from(new Set(syllabus.map((s) => s.module_position)))
  const t = getLangTheme(course.language)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Language-themed hero strip */}
      <div className={`relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br ${t.gradient} p-8 md:p-10`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <span className="font-display absolute -bottom-6 right-6 select-none text-7xl font-black italic text-slate-200 md:text-8xl">{t.greeting}</span>
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-slate-900 backdrop-blur">{t.flag} {t.word}</span>
            <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-slate-900 backdrop-blur">{course.level}</span>
            <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-slate-900 backdrop-blur">{formatINR(course.price_inr)}</span>
          </div>
          <h1 className="font-display mt-4 max-w-2xl text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl md:text-5xl">{course.title}</h1>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <p className="leading-relaxed text-slate-500">{course.description || 'A complete guided course with live classes, recorded lessons, quizzes and materials.'}</p>

          {course.teacher && (
            <div className="glass mt-6 flex items-center gap-4 rounded-2xl p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-bold text-slate-900">
                {course.teacher.full_name?.[0]?.toUpperCase() ?? 'T'}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{course.teacher.full_name}</p>
                <p className="text-sm text-slate-400">Your teacher for this course</p>
              </div>
            </div>
          )}

          {/* Syllabus */}
          <h2 className="font-display mt-8 text-xl font-bold text-slate-900">What you'll learn</h2>
          <div className="mt-4 space-y-3">
            {modules.length === 0 && <p className="text-sm text-slate-400">Syllabus coming soon.</p>}
            {modules.map((pos) => {
              const rows = syllabus.filter((s) => s.module_position === pos)
              return (
                <div key={pos} className="glass rounded-2xl p-5">
                  <h3 className="font-display font-bold text-slate-900">{rows[0].module_title}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {rows.filter((r) => r.lesson_title).map((r) => (
                      <li key={r.lesson_title} className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="text-indigo-600">▸</span> {r.lesson_title}
                      </li>
                    ))}
                    {rows.every((r) => !r.lesson_title) && <li className="text-sm text-slate-400">Lessons will be published soon.</li>}
                  </ul>
                </div>
              )
            })}
          </div>

          {/* Upcoming live classes */}
          {batches.length > 0 && (
            <>
              <h2 className="font-display mt-8 text-xl font-bold text-slate-900">Upcoming live classes</h2>
              <div className="mt-4 space-y-2">
                {batches.map((b) => (
                  <div key={b.id} className="glass flex items-center justify-between rounded-xl px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{b.title}</p>
                      <p className="text-xs text-slate-400">{formatDate(b.scheduled_at)} · {b.duration_min} min</p>
                    </div>
                    <Badge tone={b.status === 'live' ? 'green' : 'indigo'}>{b.status === 'live' ? '🔴 LIVE' : 'Scheduled'}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Purchase card */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass-strong rounded-2xl p-6">
            <div className={`relative mb-4 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${t.gradient}`}>
              {course.cover_url ? (
                <img src={course.cover_url} alt={course.title} className="h-full w-full object-cover" />
              ) : (
                <>
                  <span className="text-6xl drop-shadow-lg">{t.flag}</span>
                  <span className="font-display absolute bottom-2 left-3 text-2xl font-black italic text-slate-300">{t.greeting}</span>
                </>
              )}
            </div>
            <p className="font-display text-3xl font-extrabold text-gradient">{formatINR(course.price_inr)}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-500">
              <li>✓ Live classes inside the app</li>
              <li>✓ Recorded lessons, watch anytime</li>
              <li>✓ Quizzes with instant results</li>
              <li>✓ Downloadable study material</li>
              <li>✓ Lifetime access to this course</li>
            </ul>
            {enrolled ? (
              <Link to={`/learn/${course.id}`} className="btn-primary mt-6 w-full">Continue Learning →</Link>
            ) : (
              <button className="btn-primary mt-6 w-full" disabled={buying} onClick={buy}>
                {buying ? 'Processing…' : course.price_inr === 0 ? 'Enroll for Free' : 'Buy & Enroll Now'}
              </button>
            )}
            {isDemoPayments && course.price_inr > 0 && (
              <p className="mt-3 text-center text-[11px] text-amber-600">⚠ Demo payment mode — connect Paddle for live checkout.</p>
            )}
            {message && <p className="mt-3 text-center text-sm text-red-600">{message}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

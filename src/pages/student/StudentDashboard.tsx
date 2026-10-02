import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { StatCard, Progress, Badge, PageLoader } from '../../components/ui'
import { formatDate, timeUntil } from '../../lib/utils'
import type { Enrollment, Batch } from '../../lib/types'

export default function StudentDashboard() {
  const { session, profile, role } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [upcoming, setUpcoming] = useState<Batch[]>([])
  const [completed, setCompleted] = useState(0)
  const [totalLessons, setTotalLessons] = useState(0)
  const [pctByCourse, setPctByCourse] = useState<Record<string, number>>({})
  const [totalByCourse, setTotalByCourse] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    Promise.all([
      supabase.from('enrollments').select('*, course:courses(*, language:languages(*))').eq('student_id', uid),
      supabase.from('batches').select('*, course:courses(title)').in('status', ['scheduled', 'live']).order('scheduled_at').limit(5),
      supabase.from('lesson_progress').select('completed, lessons(course_id)').eq('student_id', uid),
      supabase.from('lessons').select('course_id'),
    ]).then(([e, b, p, l]) => {
      setEnrollments((e.data as unknown as Enrollment[]) ?? [])
      setUpcoming((b.data as unknown as Batch[]) ?? [])
      const progress = (p.data as unknown as { completed: boolean; lessons: { course_id: string } }[]) ?? []
      setCompleted(progress.filter((r) => r.completed).length)
      setTotalLessons((l.data?.length) ?? 0)
      const doneBy: Record<string, number> = {}
      const totalBy: Record<string, number> = {}
      for (const r of ((l.data as unknown as { course_id: string }[]) ?? [])) totalBy[r.course_id] = (totalBy[r.course_id] ?? 0) + 1
      for (const r of progress) {
        if (!r.completed) continue
        const cid = r.lessons?.course_id
        if (cid) doneBy[cid] = (doneBy[cid] ?? 0) + 1
      }
      setPctByCourse(doneBy)
      setTotalByCourse(totalBy)
      setLoading(false)
    })
  }, [session])

  if (loading) return <PageLoader />
  const overall = totalLessons ? Math.round((completed / totalLessons) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl">
      {/* Role-themed welcome banner */}
      <div className="glass relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--role-accent, #2dd4bf)' }} />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-44 w-44 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--role-accent-2, #38bdf8)' }} />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--role-accent, #2dd4bf)' }}>
              Student · Learning Studio
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold text-slate-900 md:text-4xl">
              Hi {profile?.full_name?.split(' ')[0]}, ready to <span className="text-gradient italic">practice</span>?
            </h1>
            <p className="mt-2 text-sm text-slate-500">Your courses, classes and progress — all in one place.</p>
          </div>
          <Link to="/courses" className="btn-primary">+ Explore Courses</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Enrolled Courses" value={enrollments.length} icon="📚" />
        <StatCard label="Lessons Completed" value={completed} icon="✅" accent="bg-emerald-500/15 text-emerald-600" />
        <StatCard label="Overall Progress" value={`${overall}%`} icon="📈" accent="bg-amber-500/15 text-amber-600" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Continue learning */}
        <section>
          <h2 className="font-display mb-4 text-lg font-bold text-slate-900">Continue Learning</h2>
          {enrollments.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-3xl">🚀</p>
              <p className="mt-2 font-semibold text-slate-900">You haven't enrolled yet</p>
              <p className="mt-1 text-sm text-slate-500">Browse the catalog and start your first course today.</p>
              <Link to="/courses" className="btn-primary mt-4">Browse Courses</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {enrollments.map((e) => (
                <Link key={e.id} to={`/learn/${e.course_id}`} className="glass glass-hover flex items-center gap-4 rounded-2xl p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/30 text-2xl">
                    🌍
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{e.course?.title}</p>
                    <p className="text-xs text-slate-400">{e.course?.language?.name} · {e.course?.level}</p>
                    <div className="mt-2">
                      <Progress value={totalByCourse[e.course_id] ? Math.round(((pctByCourse[e.course_id] ?? 0) / totalByCourse[e.course_id]) * 100) : 0} />
                    </div>
                  </div>
                  <span className="text-indigo-600">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming live classes */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">Live Classes</h2>
            <Link to="/live-classes" className="text-xs font-semibold text-indigo-600">See all →</Link>
          </div>
          <div className="space-y-3">
            {upcoming.length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-slate-400">No live classes scheduled yet.</div>}
            {upcoming.map((b) => (
              <Link key={b.id} to={`/live/${b.id}`} className="glass glass-hover block rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{(b as any).course?.title ?? b.title}</p>
                  {b.status === 'live' ? <Badge tone="green">🔴 LIVE</Badge> : <Badge tone="indigo">{timeUntil(b.scheduled_at)}</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-400">{b.title} · {formatDate(b.scheduled_at)}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {role === 'admin' && (
        <p className="mt-8 text-xs text-slate-400">You are signed in as admin — the admin panel is available in the sidebar.</p>
      )}
    </div>
  )
}

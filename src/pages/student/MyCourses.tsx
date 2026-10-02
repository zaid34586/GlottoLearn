import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Progress, PageLoader, EmptyState, Badge } from '../../components/ui'
import { formatDateOnly } from '../../lib/utils'
import type { Enrollment } from '../../lib/types'

export default function MyCourses() {
  const { session } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [pctByCourse, setPctByCourse] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    Promise.all([
      supabase.from('enrollments').select('*, course:courses(*, language:languages(*))').eq('student_id', uid).order('enrolled_at', { ascending: false }),
      supabase.from('lesson_progress').select('completed, lessons(course_id)').eq('student_id', uid),
      supabase.from('lessons').select('course_id'),
    ]).then(([e, p, l]) => {
      const progress = (p.data as unknown as { completed: boolean; lessons: { course_id: string } }[]) ?? []
      const doneBy: Record<string, number> = {}
      const totalBy: Record<string, number> = {}
      for (const r of ((l.data as unknown as { course_id: string }[]) ?? [])) totalBy[r.course_id] = (totalBy[r.course_id] ?? 0) + 1
      for (const r of progress) {
        if (!r.completed) continue
        const cid = r.lessons?.course_id
        if (cid) doneBy[cid] = (doneBy[cid] ?? 0) + 1
      }
      const pct: Record<string, number> = {}
      for (const cid of Object.keys(totalBy)) pct[cid] = Math.round(((doneBy[cid] ?? 0) / totalBy[cid]) * 100)
      setEnrollments((e.data as unknown as Enrollment[]) ?? [])
      setPctByCourse(pct)
      setLoading(false)
    })
  }, [session])

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-white">My Courses</h1>
      <p className="mt-1 text-sm text-white/50">Everything you're enrolled in.</p>
      {enrollments.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="📚"
            title="No courses yet"
            hint="Enroll in your first course and it will appear here."
            action={<Link to="/courses" className="btn-primary mt-2">Browse Courses</Link>}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e) => {
            const pct = pctByCourse[e.course_id] ?? 0
            return (
              <Link key={e.id} to={`/learn/${e.course_id}`} className="glass glass-hover flex flex-col rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-display line-clamp-2 font-bold text-white">{e.course?.title}</h3>
                  {pct === 100 && <Badge tone="green">DONE</Badge>}
                </div>
                <p className="mt-1 text-xs text-white/45">{e.course?.language?.name} · {e.course?.level} · enrolled {formatDateOnly(e.enrolled_at)}</p>
                <div className="mt-4 flex-1">
                  <div className="mb-1.5 flex justify-between text-xs text-white/50">
                    <span>Progress</span><span className="font-semibold text-white">{pct}%</span>
                  </div>
                  <Progress value={pct} />
                </div>
                <span className="mt-4 text-sm font-semibold text-indigo-300">Continue →</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

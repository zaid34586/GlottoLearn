import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Badge, PageLoader, EmptyState } from '../../components/ui'
import { formatDate, timeUntil } from '../../lib/utils'
import type { Batch } from '../../lib/types'

export default function LiveClasses() {
  const { session } = useAuth()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    // Batches for courses the student is enrolled in (RLS on batches is open to
    // authenticated users; we filter by enrollment client-side).
    supabase
      .from('batches')
      .select('*, course:courses(title, id)')
      .in('status', ['scheduled', 'live'])
      .order('scheduled_at')
      .then(async ({ data }) => {
        const all = (data as unknown as Batch[]) ?? []
        const { data: enr } = await supabase.from('enrollments').select('course_id').eq('student_id', session.user.id)
        const ids = new Set((enr ?? []).map((r) => r.course_id))
        setBatches(all.filter((b) => ids.has((b.course as any)?.id)))
        setLoading(false)
      })
  }, [session])

  if (loading) return <PageLoader />

  const now = Date.now()

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white">Live Classes</h1>
      <p className="mt-1 text-sm text-white/50">Join your scheduled classes right inside the app.</p>
      {batches.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="🎥" title="No live classes scheduled" hint="When your teacher schedules a class, it will appear here." />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {batches.map((b) => {
            const start = new Date(b.scheduled_at).getTime()
            const canJoin = b.status === 'live' || (start - now < 15 * 60_000 && start - now > -b.duration_min * 60_000)
            return (
              <div key={b.id} className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{b.title}</p>
                    {b.status === 'live' ? <Badge tone="green">🔴 LIVE NOW</Badge> : <Badge tone="indigo">{timeUntil(b.scheduled_at)}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-white/45">{(b as any).course?.title} · {formatDate(b.scheduled_at)} · {b.duration_min} min</p>
                </div>
                {canJoin ? (
                  <Link to={`/live/${b.id}`} className="btn-primary">Join Class →</Link>
                ) : (
                  <span className="text-xs text-white/40">Join window opens 15 min before start</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

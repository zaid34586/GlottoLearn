import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Badge, PageLoader, EmptyState } from '../../components/ui'
import { formatDate, timeUntil } from '../../lib/utils'
import type { Batch, BatchEnrollment } from '../../lib/types'

export default function LiveClasses() {
  const { session } = useAuth()
  const [myBatches, setMyBatches] = useState<Batch[]>([])
  const [slots, setSlots] = useState<(Batch & { taken: number })[]>([])
  const [reserving, setReserving] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    load()
  }, [session])

  async function load() {
    if (!session) return
    setLoading(true)
    // batches for courses the student is enrolled in
    const { data: enr } = await supabase.from('enrollments').select('course_id').eq('student_id', session.user.id)
    const courseIds = (enr ?? []).map((r) => r.course_id as string)

    const { data: batchData } = await supabase
      .from('batches')
      .select('*, course:courses(title, id)')
      .in('course_id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000'])
      .in('status', ['scheduled', 'live'])
      .order('scheduled_at')
    const all = (batchData as unknown as Batch[]) ?? []

    // my seat bookings + seat counts per batch
    const { data: mine } = await supabase.from('batch_enrollments').select('batch_id').eq('student_id', session.user.id)
    const mineSet = new Set((mine ?? []).map((r) => r.batch_id as string))

    const { data: counts } = await supabase.from('batch_enrollments').select('batch_id')
    const takenMap = new Map<string, number>()
    for (const r of (counts ?? []) as BatchEnrollment[]) {
      takenMap.set(r.batch_id, (takenMap.get(r.batch_id) ?? 0) + 1)
    }

    setMyBatches(all.filter((b) => mineSet.has(b.id)))
    setSlots(
      all
        .filter((b) => !mineSet.has(b.id))
        .filter((b) => (takenMap.get(b.id) ?? 0) < (b.max_students ?? 10))
        .map((b) => ({ ...b, taken: takenMap.get(b.id) ?? 0 })),
    )
    setLoading(false)
  }

  async function reserve(b: Batch) {
    if (!session) return
    setReserving(b.id)
    setMessage(null)
    const { error } = await supabase.from('batch_enrollments').insert({ batch_id: b.id, student_id: session.user.id })
    setReserving(null)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage(`Seat booked for "${b.title}" — see it in My Live Classes below.`)
    load()
  }

  if (loading) return <PageLoader />

  const now = Date.now()

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-slate-900">Live Classes</h1>
      <p className="mt-1 text-sm text-slate-500">Pick a batch time that suits you, then join the class inside the app.</p>
      {message && <p className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700">{message}</p>}

      {/* My booked batches */}
      <h2 className="font-display mt-8 mb-3 text-lg font-bold text-slate-900">My Live Classes</h2>
      {myBatches.length === 0 ? (
        <EmptyState icon="🗓️" title="No seat booked yet" hint="Choose a slot below to reserve your seat." />
      ) : (
        <div className="space-y-3">
          {myBatches.map((b) => {
            const start = new Date(b.scheduled_at).getTime()
            const canJoin = b.status === 'live' || (start - now < 15 * 60_000 && start - now > -b.duration_min * 60_000)
            return (
              <div key={b.id} className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{b.title}</p>
                    {b.status === 'live' ? <Badge tone="green">🔴 LIVE NOW</Badge> : <Badge tone="indigo">{timeUntil(b.scheduled_at)}</Badge>}
                    <Badge tone="green">✓ Seat confirmed</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{(b as any).course?.title} · {formatDate(b.scheduled_at)} · {b.duration_min} min</p>
                </div>
                {canJoin ? (
                  <Link to={`/live/${b.id}`} className="btn-primary">Join Class →</Link>
                ) : (
                  <span className="text-xs text-slate-400">Join window opens 15 min before start</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Slot picker */}
      {slots.length > 0 && (
        <>
          <h2 className="font-display mt-10 mb-3 text-lg font-bold text-slate-900">Choose a Batch Time</h2>
          <p className="-mt-1 mb-3 text-xs text-slate-400">Seats are limited — pick the slot that fits your schedule. Live class replays are visible only to that batch.</p>
          <div className="space-y-3">
            {slots.map((b) => {
              const max = b.max_students ?? 10
              const left = max - b.taken
              return (
                <div key={b.id} className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{b.title}</p>
                      <Badge tone={left <= 3 ? 'amber' : 'slate'}>{left} / {max} seats left</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{(b as any).course?.title} · {formatDate(b.scheduled_at)} · {b.duration_min} min</p>
                  </div>
                  <button className="btn-primary !py-2" disabled={reserving === b.id} onClick={() => reserve(b)}>
                    {reserving === b.id ? 'Booking…' : 'Reserve Seat'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

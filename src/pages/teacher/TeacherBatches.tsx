import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader, EmptyState, Badge, Modal } from '../../components/ui'
import { formatDate } from '../../lib/utils'
import type { Batch, Course } from '../../lib/types'

export default function TeacherBatches() {
  const { session, profile } = useAuth()
  const [batches, setBatches] = useState<Batch[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ course_id: '', title: '', date: '', time: '', duration_min: '60' })

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('batches').select('*, course:courses(title)').eq('teacher_id', profile.id).order('scheduled_at', { ascending: false }),
      supabase.from('courses').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }),
    ]).then(([b, c]) => {
      setBatches((b.data as unknown as Batch[]) ?? [])
      setCourses((c.data as Course[]) ?? [])
      setLoading(false)
    })
  }, [profile])

  async function refresh() {
    if (!profile) return
    const { data } = await supabase.from('batches').select('*, course:courses(title)').eq('teacher_id', profile.id).order('scheduled_at', { ascending: false })
    setBatches((data as unknown as Batch[]) ?? [])
  }

  async function createBatch(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    const scheduled_at = new Date(`${form.date}T${form.time}`).toISOString()
    const { error } = await supabase.from('batches').insert({
      course_id: form.course_id,
      teacher_id: profile.id,
      title: form.title,
      scheduled_at,
      duration_min: Number(form.duration_min) || 60,
    })
    if (error) return setError(error.message)
    setShowCreate(false)
    setForm({ course_id: '', title: '', date: '', time: '', duration_min: '60' })
    refresh()
  }

  async function cancelBatch(id: string) {
    await supabase.from('batches').update({ status: 'cancelled' }).eq('id', id)
    refresh()
  }

  if (loading) return <PageLoader />

  const upcoming = batches.filter((b) => b.status === 'scheduled' || b.status === 'live')
  const past = batches.filter((b) => b.status === 'completed' || b.status === 'cancelled')

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Batches & Classes</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule live classes. Students join inside the app — no Zoom needed.</p>
        </div>
        <button className="btn-primary" disabled={courses.length === 0} onClick={() => setShowCreate(true)}>+ Schedule Class</button>
      </div>
      {courses.length === 0 && <p className="mt-4 text-sm text-amber-600">Create a course first — classes belong to a course.</p>}

      <h2 className="font-display mt-8 mb-4 text-lg font-bold text-slate-900">Upcoming</h2>
      {upcoming.length === 0 ? (
        <EmptyState icon="🗓️" title="Nothing scheduled" hint="Schedule your next live class from the button above." />
      ) : (
        <div className="space-y-3">
          {upcoming.map((b) => (
            <div key={b.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{b.title}</p>
                  {b.status === 'live' ? <Badge tone="green">🔴 LIVE</Badge> : <Badge tone="indigo">Scheduled</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{(b as any).course?.title} · {formatDate(b.scheduled_at)} · {b.duration_min} min</p>
              </div>
              <div className="flex gap-2">
                {b.status === 'live'
                  ? <Link to={`/live/${b.id}`} className="btn-primary !py-2">Enter Classroom →</Link>
                  : <Link to={`/live/${b.id}`} className="btn-ghost !py-2">Room</Link>}
                <button className="btn-danger !py-2" onClick={() => cancelBatch(b.id)}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="font-display mt-8 mb-4 text-lg font-bold text-slate-900">Past</h2>
          <div className="space-y-2">
            {past.map((b) => (
              <div key={b.id} className="glass flex items-center justify-between rounded-xl px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{b.title}</p>
                  <p className="text-xs text-slate-400">{(b as any).course?.title} · {formatDate(b.scheduled_at)}</p>
                </div>
                <Badge tone={b.status === 'completed' ? 'slate' : 'red'}>{b.status.toUpperCase()}</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Schedule a Live Class">
        <form onSubmit={createBatch} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Course</label>
            <select className="field" required value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">Select course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Class title</label>
            <input className="field" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Lesson 5 — Everyday Conversations" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Date</label>
              <input className="field" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Time</label>
              <input className="field" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Minutes</label>
              <input className="field" type="number" min="15" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full">Schedule Class</button>
          <p className="text-center text-xs text-slate-400">Students will see this in their Live Classes section and can join in-app.</p>
        </form>
      </Modal>
    </div>
  )
}

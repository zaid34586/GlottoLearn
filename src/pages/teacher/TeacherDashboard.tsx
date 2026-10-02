import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { StatCard, PageLoader, EmptyState, Badge, Modal } from '../../components/ui'
import { formatINR, formatDate, LEVELS } from '../../lib/utils'
import type { Course, Language, Batch, Profile, Enrollment } from '../../lib/types'

export default function TeacherDashboard() {
  const { session, profile } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [enrollCount, setEnrollCount] = useState(0)
  const [students, setStudents] = useState<Profile[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', language_id: '', level: 'Beginner', price_inr: '0' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session || !profile) return
    const isTeacherOnly = profile.role === 'teacher'
    let courseQuery = supabase.from('courses').select('*, language:languages(*), teacher:profiles!courses_teacher_id_fkey(*)').order('created_at', { ascending: false })
    if (isTeacherOnly) courseQuery = courseQuery.eq('teacher_id', profile.id)

    Promise.all([
      courseQuery,
      supabase.from('batches').select('*, course:courses(title)').eq('teacher_id', profile.id).in('status', ['scheduled', 'live']).order('scheduled_at'),
      supabase.from('languages').select('*').eq('is_active', true).order('name'),
      supabase.from('enrollments').select('course_id'),
      supabase.from('profiles').select('*').eq('role', 'student'),
    ]).then(([c, b, l, e, s]) => {
      const myCourses = (c.data as unknown as Course[]) ?? []
      setCourses(myCourses)
      const myIds = new Set(myCourses.map((x) => x.id))
      setEnrollCount(((e.data ?? []) as any[]).filter((r) => myIds.has(r.course_id)).length)
      setBatches((b.data as unknown as Batch[]) ?? [])
      setLanguages((l.data as Language[]) ?? [])
      setStudents((s.data as Profile[]) ?? [])
      setLoading(false)
    })
  }, [session, profile])

  async function createCourse(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    const { error } = await supabase.from('courses').insert({
      title: form.title,
      description: form.description,
      language_id: form.language_id ? Number(form.language_id) : null,
      level: form.level,
      price_inr: Number(form.price_inr) || 0,
      teacher_id: profile.id,
      status: 'draft',
    })
    if (error) return setError(error.message)
    setShowCreate(false)
    setForm({ title: '', description: '', language_id: '', level: 'Beginner', price_inr: '0' })
    const { data } = await supabase.from('courses').select('*, language:languages(*), teacher:profiles!courses_teacher_id_fkey(*)').eq('teacher_id', profile.id).order('created_at', { ascending: false })
    setCourses((data as unknown as Course[]) ?? [])
  }

  if (loading) return <PageLoader />

  const enrolledByCourse: Record<string, Enrollment[]> = {}
  void enrolledByCourse

  return (
    <div className="mx-auto max-w-6xl">
      {/* Role-themed welcome banner */}
      <div className="glass relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--role-accent, #fbbf24)' }} />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-44 w-44 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--role-accent-2, #fb923c)' }} />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--role-accent, #fbbf24)' }}>
              Teacher · Studio
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold text-white md:text-4xl">
              Welcome, <span className="text-gradient italic">{profile?.full_name?.split(' ')[0]}</span>
            </h1>
            <p className="mt-2 text-sm text-white/50">Build courses, schedule classes and inspire your students.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Course</button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="My Courses" value={courses.length} icon="📚" />
        <StatCard label="Enrolled Students" value={enrollCount} icon="👥" accent="bg-emerald-500/15 text-emerald-300" />
        <StatCard label="Upcoming Classes" value={batches.length} icon="🗓️" accent="bg-amber-500/15 text-amber-300" />
      </div>

      {/* Courses */}
      <h2 className="font-display mt-8 mb-4 text-lg font-bold text-white">My Courses</h2>
      {courses.length === 0 ? (
        <EmptyState icon="📚" title="No courses yet" hint="Create your first course, add lessons and publish it." action={<button className="btn-primary mt-2" onClick={() => setShowCreate(true)}>+ New Course</button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => (
            <Link key={c.id} to={`/teach/courses/${c.id}`} className="glass glass-hover rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display truncate font-bold text-white">{c.title}</h3>
                  <p className="mt-0.5 text-xs text-white/45">{c.language?.name} · {c.level}</p>
                </div>
                <Badge tone={c.status === 'published' ? 'green' : 'slate'}>{c.status.toUpperCase()}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-white/50">{c.description || 'No description yet.'}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-gradient">{formatINR(c.price_inr)}</span>
                <span className="text-xs font-semibold text-indigo-300">Manage →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Next classes */}
      <h2 className="font-display mt-8 mb-4 text-lg font-bold text-white">Next Classes</h2>
      <div className="space-y-3">
        {batches.length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-white/45">No classes scheduled. Go to Batches to schedule one.</div>}
        {batches.slice(0, 5).map((b) => (
          <div key={b.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white">{b.title}</p>
                {b.status === 'live' ? <Badge tone="green">🔴 LIVE</Badge> : <Badge tone="indigo">Scheduled</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-white/45">{(b as any).course?.title} · {formatDate(b.scheduled_at)}</p>
            </div>
            {b.status === 'live'
              ? <Link to={`/live/${b.id}`} className="btn-primary !py-2">Enter Classroom →</Link>
              : <Link to={`/live/${b.id}`} className="btn-ghost !py-2">Open Room</Link>}
          </div>
        ))}
      </div>

      {/* Students list */}
      <h2 className="font-display mt-8 mb-4 text-lg font-bold text-white">Students ({students.length} on platform)</h2>
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
            <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Joined</th></tr>
          </thead>
          <tbody>
            {students.slice(0, 8).map((s) => (
              <tr key={s.id} className="border-b border-white/5 last:border-0">
                <td className="px-5 py-3 text-white/80">{s.full_name}</td>
                <td className="px-5 py-3 text-white/40">{formatDate(s.created_at)}</td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={2} className="px-5 py-6 text-center text-white/40">No students yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create course modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Course">
        <form onSubmit={createCourse} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Title</label>
            <input className="field" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="French for Beginners" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Description</label>
            <textarea className="field min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will students learn?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Language</label>
              <select className="field" value={form.language_id} onChange={(e) => setForm({ ...form, language_id: e.target.value })}>
                <option value="">Select…</option>
                {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Level</label>
              <select className="field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Price (₹, 0 = free)</label>
            <input className="field" type="number" min="0" value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button className="btn-primary w-full">Create Course</button>
          <p className="text-center text-xs text-white/35">Course starts as draft — add content, then publish from the builder.</p>
        </form>
      </Modal>
    </div>
  )
}

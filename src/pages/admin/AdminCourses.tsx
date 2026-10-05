import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageLoader, EmptyState, Badge, Modal } from '../../components/ui'
import { CoverUpload } from '../../components/MediaUpload'
import { formatINR, LEVELS } from '../../lib/utils'
import type { Course, Language, Profile } from '../../lib/types'

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', language_id: '', level: 'Beginner', price_inr: '0', teacher_id: '', cover_url: '' })

  async function load() {
    const [c, p, l] = await Promise.all([
      supabase.from('courses').select('*, language:languages(*), teacher:profiles!courses_teacher_id_fkey(*)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').in('role', ['teacher', 'admin']).order('full_name'),
      supabase.from('languages').select('*').order('name'),
    ])
    setCourses((c.data as unknown as Course[]) ?? [])
    setTeachers((p.data as Profile[]) ?? [])
    setLanguages((l.data as Language[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createCourse(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.from('courses').insert({
      title: form.title,
      description: form.description,
      language_id: form.language_id ? Number(form.language_id) : null,
      level: form.level,
      price_inr: Number(form.price_inr) || 0,
      cover_url: form.cover_url || null,
      teacher_id: form.teacher_id || null,
      status: 'draft',
    })
    if (error) return setError(error.message)
    setShowCreate(false)
    setForm({ title: '', description: '', language_id: '', level: 'Beginner', price_inr: '0', teacher_id: '', cover_url: '' })
    load()
  }

  async function setStatus(course: Course, status: Course['status']) {
    await supabase.from('courses').update({ status }).eq('id', course.id)
    load()
  }

  async function assignTeacher(course: Course, teacherId: string) {
    await supabase.from('courses').update({ teacher_id: teacherId || null }).eq('id', course.id)
    load()
  }

  async function setPrice(course: Course, price: string) {
    await supabase.from('courses').update({ price_inr: Number(price) || 0 }).eq('id', course.id)
    load()
  }

  async function setPaddlePrice(course: Course, priceId: string) {
    await supabase.from('courses').update({ paddle_price_id: priceId.trim() || null }).eq('id', course.id)
    load()
  }

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Course Manager</h1>
          <p className="mt-1 text-sm text-slate-500">Create, publish and control every course.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Course</button>
      </div>

      {courses.length === 0 ? (
        <div className="mt-8"><EmptyState icon="📚" title="No courses" hint="Create the first course and assign a teacher." /></div>
      ) : (
        <div className="mt-6 space-y-3">
          {courses.map((c) => (
            <div key={c.id} className="glass grid gap-4 rounded-2xl p-5 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display truncate font-bold text-slate-900">{c.title}</p>
                  <Badge tone={c.status === 'published' ? 'green' : 'slate'}>{c.status.toUpperCase()}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{c.language?.name ?? '—'} · {c.level} · Teacher: {c.teacher?.full_name ?? 'Unassigned'}</p>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Teacher</label>
                <select className="field !py-2" value={c.teacher_id ?? ''} onChange={(e) => assignTeacher(c, e.target.value)}>
                  <option value="">Unassigned</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Price (₹)</label>
                <input className="field !py-2" type="number" min="0" defaultValue={c.price_inr} onBlur={(e) => setPrice(c, e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Paddle Price ID</label>
                <input
                  className="field !py-2"
                  placeholder="pri_… (empty = demo)"
                  defaultValue={c.paddle_price_id ?? ''}
                  onBlur={(e) => {
                    if (e.target.value !== (c.paddle_price_id ?? '')) setPaddlePrice(c, e.target.value)
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/teach/courses/${c.id}`} className="btn-ghost !py-2" title="Upload lessons, modules and quizzes">📦 Content</Link>
                {c.status === 'published' ? (
                  <button className="btn-ghost !py-2" onClick={() => setStatus(c, 'draft')}>Unpublish</button>
                ) : (
                  <button className="btn-primary !py-2" onClick={() => setStatus(c, 'published')}>Publish</button>
                )}
                <button
                  className="btn-danger !py-2"
                  onClick={async () => {
                    if (confirm(`Delete course "${c.title}"? This removes its lessons, quizzes and enrollments.`)) {
                      await supabase.from('courses').delete().eq('id', c.id)
                      load()
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Course (Admin)">
        <form onSubmit={createCourse} className="space-y-4">
          <input className="field" required placeholder="Course title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="field min-h-20" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <select className="field" value={form.language_id} onChange={(e) => setForm({ ...form, language_id: e.target.value })}>
              <option value="">Language…</option>
              {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select className="field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="field" type="number" min="0" placeholder="Price ₹ (0 = free)" value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: e.target.value })} />
            <select className="field" value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
              <option value="">Assign teacher…</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.role})</option>)}
            </select>
          </div>
          <CoverUpload value={form.cover_url || null} onChange={(u) => setForm({ ...form, cover_url: u ?? '' })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full">Create Course</button>
        </form>
      </Modal>

      <p className="mt-6 text-xs text-slate-400">Total catalog value: {formatINR(courses.reduce((s, c) => s + Number(c.price_inr), 0))}</p>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { CourseCard } from '../components/CourseCard'
import { supabase } from '../lib/supabase'
import type { Course, Language } from '../lib/types'
import { EmptyState, PageLoader } from '../components/ui'
import { cn } from '../lib/utils'

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [activeLang, setActiveLang] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [nextClassByCourse, setNextClassByCourse] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Courses — GlottoLearn'
    Promise.all([
      supabase.from('courses').select('*, language:languages(*), teacher:profiles!courses_teacher_id_fkey(*)').eq('status', 'published').order('created_at', { ascending: false }),
      supabase.from('languages').select('*').eq('is_active', true).order('name'),
      supabase.from('batches').select('course_id, scheduled_at').in('status', ['scheduled', 'live']).gte('scheduled_at', new Date().toISOString()).order('scheduled_at'),
    ]).then(([c, l, b]) => {
      setCourses((c.data as unknown as Course[]) ?? [])
      setLanguages((l.data as Language[]) ?? [])
      const map = new Map<string, string>()
      for (const row of (b.data ?? []) as { course_id: string; scheduled_at: string }[]) {
        if (!map.has(row.course_id)) map.set(row.course_id, row.scheduled_at)
      }
      setNextClassByCourse(map)
      setLoading(false)
    })
  }, [])

  const kw = q.trim().toLowerCase()
  const searched = kw
    ? courses.filter((c) =>
        c.title.toLowerCase().includes(kw) ||
        (c.description ?? '').toLowerCase().includes(kw) ||
        (c.language?.name ?? '').toLowerCase().includes(kw) ||
        (c.teacher?.full_name ?? '').toLowerCase().includes(kw),
      )
    : courses
  const filtered = activeLang ? searched.filter((c) => c.language_id === activeLang) : searched

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">All Courses</h1>
          <p className="mt-1 text-slate-500">Pick a language and start your journey.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">🔍</span>
          <input
            className="field !pl-9"
            placeholder="Search courses, languages, teachers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveLang(null)}
          className={cn('rounded-full border px-4 py-1.5 text-sm font-semibold transition', !activeLang ? 'border-indigo-400/60 bg-indigo-500/20 text-slate-900' : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-900')}
        >
          All
        </button>
        {languages.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveLang(l.id)}
            className={cn('rounded-full border px-4 py-1.5 text-sm font-semibold transition', activeLang === l.id ? 'border-indigo-400/60 bg-indigo-500/20 text-slate-900' : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-900')}
          >
            {l.name}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="🔍" title="No courses found" hint="Try a different search word or language filter — new courses are added regularly." />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => <CourseCard key={c.id} course={c} nextClass={nextClassByCourse.get(c.id) ?? null} />)}
        </div>
      )}
    </div>
  )
}

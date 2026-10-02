import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { StatCard, PageLoader } from '../../components/ui'
import { formatINR } from '../../lib/utils'
import type { Course, Profile, Payment, Batch } from '../../lib/types'

export default function AdminOverview() {
  const [courses, setCourses] = useState<Course[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('*, language:languages(*)'),
      supabase.from('profiles').select('*'),
      supabase.from('payments').select('*').eq('status', 'paid'),
      supabase.from('batches').select('*').in('status', ['scheduled', 'live']),
    ]).then(([c, p, pay, b]) => {
      setCourses((c.data as unknown as Course[]) ?? [])
      setProfiles((p.data as Profile[]) ?? [])
      setPayments((pay.data as Payment[]) ?? [])
      setBatches((b.data as Batch[]) ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <PageLoader />

  const revenue = payments.reduce((s, p) => s + Number(p.amount), 0)
  const students = profiles.filter((p) => p.role === 'student').length
  const teachers = profiles.filter((p) => p.role === 'teacher').length
  const published = courses.filter((c) => c.status === 'published').length

  // revenue by course (simple bars)
  const byCourse: Record<string, number> = {}
  for (const p of payments) byCourse[p.course_id] = (byCourse[p.course_id] ?? 0) + Number(p.amount)
  const topCourses = Object.entries(byCourse).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxRev = topCourses[0]?.[1] ?? 1
  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? 'Course'

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Admin Overview</h1>
          <p className="mt-1 text-sm text-white/50">Full control of the platform.</p>
        </div>
        <Link to="/admin/courses" className="btn-primary">Manage Courses</Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Revenue" value={formatINR(revenue)} icon="💰" accent="bg-emerald-500/15 text-emerald-300" />
        <StatCard label="Students" value={students} icon="👥" />
        <StatCard label="Teachers" value={teachers} icon="🧑‍🏫" accent="bg-amber-500/15 text-amber-300" />
        <StatCard label="Published Courses" value={`${published}/${courses.length}`} icon="📚" accent="bg-fuchsia-500/15 text-fuchsia-300" />
        <StatCard label="Upcoming Classes" value={batches.length} icon="🗓️" accent="bg-sky-500/15 text-sky-300" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl p-6">
          <h2 className="font-display mb-4 text-lg font-bold text-white">Revenue by Course</h2>
          {topCourses.length === 0 ? <p className="text-sm text-white/40">No paid enrollments yet.</p> : (
            <div className="space-y-3">
              {topCourses.map(([cid, amt]) => (
                <div key={cid}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="truncate text-white/70">{courseTitle(cid)}</span>
                    <span className="font-semibold text-white">{formatINR(amt)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-amber-400" style={{ width: `${(amt / maxRev) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-display mb-4 text-lg font-bold text-white">Quick Actions</h2>
          <div className="grid gap-3">
            <Link to="/admin/courses" className="glass glass-hover rounded-xl px-4 py-3 text-sm font-semibold text-white">📚 Create / publish courses, assign teachers</Link>
            <Link to="/admin/people" className="glass glass-hover rounded-xl px-4 py-3 text-sm font-semibold text-white">👥 Promote teachers, manage users</Link>
            <Link to="/admin/payments" className="glass glass-hover rounded-xl px-4 py-3 text-sm font-semibold text-white">💳 Review transactions & export CSV</Link>
          </div>
        </section>
      </div>
    </div>
  )
}

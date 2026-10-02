import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader, Badge } from '../../components/ui'
import { formatDate } from '../../lib/utils'
import type { Profile } from '../../lib/types'

export default function AdminPeople() {
  const { profile: me, refreshProfile } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'student' | 'teacher' | 'admin'>('all')

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setPeople((data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function changeRole(p: Profile, role: Profile['role']) {
    await supabase.from('profiles').update({ role }).eq('id', p.id)
    if (me?.id === p.id) await refreshProfile()
    load()
  }

  const filtered = tab === 'all' ? people : people.filter((p) => p.role === tab)
  const counts = {
    all: people.length,
    student: people.filter((p) => p.role === 'student').length,
    teacher: people.filter((p) => p.role === 'teacher').length,
    admin: people.filter((p) => p.role === 'admin').length,
  }

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-slate-900">People Manager</h1>
      <p className="mt-1 text-sm text-slate-500">Promote teachers and manage platform users.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(['all', 'student', 'teacher', 'admin'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold capitalize transition ${tab === t ? 'border-indigo-400/60 bg-indigo-500/20 text-slate-900' : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-900'}`}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      <div className="glass mt-5 overflow-x-auto rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Change Role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">{p.full_name}</p>
                  <p className="text-xs text-slate-400">{p.id.slice(0, 8)}…</p>
                </td>
                <td className="px-5 py-3 text-slate-400">{formatDate(p.created_at)}</td>
                <td className="px-5 py-3">
                  <Badge tone={p.role === 'admin' ? 'red' : p.role === 'teacher' ? 'amber' : 'indigo'}>{p.role.toUpperCase()}</Badge>
                </td>
                <td className="px-5 py-3">
                  <select
                    className="field !w-36 !py-1.5"
                    value={p.role}
                    onChange={(e) => changeRole(p, e.target.value as Profile['role'])}
                  >
                    <option value="student">student</option>
                    <option value="teacher">teacher</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No users in this category.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

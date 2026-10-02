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
      <h1 className="font-display text-2xl font-bold text-white">People Manager</h1>
      <p className="mt-1 text-sm text-white/50">Promote teachers and manage platform users.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(['all', 'student', 'teacher', 'admin'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold capitalize transition ${tab === t ? 'border-indigo-400/60 bg-indigo-500/20 text-white' : 'border-white/15 bg-white/5 text-white/55 hover:text-white'}`}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      <div className="glass mt-5 overflow-x-auto rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Change Role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-white/5 last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium text-white/85">{p.full_name}</p>
                  <p className="text-xs text-white/35">{p.id.slice(0, 8)}…</p>
                </td>
                <td className="px-5 py-3 text-white/40">{formatDate(p.created_at)}</td>
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
            {filtered.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-white/40">No users in this category.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

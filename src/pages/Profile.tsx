import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Badge } from '../components/ui'

export default function Profile() {
  const { session, profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) setFullName(profile.full_name)
  }, [profile])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setBusy(true)
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', session.user.id)
    await refreshProfile()
    setBusy(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-white">My Profile</h1>
      <div className="glass mt-6 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 font-display text-2xl font-bold text-white">
            {fullName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-display text-lg font-bold text-white">{profile?.full_name}</p>
            <p className="text-sm text-white/50">{session?.user.email}</p>
            <div className="mt-1.5"><Badge tone={profile?.role === 'admin' ? 'red' : profile?.role === 'teacher' ? 'amber' : 'indigo'}>{profile?.role?.toUpperCase()}</Badge></div>
          </div>
        </div>
        <form onSubmit={save} className="mt-6 space-y-4 border-t border-white/10 pt-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Display name</label>
            <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
          {saved && <span className="ml-3 text-sm text-emerald-300">Saved ✓</span>}
        </form>
      </div>
    </div>
  )
}

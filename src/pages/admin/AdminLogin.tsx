import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

/** Dedicated admin portal sign-in — separate from the main app login */
export default function AdminLogin() {
  const { session, role, signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session && role === 'admin') return <Navigate to="/admin" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email, password)
    if (err) {
      setBusy(false)
      return setError(err)
    }
    // verify role — non-admins are signed out immediately
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null }
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if ((data as { role: string } | null)?.role !== 'admin') {
      await signOut()
      setBusy(false)
      return setError('Access denied. This account is not an administrator.')
    }
    setBusy(false)
    navigate('/admin', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* ambient orbs */}
      <div className="glow-orb left-[10%] top-[-10%] h-96 w-96 bg-rose-600/30" />
      <div className="glow-orb bottom-[-15%] right-[8%] h-[28rem] w-[28rem] bg-fuchsia-600/25" />
      <div className="glow-orb left-[45%] top-[55%] h-72 w-72 bg-indigo-600/20" />

      <div className="animate-fade-up relative w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-2xl shadow-lg shadow-rose-600/40">
              🔐
            </div>
            <h1 className="font-display mt-4 text-2xl font-bold text-white">Admin Portal</h1>
            <p className="mt-1 text-sm text-white/50">Restricted area — administrators only.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/40">Email</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-rose-400/60 focus:ring-2 focus:ring-rose-500/25"
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@glottolearn.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/40">Password</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-rose-400/60 focus:ring-2 focus:ring-rose-500/25"
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
            )}
            <button
              className="w-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/40 transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"
              disabled={busy}
            >
              {busy ? 'Verifying…' : 'Enter Admin Panel →'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-white/35">
          Student or teacher? <Link to="/login" className="font-semibold text-white/60 underline-offset-2 hover:underline">Sign in here</Link>
        </p>
      </div>
    </div>
  )
}

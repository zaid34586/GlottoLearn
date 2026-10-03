import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

/** Dedicated teacher portal sign-in — separate from the main app login */
export default function TeacherLogin() {
  const { session, role, signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session && role === 'teacher') return <Navigate to="/teach" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email, password)
    if (err) {
      setBusy(false)
      return setError(err)
    }
    // verify role — non-teachers are signed out immediately
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const r = (data as { role: string } | null)?.role
    if (r === 'admin') {
      await signOut()
      setBusy(false)
      return setError('This is an administrator account — use the Admin Portal instead.')
    }
    if (r !== 'teacher') {
      await signOut()
      setBusy(false)
      return setError('Access denied. This account is not a teacher account.')
    }
    setBusy(false)
    navigate('/teach', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* ambient orbs */}
      <div className="glow-orb left-[10%] top-[-10%] h-96 w-96 bg-amber-500/30" />
      <div className="glow-orb bottom-[-15%] right-[8%] h-[28rem] w-[28rem] bg-orange-600/25" />
      <div className="glow-orb left-[45%] top-[55%] h-72 w-72 bg-teal-600/20" />

      <div className="animate-fade-up relative w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl shadow-lg shadow-amber-500/40">
              🎓
            </div>
            <h1 className="font-display mt-4 text-2xl font-bold text-white">Teacher Portal</h1>
            <p className="mt-1 text-sm text-white/50">Sign in to build courses and teach live.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/40">Email</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-500/25"
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@glottolearn.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/40">Password</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-500/25"
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
            )}
            <button
              className="w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/40 transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"
              disabled={busy}
            >
              {busy ? 'Verifying…' : 'Enter Teacher Studio →'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-white/35">
          Not a teacher? <Link to="/login" className="font-semibold text-white/60 underline-offset-2 hover:underline">Student sign in here</Link>
          <span className="mx-2">·</span>
          <Link to="/admin/login" className="font-semibold text-white/60 underline-offset-2 hover:underline">Admin Portal</Link>
        </p>
      </div>
    </div>
  )
}

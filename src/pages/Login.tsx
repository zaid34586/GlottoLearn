import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email, password)
    if (err) {
      setBusy(false)
      return setError(err)
    }
    // Admins must use the dedicated admin portal
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') {
        await signOut()
        setBusy(false)
        return setError('Admin accounts sign in from the Admin Portal — use the button below.')
      }
    }
    setBusy(false)
    navigate(location.state?.from ?? '/dashboard')
  }

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center px-4">
      <div className="glow-orb left-1/4 top-10 h-72 w-72 bg-indigo-600/40" />
      <div className="glass-strong relative w-full max-w-md rounded-3xl p-8 animate-fade-up">
        <h1 className="font-display text-2xl font-bold text-slate-900">Welcome back 👋</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to continue your learning journey.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email</label>
            <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Password</label>
            <input className="field" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && (
            <div>
              <p className="rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2 text-sm text-red-600">{error}</p>
              {error.includes('Admin Portal') && (
                <Link to="/admin/login" className="mt-2 block text-center text-sm font-bold text-rose-600 hover:underline">
                  Go to Admin Portal →
                </Link>
              )}
            </div>
          )}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          New to GlottoLearn? <Link to="/signup" className="font-semibold text-indigo-600 hover:text-indigo-600">Create an account</Link>
        </p>
      </div>
    </div>
  )
}

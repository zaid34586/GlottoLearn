import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signUp(email, password, fullName)
    setBusy(false)
    if (err) return setError(err)
    navigate('/dashboard')
  }

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center px-4">
      <div className="glow-orb right-1/4 top-10 h-72 w-72 bg-fuchsia-600/40" />
      <div className="glass-strong relative w-full max-w-md rounded-3xl p-8 animate-fade-up">
        <h1 className="font-display text-2xl font-bold text-slate-900">Create your account ✨</h1>
        <p className="mt-1 text-sm text-slate-500">Start learning a new language today.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Full name</label>
            <input className="field" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aisha Khan" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email</label>
            <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Password</label>
            <input className="field" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" />
          </div>
          {error && <p className="rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account? <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-600">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

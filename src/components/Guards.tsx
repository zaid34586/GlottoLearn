import { Navigate, useLocation } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from './ui'
import type { Role } from '../lib/types'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/** Admin portal guard — non-admins get an access-denied screen, not the panel */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, profile, loading, signOut } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-strong max-w-md rounded-3xl p-8 text-center animate-fade-up">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl">🚫</div>
          <h1 className="font-display mt-4 text-xl font-bold text-slate-900">Access restricted</h1>
          <p className="mt-2 text-sm text-slate-500">
            This area is only for administrators. If you believe this is a mistake, contact the site owner.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a href="/" className="btn-ghost">← Main site</a>
            <button onClick={() => signOut()} className="btn-danger">Sign out</button>
          </div>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

/** Teacher portal guard — teachers (and admins acting as course teachers) only */
export function RequireTeacher({ children }: { children: ReactNode }) {
  const { session, profile, loading, signOut } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/teacher/login" state={{ from: location.pathname }} replace />
  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-strong max-w-md rounded-3xl p-8 text-center animate-fade-up">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">🎓</div>
          <h1 className="font-display mt-4 text-xl font-bold text-slate-900">Teacher access only</h1>
          <p className="mt-2 text-sm text-slate-500">
            This studio is for teachers. If you were recently made a teacher, sign out and sign in again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a href="/" className="btn-ghost">← Main site</a>
            <button onClick={() => signOut()} className="btn-danger">Sign out</button>
          </div>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

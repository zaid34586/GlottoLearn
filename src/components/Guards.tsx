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

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ScrollProgress } from './ui'
import { cn } from '../lib/utils'
import type { Role } from '../lib/types'

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 via-indigo-500 to-fuchsia-500 text-lg shadow-lg shadow-indigo-500/25">
        🌐
      </div>
      <span className={cn('font-display text-xl font-extrabold tracking-tight', dark ? 'text-white' : 'text-slate-900')}>
        Glotto<span className="text-gradient">Learn</span>
      </span>
    </Link>
  )
}

const roleHome: Record<Role, string> = {
  student: '/dashboard',
  teacher: '/teach',
  admin: '/admin',
}

export function PublicLayout() {
  const { session, role, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen">
      <ScrollProgress />
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-500 md:flex">
            <NavLink to="/courses" className={({ isActive }) => cn('transition hover:text-slate-900', isActive && 'text-slate-900')}>Courses</NavLink>
            <a href="/#how" className="transition hover:text-slate-900">How it works</a>
            <a href="/#testimonials" className="transition hover:text-slate-900">Reviews</a>
          </nav>
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <Link to={role ? roleHome[role] : '/dashboard'} className="btn-ghost !py-2">Dashboard</Link>
                <button
                  className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-400 transition hover:text-slate-700 sm:block"
                  onClick={async () => { await signOut(); navigate('/') }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-slate-500 transition hover:text-slate-900">Sign in</Link>
                <Link to="/signup" className="btn-primary !py-2">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-400 md:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} GlottoLearn. Learn any language, live & on your schedule.</p>
        </div>
        <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-center gap-5 border-t border-slate-100 px-4 pt-5 text-xs font-semibold text-slate-400">
          <Link to="/privacy" className="transition hover:text-slate-700">Privacy</Link>
          <Link to="/terms" className="transition hover:text-slate-700">Terms</Link>
          <span className="text-slate-200">|</span>
          <Link to="/teacher/login" className="transition hover:text-amber-600">🎓 Teacher Portal</Link>
          <Link to="/admin/login" className="transition hover:text-rose-600">🔐 Admin Portal</Link>
        </div>
      </footer>
    </div>
  )
}

const navByRole: Record<Role, { to: string; label: string; icon: string }[]> = {
  student: [
    { to: '/dashboard', label: 'Overview', icon: '🏠' },
    { to: '/my-courses', label: 'My Courses', icon: '📚' },
    { to: '/live-classes', label: 'Live Classes', icon: '🎥' },
    { to: '/profile', label: 'Profile', icon: '👤' },
  ],
  teacher: [
    { to: '/teach', label: 'Dashboard', icon: '🏠' },
    { to: '/teach/batches', label: 'Batches', icon: '🗓️' },
    { to: '/profile', label: 'Profile', icon: '👤' },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: '📊' },
    { to: '/admin/courses', label: 'Courses', icon: '📚' },
    { to: '/admin/people', label: 'People', icon: '👥' },
    { to: '/admin/payments', label: 'Payments', icon: '💳' },
    { to: '/teach', label: 'Teaching Studio', icon: '🎓' },
    { to: '/profile', label: 'Profile', icon: '👤' },
  ],
}

export function AppLayout() {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const nav = role ? navByRole[role] : []
  return (
    <div className={cn('flex min-h-screen', role && `theme-${role}`)}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 bg-white/90 backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="mx-5 mt-1 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, var(--role-accent, transparent), transparent)' }} />
        <nav className="mt-3 flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900',
                  isActive && 'text-slate-900',
                )
              }
              style={({ isActive }: { isActive: boolean }) =>
                isActive
                  ? { background: 'var(--role-accent-soft)', boxShadow: 'inset 3px 0 0 var(--role-accent)', color: 'var(--role-accent)' }
                  : undefined
              }
            >
              <span>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--role-accent, #14b8a6), var(--role-accent-2, #6366f1))' }}
            >
              {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{profile?.full_name}</p>
              <p className="text-xs font-semibold capitalize" style={{ color: 'var(--role-accent)' }}>{role}</p>
            </div>
            <button
              title="Sign out"
              className="text-slate-300 transition hover:text-slate-600"
              onClick={async () => { await signOut(); navigate('/login') }}
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-h-screen w-full flex-col md:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl md:hidden">
          <Logo />
          <div className="flex items-center gap-2 overflow-x-auto">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className="rounded-lg px-2 py-1 text-lg">
                {n.icon}
              </NavLink>
            ))}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

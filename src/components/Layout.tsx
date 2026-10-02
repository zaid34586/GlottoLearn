import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/utils'
import type { Role } from '../lib/types'

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-amber-400 text-lg shadow-lg shadow-indigo-500/30">
        🌐
      </div>
      <span className="font-display text-lg font-extrabold tracking-tight text-white">
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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <NavLink to="/courses" className={({ isActive }) => cn(isActive && 'text-white')}>Courses</NavLink>
            <a href="/#how">How it works</a>
            <a href="/#testimonials">Reviews</a>
          </nav>
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <Link to={role ? roleHome[role] : '/dashboard'} className="btn-ghost !py-2">
                  Dashboard
                </Link>
                <button
                  className="hidden rounded-lg px-3 py-2 text-sm text-white/60 hover:text-white sm:block"
                  onClick={async () => { await signOut(); navigate('/') }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-white/70 hover:text-white">Sign in</Link>
                <Link to="/signup" className="btn-primary !py-2">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-white/40 md:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} GlottoLearn. Learn any language, live & on your schedule.</p>
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
    { to: '/profile', label: 'Profile', icon: '👤' },
  ],
}

export function AppLayout() {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const nav = role ? navByRole[role] : []
  return (
    <div className={cn('flex min-h-screen', role && `theme-${role}`)}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/10 bg-[#0a0a18]/90 backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="mx-5 mt-1 h-px" style={{ background: 'linear-gradient(90deg, var(--role-accent, transparent), transparent)' }} />
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white',
                  isActive && 'text-white',
                )
              }
              style={({ isActive }: { isActive: boolean }) =>
                isActive
                  ? { background: 'var(--role-accent-soft)', boxShadow: 'inset 3px 0 0 var(--role-accent)' }
                  : undefined
              }
            >
              <span>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-[#0a0a14]"
              style={{ background: 'linear-gradient(135deg, var(--role-accent, #6366f1), var(--role-accent-2, #d946ef))' }}
            >
              {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{profile?.full_name}</p>
              <p className="text-xs capitalize text-white/40">{role}</p>
            </div>
            <button
              title="Sign out"
              className="text-white/40 hover:text-white"
              onClick={async () => { await signOut(); navigate('/login') }}
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-h-screen w-full flex-col md:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[#07070f]/85 px-4 backdrop-blur-xl md:hidden">
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

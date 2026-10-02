import type { ReactNode, CSSProperties } from 'react'
import { useRef } from 'react'
import { cn } from '../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400',
        className,
      )}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  )
}

export function EmptyState({ icon, title, hint, action }: { icon: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      {hint && <p className="max-w-sm text-sm text-white/50">{hint}</p>}
      {action}
    </div>
  )
}

export function Badge({ children, tone = 'indigo' }: { children: ReactNode; tone?: 'indigo' | 'green' | 'amber' | 'red' | 'slate' }) {
  const tones: Record<string, string> = {
    indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    red: 'bg-red-500/15 text-red-300 border-red-400/30',
    slate: 'bg-white/8 text-white/60 border-white/15',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide', tones[tone])}>
      {children}
    </span>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('glass-strong relative w-full rounded-2xl p-6 shadow-2xl animate-fade-up', wide ? 'max-w-3xl' : 'max-w-md')}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Card with subtle 3D tilt on mouse move */
export function TiltCard({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  function onMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(6px)`
  }
  function onLeave() {
    const el = ref.current
    if (el) el.style.transform = 'rotateY(0deg) rotateX(0deg)'
  }
  return (
    <div className="tilt-wrap" style={style}>
      <div ref={ref} className={cn('tilt', className)} onMouseMove={onMove} onMouseLeave={onLeave}>
        {children}
      </div>
    </div>
  )
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function StatCard({ label, value, icon, accent }: { label: string; value: ReactNode; icon: string; accent?: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/45">{label}</p>
          <p className="font-display mt-1 text-2xl font-bold text-white">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-lg', accent ?? 'bg-indigo-500/15 text-indigo-300')}>
          {icon}
        </div>
      </div>
    </div>
  )
}

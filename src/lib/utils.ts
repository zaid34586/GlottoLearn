export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function formatINR(amount: number): string {
  if (amount === 0) return 'Free'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDuration(sec: number): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
  }
  return `${m}m ${s}s`
}

export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`
  return `in ${Math.floor(hrs / 24)} days`
}

export const LEVELS = ['Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Mastery']

export function slugId(): string {
  return crypto.randomUUID()
}

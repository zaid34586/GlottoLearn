import { Link } from 'react-router-dom'
import { TiltCard, Badge } from './ui'
import { formatINR } from '../lib/utils'
import type { Course } from '../lib/types'

export function CourseCard({ course }: { course: Course }) {
  const lang = course.language?.name
  return (
    <TiltCard className="h-full">
      <Link
        to={`/courses/${course.id}`}
        className="glass glass-hover group flex h-full flex-col overflow-hidden rounded-2xl"
      >
        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-indigo-600/40 via-violet-600/30 to-amber-400/20">
          {course.cover_url ? (
            <img src={course.cover_url} alt={course.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl opacity-80 transition duration-500 group-hover:scale-110">
              {course.language?.code ? langFlag(course.language.code) : '🌍'}
            </div>
          )}
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge tone="indigo">{course.level}</Badge>
            {lang && <Badge tone="slate">{lang}</Badge>}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <h3 className="font-display line-clamp-2 text-base font-bold text-white">{course.title}</h3>
          <p className="line-clamp-2 flex-1 text-sm text-white/50">{course.description || 'Master this language step by step with live classes and recorded lessons.'}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-display text-lg font-bold text-gradient">{formatINR(course.price_inr)}</span>
            <span className="text-xs font-semibold text-indigo-300 group-hover:text-indigo-200">Explore →</span>
          </div>
        </div>
      </Link>
    </TiltCard>
  )
}

const flagMap: Record<string, string> = {
  en: '🇬🇧', fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', ar: '🇸🇦', hi: '🇮🇳', it: '🇮🇹',
}
export function langFlag(code: string): string {
  return flagMap[code] ?? '🌍'
}

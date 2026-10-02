import { Link } from 'react-router-dom'
import { TiltCard, Badge } from './ui'
import { formatINR } from '../lib/utils'
import { getLangTheme } from '../lib/langTheme'
import type { Course } from '../lib/types'

export function CourseCard({ course }: { course: Course }) {
  const t = getLangTheme(course.language)
  return (
    <TiltCard className="h-full">
      <Link
        to={`/courses/${course.id}`}
        className="glass glass-hover group flex h-full flex-col overflow-hidden rounded-2xl"
      >
        <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${t.gradient}`}>
          {course.cover_url ? (
            <img src={course.cover_url} alt={course.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <>
              <span className="font-display absolute -bottom-4 left-3 select-none text-6xl font-black italic text-white/15 transition duration-500 group-hover:scale-105">
                {t.greeting}
              </span>
              <span className="absolute right-4 top-4 text-4xl drop-shadow-lg transition duration-500 group-hover:scale-125">
                {t.flag}
              </span>
              <span
                className="absolute bottom-4 right-4 rounded-full px-3 py-1 text-xs font-bold text-white backdrop-blur"
                style={{ background: t.chip }}
              >
                {t.word}
              </span>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </>
          )}
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge tone="indigo">{course.level}</Badge>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <h3 className="font-display line-clamp-2 text-lg font-semibold text-white">{course.title}</h3>
          <p className="line-clamp-2 flex-1 text-sm text-white/50">{course.description || 'Master this language step by step with live classes and recorded lessons.'}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-display text-lg font-bold text-gradient">{formatINR(course.price_inr)}</span>
            <span className="text-xs font-semibold transition group-hover:translate-x-0.5" style={{ color: t.accent }}>
              Explore →
            </span>
          </div>
        </div>
      </Link>
    </TiltCard>
  )
}

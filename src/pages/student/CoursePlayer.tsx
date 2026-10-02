import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Progress, Badge, PageLoader, EmptyState } from '../../components/ui'
import { formatDuration } from '../../lib/utils'
import { getLangTheme } from '../../lib/langTheme'
import type { Course, Module, Lesson, Material, Recording, Quiz, LessonProgress, QuizAttempt, Batch } from '../../lib/types'
import { cn, formatDate } from '../../lib/utils'

type Tab = 'lessons' | 'recordings' | 'materials' | 'quizzes' | 'live' | 'announcements'

export default function CoursePlayer() {
  const { courseId } = useParams()
  const { session } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [progress, setProgress] = useState<LessonProgress[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [tab, setTab] = useState<Tab>('lessons')
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!courseId || !session) return
    const uid = session.user.id
    Promise.all([
      supabase.from('courses').select('*, language:languages(*), teacher:profiles!courses_teacher_id_fkey(*)').eq('id', courseId).single(),
      supabase.from('modules').select('*').eq('course_id', courseId).order('position'),
      supabase.from('lessons').select('*').eq('course_id', courseId).order('position'),
      supabase.from('materials').select('*').eq('course_id', courseId).order('created_at', { ascending: false }),
      supabase.from('recordings').select('*').eq('course_id', courseId).order('created_at', { ascending: false }),
      supabase.from('quizzes').select('*').eq('course_id', courseId).order('created_at', { ascending: false }),
      supabase.from('quiz_attempts').select('*').eq('student_id', uid),
      supabase.from('lesson_progress').select('*').eq('student_id', uid),
      supabase.from('batches').select('*, course:courses(title)').eq('course_id', courseId).in('status', ['scheduled', 'live']).order('scheduled_at'),
      supabase.from('announcements').select('*').eq('course_id', courseId).order('created_at', { ascending: false }),
    ]).then(([c, m, l, mat, rec, q, a, p, b, an]) => {
      setCourse((c.data as unknown as Course) ?? null)
      setModules((m.data as Module[]) ?? [])
      setLessons((l.data as Lesson[]) ?? [])
      setMaterials((mat.data as Material[]) ?? [])
      setRecordings((rec.data as Recording[]) ?? [])
      setQuizzes((q.data as Quiz[]) ?? [])
      setAttempts((a.data as QuizAttempt[]) ?? [])
      setProgress((p.data as LessonProgress[]) ?? [])
      setBatches((b.data as unknown as Batch[]) ?? [])
      setAnnouncements((an.data as any[]) ?? [])
      setLoading(false)
    })
  }, [courseId, session])

  // create signed URL for the active lesson video
  useEffect(() => {
    setVideoUrl(null)
    if (!activeLesson?.video_path) return
    supabase.storage.from('videos').createSignedUrl(activeLesson.video_path, 3600).then(({ data }) => {
      setVideoUrl(data?.signedUrl ?? null)
    })
  }, [activeLesson])

  const doneIds = useMemo(() => new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id)), [progress])
  const pct = lessons.length ? Math.round((lessons.filter((l) => doneIds.has(l.id)).length / lessons.length) * 100) : 0

  async function markComplete(lessonId: string, completed: boolean) {
    if (!session) return
    await supabase.from('lesson_progress').upsert(
      { lesson_id: lessonId, student_id: session.user.id, completed },
      { onConflict: 'lesson_id,student_id' },
    )
    setProgress((prev) => {
      const rest = prev.filter((p) => p.lesson_id !== lessonId)
      return [...rest, { id: 'tmp', lesson_id: lessonId, student_id: session.user.id, completed, seconds_watched: 0 }]
    })
  }

  if (loading) return <PageLoader />
  if (!course) return <EmptyState icon="🫥" title="Course not found or not enrolled" action={<Link to="/my-courses" className="btn-ghost mt-2">My Courses</Link>} />

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'lessons', label: 'Lessons', icon: '🎬' },
    { id: 'recordings', label: 'Recordings', icon: '⏺️' },
    { id: 'live', label: 'Live', icon: '🔴' },
    { id: 'quizzes', label: 'Tests', icon: '📝' },
    { id: 'materials', label: 'Materials', icon: '📎' },
    { id: 'announcements', label: 'Updates', icon: '📣' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      {/* Language-themed header */}
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${getLangTheme(course.language).gradient} p-1`}>
        <div className="glass-strong relative rounded-[calc(1.5rem-4px)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getLangTheme(course.language).flag}</span>
                <h1 className="font-display text-xl font-bold text-slate-900">{course.title}</h1>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">
                {course.language ? `${course.language.name} · ` : ''}{course.level} · Teacher: {course.teacher?.full_name ?? '—'}
              </p>
            </div>
            <div className="w-48">
              <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Progress</span><span className="font-semibold text-slate-900">{pct}%</span></div>
              <Progress value={pct} />
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition',
                  tab === t.id ? 'border-indigo-400/60 bg-indigo-500/20 text-slate-900' : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-900',
                )}
              >
                {t.icon} {t.label}
                {t.id === 'quizzes' && ` (${quizzes.length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Sidebar list (lessons) */}
        {tab === 'lessons' && (
          <aside className="space-y-4">
            {modules.length === 0 && <EmptyState icon="🎬" title="No lessons yet" hint="Your teacher is preparing the course content." />}
            {modules.map((m) => (
              <div key={m.id}>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">{m.title}</h3>
                <div className="space-y-2">
                  {lessons.filter((l) => l.module_id === m.id).map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setActiveLesson(l)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                        activeLesson?.id === l.id ? 'border-indigo-400/50 bg-indigo-500/15' : 'border-slate-200 bg-slate-50 hover:bg-slate-100',
                      )}
                    >
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', doneIds.has(l.id) ? 'bg-emerald-500/25 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
                        {doneIds.has(l.id) ? '✓' : l.position}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{l.title}</span>
                        <span className="text-xs text-slate-400">{formatDuration(l.duration_sec)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>
        )}

        {/* Main content */}
        <section>
          {tab === 'lessons' && (
            activeLesson ? (
              <div>
                <div className="overflow-hidden rounded-2xl bg-black">
                  {videoUrl ? (
                    <video key={videoUrl} src={videoUrl} controls className="aspect-video w-full" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-slate-400"><PageLoader /></div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">{activeLesson.title}</h2>
                    {activeLesson.content && <p className="mt-1 max-w-2xl text-sm text-slate-500">{activeLesson.content}</p>}
                  </div>
                  <button
                    className={doneIds.has(activeLesson.id) ? 'btn-ghost' : 'btn-primary'}
                    onClick={() => markComplete(activeLesson.id, !doneIds.has(activeLesson.id))}
                  >
                    {doneIds.has(activeLesson.id) ? '✓ Completed (undo)' : 'Mark as Complete'}
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState icon="👆" title="Select a lesson" hint="Pick a lesson from the sidebar to start watching." />
            )
          )}

          {tab === 'recordings' && (
            recordings.length === 0 ? <EmptyState icon="⏺️" title="No recordings yet" hint="Live class recordings will appear here automatically." /> : (
              <div className="grid gap-4 sm:grid-cols-2">
                {recordings.map((r) => <RecordingCard key={r.id} rec={r} />)}
              </div>
            )
          )}

          {tab === 'live' && (
            batches.length === 0 ? <EmptyState icon="🔴" title="No live classes scheduled" /> : (
              <div className="space-y-3">
                {batches.map((b) => (
                  <div key={b.id} className="glass flex items-center justify-between rounded-xl px-5 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">{b.title}</p>
                      <p className="text-xs text-slate-400">{formatDate(b.scheduled_at)} · {b.duration_min} min</p>
                    </div>
                    {b.status === 'live'
                      ? <Link to={`/live/${b.id}`} className="btn-primary">🔴 Join Now</Link>
                      : <Badge tone="indigo">Scheduled</Badge>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'quizzes' && (
            quizzes.length === 0 ? <EmptyState icon="📝" title="No tests yet" hint="Your teacher will publish quizzes and exams here." /> : (
              <div className="space-y-3">
                {quizzes.map((q) => {
                  const attempt = attempts.find((a) => a.quiz_id === q.id)
                  return (
                    <div key={q.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{q.title}</p>
                          <Badge tone={q.is_graded ? 'amber' : 'green'}>{q.is_graded ? 'GRADED EXAM' : 'PRACTICE'}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {q.description || 'Test your knowledge'}{q.time_limit_min ? ` · ${q.time_limit_min} min limit` : ''}
                        </p>
                      </div>
                      {attempt && attempt.status !== 'in_progress' ? (
                        <Link to={`/quiz-result/${attempt.id}`} className="btn-ghost">
                          Score: {Number(attempt.score)}/{Number(attempt.total_marks)} — View
                        </Link>
                      ) : (
                        <Link to={`/quiz/${q.id}`} className="btn-primary">{attempt ? 'Resume' : 'Start Test'}</Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {tab === 'materials' && (
            materials.length === 0 ? <EmptyState icon="📎" title="No materials yet" /> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {materials.map((m) => (
                  <MaterialCard key={m.id} title={m.title} path={m.file_path} />
                ))}
              </div>
            )
          )}

          {tab === 'announcements' && (
            announcements.length === 0 ? <EmptyState icon="📣" title="No announcements" /> : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="glass rounded-xl p-5">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{a.title}</p>
                      <span className="text-xs text-slate-400">{formatDate(a.created_at)}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-500">{a.body}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </section>
      </div>
    </div>
  )
}

function RecordingCard({ rec }: { rec: Recording }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    supabase.storage.from('videos').createSignedUrl(rec.video_path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null))
  }, [rec.video_path])
  return (
    <div className="glass overflow-hidden rounded-2xl">
      {url && <video key={url} src={url} controls className="aspect-video w-full bg-black" />}
      <div className="p-4">
        <p className="font-semibold text-slate-900">{rec.title}</p>
        <p className="text-xs text-slate-400">{formatDate(rec.created_at)} · {formatDuration(rec.duration_sec)}</p>
      </div>
    </div>
  )
}

function MaterialCard({ title, path }: { title: string; path: string }) {
  async function download() {
    const { data } = await supabase.storage.from('materials').createSignedUrl(path, 300, { download: true })
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  return (
    <button onClick={download} className="glass glass-hover flex items-center gap-3 rounded-xl p-4 text-left">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-lg">📄</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{title}</span>
      <span className="text-xs font-semibold text-indigo-600">Download</span>
    </button>
  )
}

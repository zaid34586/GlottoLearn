import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader, EmptyState, Badge, Modal, StatCard } from '../../components/ui'
import { formatINR, cn, formatDate } from '../../lib/utils'
import type { Course, Module, Lesson, Material, Quiz, Question, Enrollment, Announcement, Profile } from '../../lib/types'

type Section = 'content' | 'quizzes' | 'materials' | 'announcements' | 'students'

export default function CourseBuilder() {
  const { courseId } = useParams()
  const { profile } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [section, setSection] = useState<Section>('content')
  const [loading, setLoading] = useState(true)
  const [quizBuilderId, setQuizBuilderId] = useState<string | null>(null)

  // modals
  const [showModule, setShowModule] = useState(false)
  const [showLesson, setShowLesson] = useState<Module | null>(null)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showAnnounce, setShowAnnounce] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadAll() {
    if (!courseId) return
    const [c, m, l, mat, q, e, an] = await Promise.all([
      supabase.from('courses').select('*, language:languages(*), teacher:profiles!courses_teacher_id_fkey(*)').eq('id', courseId).single(),
      supabase.from('modules').select('*').eq('course_id', courseId).order('position'),
      supabase.from('lessons').select('*').eq('course_id', courseId).order('position'),
      supabase.from('materials').select('*').eq('course_id', courseId).order('created_at', { ascending: false }),
      supabase.from('quizzes').select('*').eq('course_id', courseId).order('created_at', { ascending: false }),
      supabase.from('enrollments').select('*').eq('course_id', courseId),
      supabase.from('announcements').select('*').eq('course_id', courseId).order('created_at', { ascending: false }),
    ])
    setCourse((c.data as unknown as Course) ?? null)
    setModules((m.data as Module[]) ?? [])
    setLessons((l.data as Lesson[]) ?? [])
    setMaterials((mat.data as Material[]) ?? [])
    setQuizzes((q.data as Quiz[]) ?? [])
    setEnrollments((e.data as Enrollment[]) ?? [])
    setAnnouncements((an.data as Announcement[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [courseId])

  useEffect(() => {
    if (enrollments.length === 0) return setStudents([])
    supabase.from('profiles').select('*').in('id', enrollments.map((e) => e.student_id)).then(({ data }) => setStudents((data as Profile[]) ?? []))
  }, [enrollments])

  if (loading) return <PageLoader />
  if (!course) return <EmptyState icon="🫥" title="Course not found" action={<Link to="/teach" className="btn-ghost mt-2">Back</Link>} />

  async function togglePublish() {
    const next = course!.status === 'published' ? 'draft' : 'published'
    await supabase.from('courses').update({ status: next }).eq('id', course!.id)
    setCourse({ ...course!, status: next })
  }

  // ---------- Modules & lessons ----------
  async function addModule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const title = String(fd.get('title') ?? '').trim()
    if (!title) return
    await supabase.from('modules').insert({ course_id: course!.id, title, position: modules.length })
    setShowModule(false)
    loadAll()
  }

  async function addLesson(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!showLesson) return
    const fd = new FormData(e.currentTarget)
    const title = String(fd.get('title') ?? '').trim()
    const content = String(fd.get('content') ?? '')
    const file = (fd.get('video') as File) ?? null
    const moduleLessons = lessons.filter((l) => l.module_id === showLesson.id)
    if (file && file.size > 0) {
      setUploading(true)
      setError(null)
      const path = `${course!.id}/${crypto.randomUUID()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('videos').upload(path, file)
      if (upErr) { setUploading(false); return setError(upErr.message) }
      await supabase.from('lessons').insert({
        module_id: showLesson.id, course_id: course!.id, title, content,
        type: 'video', video_path: path, position: moduleLessons.length,
        duration_sec: Number(fd.get('duration_sec') ?? 0) || 0,
      })
      setUploading(false)
    } else {
      await supabase.from('lessons').insert({
        module_id: showLesson.id, course_id: course!.id, title, content, type: 'video', position: moduleLessons.length,
      })
    }
    setShowLesson(null)
    loadAll()
  }

  async function deleteLesson(id: string) {
    await supabase.from('lessons').delete().eq('id', id)
    loadAll()
  }

  // ---------- Materials ----------
  async function uploadMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const title = String(fd.get('title') ?? '').trim()
    const file = (fd.get('file') as File) ?? null
    if (!title || !file || file.size === 0) return
    setUploading(true)
    setError(null)
    const path = `${course!.id}/${crypto.randomUUID()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('materials').upload(path, file)
    if (upErr) { setUploading(false); return setError(upErr.message) }
    await supabase.from('materials').insert({ course_id: course!.id, title, file_path: path, uploaded_by: profile!.id })
    setUploading(false)
    ;(e.target as HTMLFormElement).reset()
    loadAll()
  }

  // ---------- Quizzes ----------
  async function createQuiz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const { data, error } = await supabase.from('quizzes').insert({
      course_id: course!.id,
      title: String(fd.get('title')),
      description: String(fd.get('description') ?? ''),
      time_limit_min: Number(fd.get('time_limit_min') ?? 0) || 0,
      is_graded: fd.get('is_graded') === 'on',
      week_no: Number(fd.get('week_no')) || null,
      created_by: profile!.id,
    }).select('id').single()
    if (!error && data) setQuizBuilderId(data.id)
    setShowQuiz(false)
    loadAll()
  }

  // ---------- Announcements ----------
  async function postAnnouncement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await supabase.from('announcements').insert({
      course_id: course!.id, author_id: profile!.id,
      title: String(fd.get('title')), body: String(fd.get('body') ?? ''),
    })
    setShowAnnounce(false)
    loadAll()
  }

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'content', label: 'Content', icon: '🎬' },
    { id: 'quizzes', label: 'Tests', icon: '📝' },
    { id: 'materials', label: 'Materials', icon: '📎' },
    { id: 'announcements', label: 'Announcements', icon: '📣' },
    { id: 'students', label: 'Students', icon: '👥' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/teach" className="text-xs font-semibold text-indigo-600 hover:text-indigo-600">← Dashboard</Link>
            <h1 className="font-display mt-1 text-2xl font-bold text-slate-900">{course.title}</h1>
            <p className="mt-0.5 text-sm text-slate-400">{course.language?.name} · {course.level} · {formatINR(course.price_inr)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={course.status === 'published' ? 'green' : 'slate'}>{course.status.toUpperCase()}</Badge>
            <button className="btn-primary !py-2" onClick={togglePublish}>
              {course.status === 'published' ? 'Unpublish' : 'Publish Course'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn('whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition',
                section === s.id ? 'border-indigo-400/60 bg-indigo-500/20 text-slate-900' : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-900')}
            >
              {s.icon} {s.label}{s.id === 'students' && ` (${students.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {/* ------------- CONTENT ------------- */}
        {section === 'content' && (
          <div>
            <div className="mb-4 flex justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Course Content</h2>
              <button className="btn-ghost !py-2" onClick={() => setShowModule(true)}>+ Add Module</button>
            </div>
            {modules.length === 0 ? (
              <EmptyState icon="🗂️" title="No modules yet" hint="Modules group your lessons. Start by adding one." />
            ) : (
              <div className="space-y-4">
                {modules.map((m) => (
                  <div key={m.id} className="glass rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-bold text-slate-900">{m.title}</h3>
                      <button className="btn-ghost !py-1.5 !text-xs" onClick={() => setShowLesson(m)}>+ Add Lesson</button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {lessons.filter((l) => l.module_id === m.id).map((l) => (
                        <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="text-lg">🎬</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{l.title}</p>
                              <p className="text-xs text-slate-400">{l.video_path ? 'Video uploaded' : 'No video yet'} · {l.duration_sec ? `${Math.round(l.duration_sec / 60)} min` : '—'}</p>
                            </div>
                          </div>
                          <button className="text-xs font-semibold text-red-600 hover:text-red-600" onClick={() => deleteLesson(l.id)}>Delete</button>
                        </div>
                      ))}
                      {lessons.filter((l) => l.module_id === m.id).length === 0 && <p className="text-xs text-slate-400">No lessons in this module yet.</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------- QUIZZES ------------- */}
        {section === 'quizzes' && (
          <div>
            <div className="mb-4 flex justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Tests & Quizzes</h2>
              <button className="btn-ghost !py-2" onClick={() => setShowQuiz(true)}>+ Create Test</button>
            </div>
            {quizzes.length === 0 ? (
              <EmptyState icon="📝" title="No tests yet" hint="Create practice quizzes or graded exams with auto-scoring." />
            ) : (
              <div className="space-y-3">
                {quizzes
                  .slice()
                  .sort((a, b) => (a.week_no ?? 999) - (b.week_no ?? 999))
                  .map((q) => (
                  <div key={q.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {q.week_no != null && <Badge tone="indigo">WEEK {q.week_no}</Badge>}
                        <p className="font-semibold text-slate-900">{q.title}</p>
                        <Badge tone={q.is_graded ? 'amber' : 'green'}>{q.is_graded ? 'GRADED' : 'PRACTICE'}</Badge>
                        {q.time_limit_min > 0 && <Badge tone="slate">{q.time_limit_min} MIN</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">Created {formatDate(q.created_at)}</p>
                    </div>
                    <button className="btn-ghost !py-2" onClick={() => setQuizBuilderId(q.id)}>Edit Questions</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------- MATERIALS ------------- */}
        {section === 'materials' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="font-display mb-4 text-lg font-bold text-slate-900">Study Materials</h2>
              {materials.length === 0 ? <EmptyState icon="📎" title="No materials yet" /> : (
                <div className="space-y-2">
                  {materials.map((m) => (
                    <div key={m.id} className="glass flex items-center gap-3 rounded-xl px-4 py-3">
                      <span className="text-lg">📄</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{m.title}</span>
                      <span className="text-xs text-slate-400">{formatDate(m.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <form onSubmit={uploadMaterial} className="glass h-fit rounded-2xl p-5">
              <h3 className="font-display font-bold text-slate-900">Upload Material</h3>
              <div className="mt-4 space-y-3">
                <input className="field" name="title" required placeholder="Material title (e.g. Week 1 Notes)" />
                <input className="field !py-2" name="file" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,image/*" />
                <button className="btn-primary w-full" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
              </div>
            </form>
          </div>
        )}

        {/* ------------- ANNOUNCEMENTS ------------- */}
        {section === 'announcements' && (
          <div>
            <div className="mb-4 flex justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Announcements</h2>
              <button className="btn-ghost !py-2" onClick={() => setShowAnnounce(true)}>+ New</button>
            </div>
            {announcements.length === 0 ? <EmptyState icon="📣" title="No announcements" hint="Send updates to all enrolled students." /> : (
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
            )}
          </div>
        )}

        {/* ------------- STUDENTS ------------- */}
        {section === 'students' && (
          <div>
            <h2 className="font-display mb-4 text-lg font-bold text-slate-900">Enrolled Students ({students.length})</h2>
            {students.length === 0 ? <EmptyState icon="👥" title="No students enrolled yet" /> : (
              <div className="glass overflow-x-auto rounded-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Enrolled</th></tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const enr = enrollments.find((e) => e.student_id === s.id)
                      return (
                        <tr key={s.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-5 py-3 text-slate-700">{s.full_name}</td>
                          <td className="px-5 py-3 text-slate-400">{formatDate(enr?.enrolled_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">{error}</p>}

      {/* ---------- Modals ---------- */}
      <Modal open={showModule} onClose={() => setShowModule(false)} title="Add Module">
        <form onSubmit={addModule} className="space-y-4">
          <input className="field" name="title" required placeholder="Module title (e.g. Unit 1 — Greetings)" />
          <button className="btn-primary w-full">Add Module</button>
        </form>
      </Modal>

      <Modal open={!!showLesson} onClose={() => setShowLesson(null)} title={`Add Lesson — ${showLesson?.title ?? ''}`}>
        <form onSubmit={addLesson} className="space-y-4">
          <input className="field" name="title" required placeholder="Lesson title" />
          <textarea className="field min-h-16" name="content" placeholder="Short description / notes (optional)" />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Video file (MP4/WebM)</label>
            <input className="field !py-2" name="video" type="file" accept="video/*" />
          </div>
          <input className="field" name="duration_sec" type="number" min="0" placeholder="Duration in seconds (optional)" />
          <button className="btn-primary w-full" disabled={uploading}>{uploading ? 'Uploading video…' : 'Add Lesson'}</button>
        </form>
      </Modal>

      <Modal open={showQuiz} onClose={() => setShowQuiz(false)} title="Create Test">
        <form onSubmit={createQuiz} className="space-y-4">
          <input className="field" name="title" required placeholder="Test title (e.g. Week 1 Test — Greetings)" />
          <textarea className="field min-h-16" name="description" placeholder="Instructions for students (optional)" />
          <div className="grid grid-cols-3 gap-3">
            <input className="field" name="week_no" type="number" min="1" placeholder="Week no." />
            <input className="field" name="time_limit_min" type="number" min="0" placeholder="Time limit (min)" />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="is_graded" className="accent-indigo-500" /> Graded exam
            </label>
          </div>
          <button className="btn-primary w-full">Create & Add Questions</button>
        </form>
      </Modal>

      <Modal open={showAnnounce} onClose={() => setShowAnnounce(false)} title="New Announcement">
        <form onSubmit={postAnnouncement} className="space-y-4">
          <input className="field" name="title" required placeholder="Title" />
          <textarea className="field min-h-24" name="body" required placeholder="Message to students…" />
          <button className="btn-primary w-full">Send to Students</button>
        </form>
      </Modal>

      <QuizEditorModal quizId={quizBuilderId} onClose={() => { setQuizBuilderId(null); loadAll() }} />
    </div>
  )
}

/* ================= Quiz question editor ================= */
function QuizEditorModal({ quizId, onClose }: { quizId: string | null; onClose: () => void }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempts, setAttempts] = useState<(any & { profiles?: Profile })[]>([])

  async function load() {
    if (!quizId) return
    const [q, qs, at] = await Promise.all([
      supabase.from('quizzes').select('*').eq('id', quizId).single(),
      supabase.from('questions').select('*').eq('quiz_id', quizId).order('position'),
      supabase.from('quiz_attempts').select('*, student:profiles(*)').eq('quiz_id', quizId).neq('status', 'in_progress'),
    ])
    setQuiz(q.data as Quiz)
    setQuestions((qs.data as Question[]) ?? [])
    setAttempts((at.data as any[]) ?? [])
  }

  useEffect(() => { if (quizId) load() }, [quizId])

  async function addQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const type = String(fd.get('type')) as Question['type']
    let options: string[] = []
    if (type === 'mcq') {
      options = ['a', 'b', 'c', 'd'].map((k) => String(fd.get(`opt_${k}`) ?? '').trim()).filter(Boolean)
    } else if (type === 'truefalse') {
      options = ['True', 'False']
    }
    await supabase.from('questions').insert({
      quiz_id: quizId,
      text: String(fd.get('text')),
      type,
      options,
      correct_answer: type === 'short' ? String(fd.get('correct_answer') ?? '') : String(fd.get('correct_answer') ?? options[0] ?? ''),
      marks: Number(fd.get('marks') ?? 1) || 1,
      position: questions.length,
    })
    ;(e.target as HTMLFormElement).reset()
    load()
  }

  async function deleteQuestion(id: string) {
    await supabase.from('questions').delete().eq('id', id)
    load()
  }

  async function gradeAttempt(attemptId: string, score: string, total: number) {
    await supabase.from('quiz_attempts').update({ score: Number(score) || 0, total_marks: total, status: 'graded' }).eq('id', attemptId)
    load()
  }

  if (!quizId) return null
  const totalMarks = questions.reduce((s, q) => s + q.marks, 0)

  return (
    <Modal open onClose={onClose} title={`Questions — ${quiz?.title ?? ''}`} wide>
      <div className="grid gap-5 md:grid-cols-2">
        {/* Add + list */}
        <div>
          <form onSubmit={addQuestion} className="glass rounded-xl p-4">
            <p className="mb-3 text-sm font-bold text-slate-900">Add Question</p>
            <div className="space-y-3">
              <textarea className="field min-h-16" name="text" required placeholder="Question text" />
              <div className="grid grid-cols-2 gap-3">
                <select className="field" name="type" defaultValue="mcq">
                  <option value="mcq">Multiple choice</option>
                  <option value="truefalse">True / False</option>
                  <option value="short">Short answer</option>
                </select>
                <input className="field" name="marks" type="number" min="1" defaultValue="1" placeholder="Marks" />
              </div>
              <input className="field" name="opt_a" placeholder="Option A" />
              <input className="field" name="opt_b" placeholder="Option B" />
              <input className="field" name="opt_c" placeholder="Option C (optional)" />
              <input className="field" name="opt_d" placeholder="Option D (optional)" />
              <input className="field" name="correct_answer" placeholder="Correct answer (exact text)" />
              <button className="btn-primary w-full">Add Question</button>
            </div>
          </form>
          <div className="mt-4 space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="glass flex items-start justify-between gap-3 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">Q{i + 1}. {q.text}</p>
                  <p className="text-xs text-slate-400">{q.type} · {q.marks} marks · answer: {q.correct_answer || '(teacher graded)'}</p>
                </div>
                <button className="text-xs font-semibold text-red-600 hover:text-red-600" onClick={() => deleteQuestion(q.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Results / grading */}
        <div>
          <p className="mb-3 text-sm font-bold text-slate-900">Student Results ({attempts.length}) · Total {totalMarks} marks</p>
          <div className="space-y-2">
            {attempts.length === 0 && <p className="text-xs text-slate-400">No submissions yet.</p>}
            {attempts.map((a: any) => (
              <div key={a.id} className="glass rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{a.student?.full_name ?? 'Student'}</p>
                  <Badge tone={a.status === 'graded' ? 'green' : 'amber'}>{a.status.toUpperCase()}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    className="field !w-24 !py-1.5"
                    type="number"
                    min="0"
                    defaultValue={Number(a.score)}
                    onBlur={(e) => gradeAttempt(a.id, e.target.value, totalMarks)}
                  />
                  <span className="text-xs text-slate-400">/ {totalMarks} — edit to grade short answers</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader, EmptyState, Badge } from '../../components/ui'
import type { Quiz, Question, QuizAttempt } from '../../lib/types'

export default function QuizTake() {
  const { quizId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [remaining, setRemaining] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!quizId || !session) return
    Promise.all([
      supabase.from('quizzes').select('*').eq('id', quizId).single(),
      supabase.from('questions').select('*').eq('quiz_id', quizId).order('position'),
      supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).eq('student_id', session.user.id).maybeSingle(),
    ]).then(async ([q, qs, a]) => {
      const quizData = q.data as Quiz
      let att = a.data as QuizAttempt | null
      // Resume or create attempt
      if (!att) {
        const { data: created } = await supabase
          .from('quiz_attempts')
          .insert({ quiz_id: quizId, student_id: session.user.id })
          .select('*')
          .single()
        att = (created as QuizAttempt) ?? null
      } else if (att.status !== 'in_progress') {
        navigate(`/quiz-result/${att.id}`)
        return
      }
      // Load existing answers (resume)
      if (att) {
        const { data: existing } = await supabase.from('answers').select('*').eq('attempt_id', att.id)
        const prev: Record<string, string> = {}
        for (const r of existing ?? []) prev[(r as any).question_id] = (r as any).answer_text ?? ''
        setAnswers(prev)
      }
      setQuiz(quizData)
      setQuestions((qs.data as Question[]) ?? [])
      setAttempt(att)
      setLoading(false)
    })
  }, [quizId, session, navigate])

  // Timer
  useEffect(() => {
    if (!attempt || !quiz || quiz.time_limit_min <= 0) return
    const deadline = new Date(attempt.started_at).getTime() + quiz.time_limit_min * 60_000
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) submit(true)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id, quiz?.id])

  async function saveAnswer(questionId: string, text: string) {
    if (!attempt) return
    setAnswers((prev) => ({ ...prev, [questionId]: text }))
    await supabase.from('answers').upsert(
      { attempt_id: attempt.id, question_id: questionId, answer_text: text },
      { onConflict: 'attempt_id,question_id' },
    )
  }

  const totalMarks = useMemo(() => questions.reduce((s, q) => s + q.marks, 0), [questions])

  async function submit(auto = false) {
    if (!attempt || submitting) return
    setSubmitting(true)
    let score = 0
    for (const q of questions) {
      const ans = (answers[q.id] ?? '').trim()
      let correct = false
      if (q.type === 'mcq' || q.type === 'truefalse') {
        correct = ans.toLowerCase() === q.correct_answer.trim().toLowerCase()
        if (correct) score += q.marks
      }
      // 'short' type needs teacher grading — auto 0 until graded
      await supabase.from('answers').upsert(
        { attempt_id: attempt.id, question_id: q.id, answer_text: ans, is_correct: q.type === 'short' ? null : correct, marks_awarded: correct ? q.marks : 0 },
        { onConflict: 'attempt_id,question_id' },
      )
    }
    await supabase
      .from('quiz_attempts')
      .update({ submitted_at: new Date().toISOString(), score, total_marks: totalMarks, status: questions.some((q) => q.type === 'short') ? 'graded' : 'graded' })
      .eq('id', attempt.id)
    navigate(`/quiz-result/${attempt.id}${auto ? '?auto=1' : ''}`)
  }

  if (loading) return <PageLoader />
  if (!quiz || !attempt) return <EmptyState icon="🫥" title="Test not found" />

  const mm = remaining !== null ? String(Math.floor(remaining / 60)).padStart(2, '0') : null
  const ss = remaining !== null ? String(remaining % 60).padStart(2, '0') : null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{quiz.title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{quiz.description} · {questions.length} questions · {totalMarks} marks</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={quiz.is_graded ? 'amber' : 'green'}>{quiz.is_graded ? 'GRADED' : 'PRACTICE'}</Badge>
          {mm !== null && (
            <span className={`font-display rounded-xl px-4 py-2 text-lg font-bold tabular-nums ${remaining! < 60 ? 'bg-red-500/20 text-red-600' : 'glass text-slate-900'}`}>
              {mm}:{ss}
            </span>
          )}
        </div>
      </div>

      {remaining === 0 && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">Time is up — submit your test.</p>}

      <div className="mt-6 space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="glass rounded-2xl p-5">
            <p className="font-medium text-slate-900">
              <span className="mr-2 text-indigo-600">Q{i + 1}.</span>{q.text}
              <span className="ml-2 text-xs text-slate-400">({q.marks} {q.marks === 1 ? 'mark' : 'marks'})</span>
            </p>
            {q.type === 'mcq' && (
              <div className="mt-3 space-y-2">
                {(q.options ?? []).map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 transition hover:border-indigo-400/40">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === opt}
                      onChange={() => saveAnswer(q.id, opt)}
                      className="accent-indigo-500"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'truefalse' && (
              <div className="mt-3 flex gap-3">
                {['True', 'False'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => saveAnswer(q.id, opt)}
                    className={`rounded-xl border px-5 py-2 text-sm font-semibold transition ${answers[q.id] === opt ? 'border-indigo-400/60 bg-indigo-500/20 text-slate-900' : 'border-slate-200 bg-slate-100 text-slate-500'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {q.type === 'short' && (
              <textarea
                className="field mt-3 min-h-24"
                placeholder="Type your answer… (graded by your teacher)"
                value={answers[q.id] ?? ''}
                onChange={(e) => saveAnswer(q.id, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <button className="btn-primary !px-8 !py-3" disabled={submitting} onClick={() => submit()}>
          {submitting ? 'Submitting…' : 'Submit Test'}
        </button>
      </div>
    </div>
  )
}

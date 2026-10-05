import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader, EmptyState, Progress } from '../../components/ui'
import type { QuizAttempt, Quiz, Question, Answer } from '../../lib/types'

export default function QuizResult() {
  const { attemptId } = useParams()
  const [search] = useSearchParams()
  const autoSubmitted = search.get('auto') === '1'
  const { session } = useAuth()
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!attemptId || !session) return
    // Server returns attempt + quiz + questions (incl. answers for review) + saved answers
    supabase.rpc('get_attempt_review', { p_attempt_id: attemptId }).then(({ data }) => {
      const r = data as {
        attempt: QuizAttempt
        quiz: Quiz
        questions: Question[]
        answers: Answer[]
      } | null
      if (r) {
        setAttempt(r.attempt)
        setQuiz(r.quiz)
        setQuestions(r.questions ?? [])
        setAnswers(r.answers ?? [])
      }
      setLoading(false)
    })
  }, [attemptId, session])

  if (loading) return <PageLoader />
  if (!attempt || !quiz) return <EmptyState icon="🫥" title="Result not found" />

  const pct = attempt.total_marks ? Math.round((Number(attempt.score) / Number(attempt.total_marks)) * 100) : 0
  const ansByQ = new Map(answers.map((a) => [a.question_id, a]))

  return (
    <div className="mx-auto max-w-3xl">
      <div className="glass-strong rounded-3xl p-8 text-center">
        <p className="text-5xl">{pct >= 80 ? '🏆' : pct >= 50 ? '👏' : '💪'}</p>
        <h1 className="font-display mt-3 text-2xl font-bold text-slate-900">{quiz.title} — Result</h1>
        {autoSubmitted && <p className="mt-1 text-sm text-amber-600">Time expired — submitted automatically.</p>}
        <p className="font-display mt-4 text-4xl font-extrabold text-gradient">
          {Number(attempt.score)} / {Number(attempt.total_marks)}
        </p>
        <div className="mx-auto mt-4 max-w-sm"><Progress value={pct} /></div>
        <p className="mt-2 text-sm text-slate-500">{pct}% correct</p>
      </div>

      <div className="mt-6 space-y-4">
        {questions.map((q, i) => {
          const a = ansByQ.get(q.id)
          const objective = q.type !== 'short'
          return (
            <div key={q.id} className="glass rounded-2xl p-5">
              <p className="font-medium text-slate-900">
                <span className="mr-2 text-indigo-600">Q{i + 1}.</span>{q.text}
              </p>
              <div className="mt-3 space-y-1.5 text-sm">
                <p className="text-slate-500">Your answer: <span className="font-semibold text-slate-900">{a?.answer_text || '—'}</span></p>
                {!objective && <p className="text-slate-500">Correct answer: <span className="font-semibold text-emerald-600">{q.correct_answer}</span></p>}
                <p className={objective ? (a?.is_correct ? 'text-emerald-600' : 'text-red-600') : 'text-amber-600'}>
                  {objective ? (a?.is_correct ? '✓ Correct' : '✗ Incorrect') : '⏳ Short answer — reviewed by your teacher'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Link to={`/learn/${quiz.course_id}`} className="btn-primary">Back to Course</Link>
        <Link to="/my-courses" className="btn-ghost">My Courses</Link>
      </div>
    </div>
  )
}

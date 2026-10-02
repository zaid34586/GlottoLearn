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
    Promise.all([
      supabase.from('quiz_attempts').select('*').eq('id', attemptId).single(),
    ]).then(async ([a]) => {
      const att = a.data as QuizAttempt
      setAttempt(att)
      if (att) {
        const [q, qs, ans] = await Promise.all([
          supabase.from('quizzes').select('*').eq('id', att.quiz_id).single(),
          supabase.from('questions').select('*').eq('quiz_id', att.quiz_id).order('position'),
          supabase.from('answers').select('*').eq('attempt_id', attemptId),
        ])
        setQuiz(q.data as Quiz)
        setQuestions((qs.data as Question[]) ?? [])
        setAnswers((ans.data as Answer[]) ?? [])
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
        <h1 className="font-display mt-3 text-2xl font-bold text-white">{quiz.title} — Result</h1>
        {autoSubmitted && <p className="mt-1 text-sm text-amber-300">Time expired — submitted automatically.</p>}
        <p className="font-display mt-4 text-4xl font-extrabold text-gradient">
          {Number(attempt.score)} / {Number(attempt.total_marks)}
        </p>
        <div className="mx-auto mt-4 max-w-sm"><Progress value={pct} /></div>
        <p className="mt-2 text-sm text-white/50">{pct}% correct</p>
      </div>

      <div className="mt-6 space-y-4">
        {questions.map((q, i) => {
          const a = ansByQ.get(q.id)
          const objective = q.type !== 'short'
          return (
            <div key={q.id} className="glass rounded-2xl p-5">
              <p className="font-medium text-white">
                <span className="mr-2 text-indigo-300">Q{i + 1}.</span>{q.text}
              </p>
              <div className="mt-3 space-y-1.5 text-sm">
                <p className="text-white/60">Your answer: <span className="font-semibold text-white">{a?.answer_text || '—'}</span></p>
                {!objective && <p className="text-white/60">Correct answer: <span className="font-semibold text-emerald-300">{q.correct_answer}</span></p>}
                <p className={objective ? (a?.is_correct ? 'text-emerald-300' : 'text-red-300') : 'text-amber-300'}>
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

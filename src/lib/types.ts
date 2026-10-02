export type Role = 'student' | 'teacher' | 'admin'

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: Role
  created_at: string
}

export interface Language {
  id: number
  name: string
  code: string
  description: string | null
  is_active: boolean
}

export interface Course {
  id: string
  title: string
  description: string | null
  language_id: number | null
  level: string
  price_inr: number
  cover_url: string | null
  teacher_id: string | null
  status: 'draft' | 'published'
  created_at: string
  language?: Language
  teacher?: Profile
}

export interface Module {
  id: string
  course_id: string
  title: string
  position: number
}

export interface Lesson {
  id: string
  module_id: string
  course_id: string
  title: string
  type: 'video' | 'material'
  video_path: string | null
  content: string | null
  duration_sec: number
  position: number
}

export interface Batch {
  id: string
  course_id: string
  teacher_id: string
  title: string
  scheduled_at: string
  duration_min: number
  status: 'scheduled' | 'live' | 'completed' | 'cancelled'
  created_at: string
  course?: Course
}

export interface Enrollment {
  id: string
  course_id: string
  student_id: string
  payment_id: string | null
  enrolled_at: string
  course?: Course
}

export interface Payment {
  id: string
  student_id: string
  course_id: string
  amount: number
  currency: string
  gateway: string
  gateway_ref: string | null
  status: 'pending' | 'paid' | 'failed'
  created_at: string
  student?: Profile
  course?: Course
}

export interface LessonProgress {
  id: string
  lesson_id: string
  student_id: string
  completed: boolean
  seconds_watched: number
}

export interface Recording {
  id: string
  course_id: string
  batch_id: string | null
  title: string
  video_path: string
  duration_sec: number
  created_by: string | null
  created_at: string
}

export type QuestionType = 'mcq' | 'truefalse' | 'short'

export interface Quiz {
  id: string
  course_id: string
  title: string
  description: string | null
  time_limit_min: number
  is_graded: boolean
  created_by: string | null
  created_at: string
}

export interface Question {
  id: string
  quiz_id: string
  text: string
  type: QuestionType
  options: string[]
  correct_answer: string
  marks: number
  position: number
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  student_id: string
  started_at: string
  submitted_at: string | null
  score: number
  total_marks: number
  status: 'in_progress' | 'submitted' | 'graded'
}

export interface Answer {
  id: string
  attempt_id: string
  question_id: string
  answer_text: string
  is_correct: boolean | null
  marks_awarded: number
}

export interface Material {
  id: string
  course_id: string
  title: string
  file_path: string
  uploaded_by: string | null
  created_at: string
}

export interface Announcement {
  id: string
  course_id: string | null
  author_id: string | null
  title: string
  body: string
  created_at: string
}

export interface Attendance {
  id: string
  batch_id: string
  student_id: string
  joined_at: string
  left_at: string | null
  duration_sec: number
}

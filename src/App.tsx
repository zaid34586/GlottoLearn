import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PublicLayout, AppLayout } from './components/Layout'
import { RequireAuth, RequireRole, RequireAdmin } from './components/Guards'

import Landing from './pages/Landing'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'

import StudentDashboard from './pages/student/StudentDashboard'
import MyCourses from './pages/student/MyCourses'
import CoursePlayer from './pages/student/CoursePlayer'
import LiveClasses from './pages/student/LiveClasses'
import QuizTake from './pages/student/QuizTake'
import QuizResult from './pages/student/QuizResult'

import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherBatches from './pages/teacher/TeacherBatches'
import CourseBuilder from './pages/teacher/CourseBuilder'

import LiveClassroom from './pages/classroom/LiveClassroom'

import AdminLogin from './pages/admin/AdminLogin'
import AdminOverview from './pages/admin/AdminOverview'
import AdminCourses from './pages/admin/AdminCourses'
import AdminPeople from './pages/admin/AdminPeople'
import AdminPayments from './pages/admin/AdminPayments'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:courseId" element={<CourseDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          {/* Shared (any authenticated role) */}
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/live/:batchId" element={<LiveClassroom />} />
          </Route>

          {/* Student */}
          <Route element={<RequireRole roles={['student']}><AppLayout /></RequireRole>}>
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/my-courses" element={<MyCourses />} />
            <Route path="/learn/:courseId" element={<CoursePlayer />} />
            <Route path="/live-classes" element={<LiveClasses />} />
            <Route path="/quiz/:quizId" element={<QuizTake />} />
            <Route path="/quiz-result/:attemptId" element={<QuizResult />} />
          </Route>

          {/* Teaching studio — admin manages content (teacher program aayega baad me, payments ke baad) */}
          <Route element={<RequireRole roles={['teacher', 'admin']}><AppLayout /></RequireRole>}>
            <Route path="/teach" element={<TeacherDashboard />} />
            <Route path="/teach/courses/:courseId" element={<CourseBuilder />} />
            <Route path="/teach/batches" element={<TeacherBatches />} />
          </Route>

          {/* Admin portal — separate URL and login */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<RequireAdmin><AppLayout /></RequireAdmin>}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/courses" element={<AdminCourses />} />
            <Route path="/admin/people" element={<AdminPeople />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

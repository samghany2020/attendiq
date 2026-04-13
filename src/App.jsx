import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import LandingPage  from './pages/LandingPage'
import LoginPage    from './pages/LoginPage'
import Dashboard    from './pages/Dashboard'
import SessionPage  from './pages/SessionPage'
import AttendPage   from './pages/AttendPage'
import ReportPage   from './pages/ReportPage'
import HistoryPage  from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import AdminPage    from './pages/AdminPage'
import CourseRosterPage  from './pages/CourseRosterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="loading-screen">
      <div className="logo-academic">
        <svg width="34" height="34" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="10" fill="url(#lg1)"/><path d="M14 20L17 23L22 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><defs><linearGradient id="lg1" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#1a4731"/><stop offset="1" stopColor="#0f2d1e"/></linearGradient></defs></svg>
        <span>AttendIQ</span>
      </div>
      <div className="spinner" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"            element={<LandingPage />} />
            <Route path="/login"       element={<LoginPage />} />
            <Route path="/dashboard"   element={<Guard><Dashboard /></Guard>} />
            <Route path="/session/:id" element={<Guard><SessionPage /></Guard>} />
            <Route path="/report/:id"  element={<Guard><ReportPage /></Guard>} />
            <Route path="/history"     element={<Guard><HistoryPage /></Guard>} />
            <Route path="/settings"    element={<Guard><SettingsPage /></Guard>} />
            <Route path="/admin"       element={<Guard><AdminPage /></Guard>} />
            <Route path="/course/:id/roster" element={<Guard><CourseRosterPage /></Guard>} />
            <Route path="/attend/:id"       element={<AttendPage />} />
            <Route path="/reset-password"       element={<ResetPasswordPage />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

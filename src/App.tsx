import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { isSupabaseConfigured } from './lib/supabase'
import TabBar from './components/TabBar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Shelf from './pages/Shelf'
import Notices from './pages/Notices'
import Settings from './pages/Settings'
import SetupNeeded from './pages/SetupNeeded'
import CreateStore from './pages/CreateStore'
import JoinStore from './pages/JoinStore'
import Manage from './pages/Manage'
import CategoryNew from './pages/CategoryNew'
import CategoryDetail from './pages/CategoryDetail'
import CategorySettings from './pages/CategorySettings'
import Register from './pages/Register'
import ProductEdit from './pages/ProductEdit'
import Process from './pages/Process'
import History from './pages/History'
import RoleSetup from './pages/RoleSetup'
import NoticeDetail from './pages/NoticeDetail'
import NoticeEdit from './pages/NoticeEdit'

/** 로그인한 사람만 들어오는 영역: 하단 탭이 있어요 */
function ProtectedLayout() {
  const { session, loading, profile, profileLoaded } = useAuth()
  if (loading || (session && !profileLoaded)) return <div className="empty">불러오는 중…</div>
  if (!session) return <Navigate to="/login" replace />
  // 가입 직후: 이름·점주/알바를 먼저 정해요
  if (profile && profile.user_type === null) return <RoleSetup />
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  )
}

/** 이미 로그인했으면 로그인/회원가입 화면 대신 홈으로 보내요 */
function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="empty">불러오는 중…</div>
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  if (!isSupabaseConfigured) return <div className="app"><SetupNeeded /></div>

  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shelf" element={<Shelf />} />
          <Route path="/shelf/new" element={<CategoryNew />} />
          <Route path="/shelf/:categoryId" element={<CategoryDetail />} />
          <Route path="/shelf/:categoryId/settings" element={<CategorySettings />} />
          <Route path="/shelf/:categoryId/register" element={<Register />} />
          <Route path="/shelf/:categoryId/products/:productId" element={<ProductEdit />} />
          <Route path="/process/:productId" element={<Process />} />
          <Route path="/history" element={<History />} />
          <Route path="/notices" element={<Notices />} />
          <Route path="/notices/new" element={<NoticeEdit />} />
          <Route path="/notices/:noticeId" element={<NoticeDetail />} />
          <Route path="/notices/:noticeId/edit" element={<NoticeEdit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/store/new" element={<CreateStore />} />
          <Route path="/join" element={<JoinStore />} />
          <Route path="/manage" element={<Manage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

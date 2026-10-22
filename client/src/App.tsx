import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from './store';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleRoute from './components/auth/RoleRoute';

// Pages
import LoginPage from './pages/LoginPage';
import ManagerDashboardPage from './pages/ManagerDashboardPage';
import MyWorkPage from './pages/MyWorkPage';
import ProjectsPage from './pages/ProjectsPage';
import KanbanPage from './pages/KanbanPage';
import KpiPage from './pages/KpiPage';
import AIAssistantPage from './pages/AIAssistantPage';
import CalendarPage from './pages/CalendarPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';

export { ProtectedRoute, AppLayout };

export const App: React.FC = () => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('accessToken') || localStorage.getItem('token')
      : null;
  const isAuth = isAuthenticated || Boolean(token);
  const homePath = user?.role === 'ADMIN'
    ? '/admin'
    : user?.role === 'MANAGER'
    ? '/manager'
    : user?.role === 'EMPLOYEE'
    ? '/my-work'
    : '/login';

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isAuth ? homePath : '/login'} replace />}
      />

      {/* Trang xác thực công khai */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth-callback" element={<OAuthCallbackPage />} />

      {/* Các Route được bảo vệ với chung Layout (Sidebar + Topbar + Realtime Feed) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Navigate to={homePath} replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id/kanban" element={<KanbanPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/kpi" element={<KpiPage />} />
          <Route path="/ai-assistant" element={<AIAssistantPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<RoleRoute role="ADMIN" />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route element={<RoleRoute role="MANAGER" />}>
            <Route path="/manager" element={<ManagerDashboardPage />} />
          </Route>
          <Route element={<RoleRoute role="EMPLOYEE" />}>
            <Route path="/my-work" element={<MyWorkPage />} />
          </Route>
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to={isAuth ? homePath : '/login'} replace />}
      />
    </Routes>
  );
};

export default App;

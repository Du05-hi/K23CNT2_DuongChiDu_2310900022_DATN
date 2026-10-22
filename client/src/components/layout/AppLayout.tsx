import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FolderKanban,
  Target,
  Bot,
  User,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  useAppDispatch,
  useAppSelector,
  toggleSidebar,
  toggleActivityFeed,
  setTheme,
} from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/api/apiClient';
import NotificationBell from '../NotificationBell';
import ActivityAndFocusDrawer from './ActivityAndFocusDrawer';

export const AppLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, logout, fetchCurrentUser } = useAuth();
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar]);

  useEffect(() => {
    const handleProfileUpdated = () => {
      setAvatarError(false);
      fetchCurrentUser();
    };
    window.addEventListener('user-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('user-profile-updated', handleProfileUpdated);
  }, [fetchCurrentUser]);

  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const activityFeedOpen = useAppSelector((state) => state.ui.activityFeedOpen);
  const currentTheme = useAppSelector((state) => state.ui.theme);
  const homePath = user?.role === 'ADMIN'
    ? '/admin'
    : user?.role === 'MANAGER'
    ? '/manager'
    : '/my-work';

  // Real-time project count badge
  const { data: projectCount = 0 } = useQuery({
    queryKey: ['sidebar-project-count', user?.id],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>('/projects');
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        return list.length;
      } catch {
        return 0;
      }
    },
    staleTime: 30000,
  });

  // Real-time KPI rank badge
  const { data: userKpiRank = '' } = useQuery({
    queryKey: ['sidebar-user-kpi-rank', user?.id],
    queryFn: async () => {
      if (!user?.id) return '';
      try {
        const res = await apiClient.get<any>('/kpi/my-kpi');
        const currentKpi = res.data?.data?.currentKpi || res.data?.currentKpi;
        if (currentKpi?.rank) {
          const letter = currentKpi.rank.split(' ')[0];
          return `Hạng ${letter}`;
        }
        if (typeof currentKpi?.totalScore === 'number' && currentKpi.totalScore > 0) {
          return `${currentKpi.totalScore}đ`;
        }
        return 'Hạng A';
      } catch {
        return 'Hạng A';
      }
    },
    staleTime: 60000,
  });

  const navItems = [
    {
      name: user?.role === 'ADMIN' ? 'Quản trị hệ thống' : user?.role === 'MANAGER' ? 'Tổng quan nhóm' : 'Công việc của tôi',
      path: homePath,
      icon: LayoutDashboard,
    },
    {
      name: 'Dự án',
      path: '/projects',
      icon: FolderKanban,
      badge: projectCount > 0 ? `${projectCount}` : null,
      badgeStyle: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 font-extrabold',
    },
    {
      name: 'Lịch làm việc',
      path: '/calendar',
      icon: CalendarIcon,
    },
    {
      name: 'Đánh giá KPI',
      path: '/kpi',
      icon: Target,
      badge: userKpiRank || 'Hạng A',
      badgeStyle: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-black',
    },
    {
      name: 'AI Assistant',
      path: '/ai-assistant',
      icon: Bot,
      badge: 'AI',
      badgeStyle: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-extrabold shadow-xs ring-2 ring-purple-500/20 animate-pulse',
    },
    {
      name: 'Hồ sơ cá nhân',
      path: '/profile',
      icon: User,
    },
  ];

  const handleToggleTheme = () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    dispatch(setTheme(nextTheme));
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-all duration-300 ease-in-out md:static ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Logo & Mini Collapse Toggle */}
        <div className="flex h-16 items-center justify-between px-3.5 border-b border-slate-200 dark:border-slate-800">
          <div
            onClick={() => navigate(homePath)}
            className="flex items-center gap-3 cursor-pointer select-none overflow-hidden"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30">
              ⚡
            </div>
            {sidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-base font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent truncate">
                  TaskFlow AI
                </span>
                <span className="text-[10px] text-slate-500 font-medium truncate">Enterprise Management</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Collapse Toggle for Desktop (Mini Sidebar mode) */}
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="hidden md:flex p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={sidebarOpen ? "Thu gọn Sidebar (Mini Mode)" : "Mở rộng Sidebar"}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={!sidebarOpen ? `${item.name}${item.badge ? ` [${item.badge}]` : ''}` : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group relative ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  } ${!sidebarOpen && 'justify-center'}`
                }
              >
                <div className="relative flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 shrink-0" />
                  {!sidebarOpen && item.badge && (
                    <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>
                {sidebarOpen && <span className="flex-1 truncate">{item.name}</span>}
                {sidebarOpen && item.badge && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${item.badgeStyle}`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Mini Profile & Logout */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-3">
          <div
            onClick={() => navigate('/profile')}
            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition ${
              !sidebarOpen && 'justify-center'
            }`}
          >
            <div className="relative shrink-0">
              {user?.avatar && !avatarError ? (
                <img
                  src={user.avatar}
                  alt={user.fullName || user.name || 'Avatar'}
                  onError={() => setAvatarError(true)}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/30 shadow shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shadow ring-2 ring-indigo-500/30 shrink-0">
                  {(user?.fullName || user?.name)?.trim().charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
                  {user?.fullName || user?.name || 'Tài khoản'}
                </p>
                <p className="text-[11px] text-slate-500 truncate capitalize">{user?.role || 'Nhân viên'}</p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  logout();
                }}
                title="Đăng xuất"
                className="p-1.5 text-slate-400 hover:text-rose-500 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* HEADER TOPBAR */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 md:px-6 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition"
              title="Ẩn/Hiện Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              ⚡ Hệ thống quản lý công việc & KPI
            </span>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={handleToggleTheme}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Chuyển đổi giao diện Sáng / Tối"
            >
              {currentTheme === 'dark' ? (
                <Sun className="h-5 w-5 text-amber-400" />
              ) : (
                <Moon className="h-5 w-5 text-slate-600" />
              )}
            </button>

            <NotificationBell />

            {/* Realtime Activity Feed Button */}
            <button
              onClick={() => dispatch(toggleActivityFeed())}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activityFeedOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span className="hidden md:inline">Hoạt động</span>
            </button>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="relative flex flex-1 overflow-hidden">
          {/* Main Route Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>

        {/* SLIDE-OVER DRAWER: NHẬT KÝ HOẠT ĐỘNG LIVE & POMODORO DEEP WORK STUDIO */}
        <ActivityAndFocusDrawer
          isOpen={activityFeedOpen}
          onClose={() => dispatch(toggleActivityFeed(false))}
        />
      </div>
    </div>
  );
};

export default AppLayout;

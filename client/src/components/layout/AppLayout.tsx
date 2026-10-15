import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import {
  useAppDispatch,
  useAppSelector,
  toggleSidebar,
  toggleActivityFeed,
  setTheme,
} from '@/store';
import { useAuth } from '@/hooks/useAuth';
import NotificationBell from '../NotificationBell';

export const AppLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const activityFeedOpen = useAppSelector((state) => state.ui.activityFeedOpen);
  const currentTheme = useAppSelector((state) => state.ui.theme);
  const homePath = user?.role === 'ADMIN'
    ? '/admin'
    : user?.role === 'MANAGER'
    ? '/manager'
    : '/my-work';

  const navItems = [
    {
      name: user?.role === 'ADMIN' ? 'Quản trị hệ thống' : user?.role === 'MANAGER' ? 'Tổng quan nhóm' : 'Công việc của tôi',
      path: homePath,
      icon: LayoutDashboard,
    },
    { name: 'Dự án', path: '/projects', icon: FolderKanban },
    { name: 'Đánh giá KPI', path: '/kpi', icon: Target },
    { name: 'AI Assistant', path: '/ai-assistant', icon: Bot, badge: 'AI' },
    { name: 'Hồ sơ cá nhân', path: '/profile', icon: User },
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
        {/* Brand Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
          <div
            onClick={() => navigate(homePath)}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30">
              ⚡
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="text-base font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  TaskFlow AI
                </span>
                <span className="text-[11px] text-slate-500 font-medium">Enterprise Management</span>
              </div>
            )}
          </div>
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  } ${!sidebarOpen && 'justify-center'}`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span className="flex-1 truncate">{item.name}</span>}
                {sidebarOpen && item.badge && (
                  <span className="ml-auto rounded-full bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
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
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shadow">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
                  {user?.name || 'Tài khoản'}
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

        {/* CONTENT AREA & SIDE FEED DRAWER */}
        <div className="relative flex flex-1 overflow-hidden">
          {/* Main Route Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>

          {/* REALTIME ACTIVITY FEED DRAWER */}
          {activityFeedOpen && (
            <aside className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 flex flex-col gap-4 overflow-y-auto shadow-xl z-20">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-500" />
                  <h3 className="font-semibold text-sm">Realtime Feed</h3>
                </div>
                <button
                  onClick={() => dispatch(toggleActivityFeed(false))}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <Sparkles className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">AI Assistant cập nhật</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Đã hoàn thành đánh giá hiệu suất nhân sự tuần 42
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">5 phút trước</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Nhiệm vụ hoàn thành</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Hoàn thiện API xác thực người dùng và phân quyền
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">15 phút trước</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Deadline sắp tới</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Dự án Sprint 4 kết thúc trong vòng 24 giờ tới
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">1 giờ trước</span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;

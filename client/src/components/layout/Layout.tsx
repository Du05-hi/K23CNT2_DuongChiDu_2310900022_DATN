import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Search,
  Activity,
  ChevronRight,
  Plus,
  Home,
} from 'lucide-react';
import Sidebar, { SidebarUser } from './Sidebar';
import NotificationBell from '../NotificationBell';
import RealtimeActivityFeed from '../RealtimeActivityFeed';
import AIAssistantModal from '../AIAssistantModal';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  currentPath?: string;
  onNavigate?: (path: string) => void;
  currentUser?: SidebarUser;
  onLogout?: () => void;
  onQuickCreateTask?: () => void;
}

const defaultUser: SidebarUser = {
  id: 'current-user-1',
  fullName: 'Dương Chí Du',
  email: 'duongchidu@taskflow.vn',
  role: 'ADMIN',
};

export const Layout: React.FC<LayoutProps> = ({
  children,
  title = 'Tổng quan hệ thống',
  breadcrumbs = [{ label: 'Trang chủ', href: '/dashboard' }, { label: 'Tổng quan' }],
  currentPath = '/dashboard',
  onNavigate,
  currentUser = defaultUser,
  onLogout,
  onQuickCreateTask,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isActivityFeedOpen, setIsActivityFeedOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleNavigate = (path: string) => {
    setIsMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden md:flex shrink-0">
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          currentPath={currentPath}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onLogout={onLogout}
        />
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Sidebar Container */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10"
            >
              <Sidebar
                collapsed={false}
                currentPath={currentPath}
                onNavigate={handleNavigate}
                currentUser={currentUser}
                onLogout={onLogout}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-18 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
          {/* Left Header: Mobile Toggle & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger on Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
              <span
                onClick={() => handleNavigate('/dashboard')}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Trang chủ</span>
              </span>

              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span
                    onClick={() => crumb.href && handleNavigate(crumb.href)}
                    className={`truncate ${
                      crumb.href
                        ? 'hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer'
                        : 'font-semibold text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {crumb.label}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Right Header: Search & Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Quick Search Input */}
            <div className="relative hidden lg:block w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm công việc, dự án..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>

            {/* Quick Create Task Button */}
            {onQuickCreateTask && (
              <button
                onClick={onQuickCreateTask}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Thêm Task</span>
              </button>
            )}

            {/* Toggle Realtime Activity Feed */}
            <button
              onClick={() => setIsActivityFeedOpen(!isActivityFeedOpen)}
              className="relative p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Nhật ký hoạt động realtime"
            >
              <Activity className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            </button>

            {/* Notification Bell */}
            <NotificationBell />
          </div>
        </header>

        {/* Main Body View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>

      {/* Realtime Activity Feed Slide-over */}
      <RealtimeActivityFeed
        isOpen={isActivityFeedOpen}
        onClose={() => setIsActivityFeedOpen(false)}
      />

      {/* AI Assistant Modal & Floating trigger */}
      <AIAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
};

export default Layout;

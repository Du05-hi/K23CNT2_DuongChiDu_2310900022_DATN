import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FolderKanban,
  Kanban,
  BarChart3,
  Sparkles,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Flame,
  Calendar,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';

export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface SidebarUser {
  id: string;
  fullName: string;
  name?: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  avatar?: string;
}

export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  currentUser?: SidebarUser;
  onLogout?: () => void;
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  isAiSpecial?: boolean;
  badgeType?: 'project' | 'kpi' | 'ai';
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'projects',
    label: 'Dự án',
    path: '/projects',
    icon: FolderKanban,
    badgeType: 'project',
  },
  {
    id: 'calendar',
    label: 'Lịch làm việc',
    path: '/calendar',
    icon: Calendar,
  },
  {
    id: 'kanban',
    label: 'Kanban Board',
    path: '/kanban',
    icon: Kanban,
  },
  {
    id: 'kpi',
    label: 'Đánh giá KPI',
    path: '/kpi',
    icon: BarChart3,
    badgeType: 'kpi',
  },
  {
    id: 'ai-assistant',
    label: 'AI Assistant',
    path: '/ai-assistant',
    icon: Sparkles,
    isAiSpecial: true,
    badgeType: 'ai',
  },
  {
    id: 'admin',
    label: 'Admin Panel',
    path: '/admin',
    icon: Shield,
    adminOnly: true,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
  currentPath = '/dashboard',
  onNavigate,
  currentUser,
  onLogout,
  className = '',
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = onToggleCollapse !== undefined ? collapsed : internalCollapsed;

  // Real-time project count badge
  const { data: projectCount = 0 } = useQuery({
    queryKey: ['sidebar-project-count', currentUser?.id],
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
    queryKey: ['sidebar-user-kpi-rank', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return '';
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

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const handleItemClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
  };

  // Filter items based on user role
  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && currentUser?.role !== 'ADMIN') {
      return false;
    }
    return true;
  });

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`relative flex flex-col h-screen border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors z-30 select-none ${className}`}
    >
      {/* Top Header Logo */}
      <div className="flex items-center justify-between h-18 px-4 border-b border-slate-100 dark:border-slate-800">
        <div
          onClick={() => handleItemClick('/dashboard')}
          className="flex items-center gap-3 cursor-pointer overflow-hidden"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-600/30">
            <Flame className="w-5 h-5" />
          </div>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap"
              >
                <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  TaskFlow AI
                </h1>
                <p className="text-[10px] text-slate-400 font-medium">Enterprise Management</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toggle Collapse Button */}
        <button
          onClick={handleToggle}
          className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {filteredNavItems.map((item) => {
          const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
          const Icon = item.icon;

          return (
            <motion.button
              key={item.id}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleItemClick(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all group relative ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <div
                className={`relative flex items-center justify-center shrink-0 ${
                  isActive ? 'text-white' : item.isAiSpecial ? 'text-indigo-600 dark:text-indigo-400' : ''
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'drop-shadow-sm' : 'group-hover:scale-110 transition-transform'
                  }`}
                />
              </div>

              {/* Label + Badges when not collapsed */}
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 flex items-center justify-between overflow-hidden whitespace-nowrap"
                  >
                    <span className="truncate">{item.label}</span>

                    {/* Project count Badge */}
                    {item.badgeType === 'project' && projectCount > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300'
                        }`}
                      >
                        {projectCount}
                      </span>
                    )}

                    {/* KPI Rank Badge */}
                    {item.badgeType === 'kpi' && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {userKpiRank || 'Hạng A'}
                      </span>
                    )}

                    {/* AI Special Badge */}
                    {item.isAiSpecial && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-xs ring-2 ring-purple-500/20 animate-pulse'
                        }`}
                      >
                        AI
                      </span>
                    )}

                    {/* Admin Shield Badge */}
                    {item.adminOnly && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        Admin
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active glow indicator on left */}
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-white/40" />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* User Profile Section at Bottom */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } gap-2 rounded-2xl p-2 transition hover:bg-white dark:hover:bg-slate-800`}
        >
          {/* User Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              src={currentUser?.avatarUrl || currentUser?.avatar}
              name={currentUser?.fullName || currentUser?.name || 'Tài khoản'}
              size="md"
              status="online"
            />

            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="min-w-0 flex-1"
                >
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {currentUser?.fullName || 'Tài khoản'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      variant={
                        currentUser?.role === 'ADMIN'
                          ? 'danger'
                          : currentUser?.role === 'MANAGER'
                          ? 'warning'
                          : 'default'
                      }
                      size="sm"
                    >
                      {currentUser?.role || 'EMPLOYEE'}
                    </Badge>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Logout Button */}
          {!isCollapsed && (
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;

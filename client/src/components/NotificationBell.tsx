import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Info,
  FolderKanban,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  Notification,
  NotificationType,
  notificationService,
} from '../services/notificationService';
import taskService from '../services/taskService';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';

export interface NotificationBellProps {
  initialNotifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  className?: string;
}

// Relative time formatting in Vietnamese
const formatRelativeTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Vừa xong';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
};

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'TASK_ASSIGNED':
      return <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    case 'TASK_STATUS_CHANGED':
    case 'TASK_COMPLETED':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case 'COMMENT_ADDED':
      return <MessageSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
    case 'KPI_GENERATED':
      return <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    case 'PROJECT_INVITATION':
      return <FolderKanban className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    case 'SYSTEM':
    default:
      return <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
  }
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  initialNotifications,
  onNotificationClick,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications ?? []);
  const [hasNewPulse, setHasNewPulse] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const displayedNotifications = filterTab === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setHasNewPulse(true);

      // Trigger instant toast notification at top-right
      toast.info(notification.title, {
        description: notification.message,
        duration: 5000,
      });

      if (notification.type === 'TASK_ASSIGNED' || notification.type === 'TASK_STATUS_CHANGED') {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['role-dashboard'] }),
          queryClient.invalidateQueries({ queryKey: ['my-work'] }),
          queryClient.invalidateQueries({ queryKey: ['tasks'] }),
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
        ]);
      } else if (notification.type === 'KPI_GENERATED') {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['kpiEmployees'] }),
          queryClient.invalidateQueries({ queryKey: ['kpiTrends'] }),
          queryClient.invalidateQueries({ queryKey: ['my-kpi'] }),
        ]);
      }

      // Auto clear pulse after 8 seconds
      setTimeout(() => {
        setHasNewPulse(false);
      }, 8000);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [queryClient, socket]);

  // Fetch notifications on mount
  useEffect(() => {
    let isMounted = true;
    const fetchNotifs = async () => {
      try {
        const res = await notificationService.getNotifications(20, 1);
        if (isMounted && Array.isArray(res.notifications)) {
          setNotifications(res.notifications);
        }
      } catch (error) {
        console.error('Không thể tải thông báo:', error);
      }
    };
    fetchNotifs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setHasNewPulse(false);
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc!');
    } catch (error) {
      console.error('Không thể đánh dấu tất cả thông báo đã đọc:', error);
      toast.error('Không thể cập nhật trạng thái thông báo.');
    }
  };

  const handleItemClick = async (notif: Notification) => {
    if (!notif.isRead) {
      try {
        await notificationService.markAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
      } catch (error) {
        console.error('Không thể đánh dấu thông báo đã đọc:', error);
      }
    }

    if (onNotificationClick) {
      onNotificationClick(notif);
      return;
    }

    // Default route navigation based on notification type
    setIsOpen(false);

    // Xử lý điều hướng thông báo công việc đến đúng Kanban của dự án kèm highlightTaskId
    if (
      notif.type === 'TASK_ASSIGNED' ||
      notif.type === 'TASK_STATUS_CHANGED' ||
      notif.type === 'TASK_UPDATED' ||
      notif.type === 'TASK_COMPLETED' ||
      notif.title.toLowerCase().includes('công việc')
    ) {
      let targetProjectId: string | null = null;
      let targetTaskId: string | null = null;

      if (notif.relatedId) {
        if (notif.relatedId.includes(':')) {
          const [pId, tId] = notif.relatedId.split(':');
          targetProjectId = pId;
          targetTaskId = tId;
        } else {
          try {
            const task = await taskService.getTaskById(notif.relatedId);
            if (task && task.projectId) {
              targetProjectId = task.projectId;
              targetTaskId = task.id;
            }
          } catch (error) {
            console.warn('Không thể truy xuất thông tin dự án của task:', error);
          }
        }
      }

      if (targetProjectId && targetTaskId) {
        navigate(`/projects/${targetProjectId}/kanban?highlightTaskId=${targetTaskId}`);
        return;
      } else if (targetProjectId) {
        navigate(`/projects/${targetProjectId}/kanban`);
        return;
      }
      navigate('/projects');
      return;
    }

    if (notif.type === 'KPI_GENERATED') {
      navigate('/kpi');
    } else if (notif.type === 'PROJECT_INVITATION') {
      navigate('/projects');
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (hasNewPulse) setHasNewPulse(false);
        }}
        className={`relative rounded-2xl p-2.5 transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        aria-label="Thông báo"
        title="Trung tâm thông báo Real-time"
      >
        <Bell className={`w-5 h-5 ${hasNewPulse ? 'animate-bounce text-indigo-600 dark:text-indigo-400' : ''}`} />

        {/* Unread Badge (Red Badge Count) */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[19px] h-[19px] px-1 text-[10px] font-black text-white bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-md ${
              hasNewPulse ? 'animate-pulse ring-4 ring-rose-400/40' : ''
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 mt-2.5 w-84 sm:w-96 rounded-3xl bg-white/95 dark:bg-slate-900/95 shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden z-50 backdrop-blur-2xl"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Trung Tâm Thông Báo
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
                  </span>
                </div>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Đánh dấu tất cả thông báo là đã đọc"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Đọc tất cả</span>
                </button>
              )}
            </div>

            {/* Filter Tabs Switcher */}
            <div className="flex p-1.5 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 text-xs gap-1">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Tất cả ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterTab === 'unread'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Chưa đọc ({unreadCount})
              </button>
            </div>

            {/* Notification Items List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
              {displayedNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-500 mb-2.5">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {filterTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px]">
                    Thông báo mới về công việc, dự án và KPI sẽ xuất hiện ngay lập tức tại đây.
                  </p>
                </div>
              ) : (
                displayedNotifications.slice(0, 15).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-start gap-3 p-3.5 transition-all cursor-pointer ${
                      !item.isRead
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 border-l-4 border-indigo-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-100/90 dark:bg-slate-800 shadow-sm">
                      {getNotificationIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <p
                          className={`text-xs truncate ${
                            !item.isRead
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-semibold text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    {!item.isRead && (
                      <span
                        className="mt-2 h-2 w-2 rounded-full bg-indigo-600 shrink-0 animate-pulse"
                        title="Chưa đọc"
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 text-center">
              <span className="text-[10px] text-slate-400 font-semibold inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Thời gian thực WebSocket (Socket.io) • Tự động đồng bộ
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
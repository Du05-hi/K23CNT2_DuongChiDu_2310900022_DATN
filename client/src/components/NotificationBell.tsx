import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Info,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import {
  Notification,
  NotificationType,
  notificationService,
} from '../services/notificationService';
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
      return <Clock className="w-4 h-4 text-indigo-500" />;
    case 'TASK_STATUS_CHANGED':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'COMMENT_ADDED':
      return <MessageSquare className="w-4 h-4 text-sky-500" />;
    case 'KPI_GENERATED':
      return <Award className="w-4 h-4 text-purple-500" />;
    case 'SYSTEM':
    default:
      return <Info className="w-4 h-4 text-slate-500" />;
  }
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  initialNotifications,
  onNotificationClick,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications ?? []);
  const [hasNewPulse, setHasNewPulse] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setHasNewPulse(true);
      toast.info(notification.title, { description: notification.message });

      if (notification.type === 'TASK_ASSIGNED') {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['role-dashboard'] }),
          queryClient.invalidateQueries({ queryKey: ['my-work'] }),
          queryClient.invalidateQueries({ queryKey: ['kpiEmployees'] }),
          queryClient.invalidateQueries({ queryKey: ['kpiTrends'] }),
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

  // Fetch notifications on mount if needed
  useEffect(() => {
    let isMounted = true;
    const fetchNotifs = async () => {
      try {
        const res = await notificationService.getNotifications(10, 1);
        if (isMounted) {
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
        toast.error('Không thể cập nhật thông báo.');
        return;
      }
    }

    if (onNotificationClick) {
      onNotificationClick(notif);
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
        className="relative rounded-xl p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
        aria-label="Thông báo"
      >
        <Bell className="w-5 h-5" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 ${
              hasNewPulse ? 'animate-bounce ring-4 ring-rose-400/30' : ''
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Thông báo</h4>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {unreadCount} mới
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Đọc tất cả</span>
                </button>
              )}
            </div>

            {/* Notification Items List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Không có thông báo mới
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Các thông báo cập nhật công việc và KPI sẽ xuất hiện tại đây.
                  </p>
                </div>
              ) : (
                notifications.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${
                      !item.isRead
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                      {getNotificationIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs truncate ${
                            !item.isRead
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-semibold text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {item.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    {!item.isRead && (
                      <span
                        className="mt-2 h-2 w-2 rounded-full bg-indigo-600 shrink-0"
                        title="Chưa đọc"
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer View All */}
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 text-center">
              <span className="text-[11px] text-slate-400 font-medium">
                Cập nhật tự động theo thời gian thực (Socket.io)
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;

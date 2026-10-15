import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  X,
  PlusCircle,
  Edit3,
  CheckCircle2,
  Trash2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import Avatar from './ui/Avatar';
import { getSocket } from '../socket';
import { apiClient } from '../api/apiClient';

export type ActivityActionType = 'created' | 'updated' | 'completed' | 'deleted' | 'commented';

export interface ActivityUser {
  id: string;
  fullName: string;
  avatarUrl?: string;
}

export interface ActivityItem {
  id: string;
  user: ActivityUser;
  action: ActivityActionType;
  entityType: 'task' | 'project' | 'subtask' | 'kpi' | 'comment';
  entityTitle: string;
  details?: string;
  createdAt: string;
}

export interface RealtimeActivityFeedProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

const actionStyles: Record<
  ActivityActionType,
  { label: string; icon: React.ReactNode; color: string; badge: string }
> = {
  created: {
    label: 'đã tạo mới',
    icon: <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
    color: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  updated: {
    label: 'đã cập nhật',
    icon: <Edit3 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />,
    color: 'border-l-sky-500',
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  },
  completed: {
    label: 'đã hoàn thành',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />,
    color: 'border-l-amber-500',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  deleted: {
    label: 'đã xóa',
    icon: <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
    color: 'border-l-rose-500',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  },
  commented: {
    label: 'đã bình luận vào',
    icon: <MessageSquare className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
    color: 'border-l-purple-500',
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  },
};

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

export const RealtimeActivityFeed: React.FC<RealtimeActivityFeedProps> = ({
  isOpen: controlledIsOpen,
  onClose,
  className = '',
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  useEffect(() => {
    if (!isVisible) return;
    let active = true;
    setIsLoading(true);
    apiClient.get<ActivityItem[]>('/activity')
      .then((response) => {
        if (active) setActivities(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        console.error('Không thể tải lịch sử hoạt động:', error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isVisible]);

  // Listen for socket events
  useEffect(() => {
    const socket = getSocket();

    const handleNewActivity = (activity: ActivityItem) => {
      setActivities((prev) => {
        // Keep maximum 50 items
        const updated = [activity, ...prev];
        return updated.slice(0, 50);
      });
    };

    socket.on('activity:new', handleNewActivity);

    return () => {
      socket.off('activity:new', handleNewActivity);
    };
  }, []);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button (if not externally controlled) */}
      {controlledIsOpen === undefined && (
        <button
          onClick={() => setInternalIsOpen(true)}
          className={`fixed right-5 bottom-6 z-40 flex items-center gap-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 shadow-lg shadow-slate-900/20 hover:scale-105 transition-all focus:outline-none ${className}`}
          title="Xem hoạt động realtime"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <Activity className="w-4 h-4" />
          <span className="text-xs font-semibold">Hoạt động</span>
        </button>
      )}

      {/* Slide-over Panel */}
      <AnimatePresence>
        {isVisible && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            />

            <div className="fixed inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-screen max-w-md pointer-events-auto bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Hoạt động gần đây
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Đồng bộ Realtime Socket.io
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleClose}
                    className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body / Activities List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoading ? (
                    <div className="space-y-4 p-2">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <div key={idx} className="flex gap-3 animate-pulse">
                          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                      <Sparkles className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="text-xs font-semibold">Chưa có hoạt động nào được ghi nhận</p>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {activities.map((item) => {
                        const style = actionStyles[item.action] || actionStyles.updated;
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25 }}
                            className={`relative rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850/60 p-3.5 shadow-xs border-l-4 ${style.color}`}
                          >
                            <div className="flex items-start gap-3">
                              <Avatar
                                src={item.user.avatarUrl}
                                name={item.user.fullName}
                                size="sm"
                              />

                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-800 dark:text-slate-200 leading-snug">
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {item.user.fullName}
                                  </span>{' '}
                                  <span className="text-slate-600 dark:text-slate-400">
                                    {style.label}
                                  </span>{' '}
                                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 break-words">
                                    "{item.entityTitle}"
                                  </span>
                                </div>

                                {item.details && (
                                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                    {item.details}
                                  </p>
                                )}

                                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                                  <span className="flex items-center gap-1 font-medium">
                                    {style.icon}
                                    <span className="capitalize">{item.entityType}</span>
                                  </span>
                                  <span>{formatRelativeTime(item.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>

                {/* Footer Count */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 text-center text-[11px] text-slate-400">
                  Hiển thị tối đa 50 sự kiện gần nhất
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default RealtimeActivityFeed;

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
  FolderKanban,
  Star,
  ExternalLink,
  Trash2,
  Calendar,
  Layers,
} from 'lucide-react';
import CountdownBadge from '@/components/ui/CountdownBadge';
import { formatDateTime } from '@/utils/deadline';

export interface TaskQuickViewItem {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  deadline?: string;
  status: string;
  priority: string;
  projectId?: string;
  projectName?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  isPersonal?: boolean;
  isDueSoon?: boolean;
  isOverdue?: boolean;
}

interface TaskQuickViewModalProps {
  task: TaskQuickViewItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleStatus: (taskId: string, currentStatus: string, title?: string) => void | Promise<void>;
  onOpenFullDetails: (taskId: string) => void;
  onDeleteTask?: (taskId: string, title: string, e: React.MouseEvent) => void;
}

export const TaskQuickViewModal: React.FC<TaskQuickViewModalProps> = ({
  task,
  isOpen,
  onClose,
  onToggleStatus,
  onOpenFullDetails,
  onDeleteTask,
}) => {
  if (!isOpen || !task) return null;

  const isDone = task.status === 'DONE';
  const taskDue = task.deadline || task.dueDate;
  const isOverdue = task.isOverdue || (!isDone && new Date(taskDue) < new Date());

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return { label: 'Khẩn Cấp', bg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300' };
      case 'HIGH':
        return { label: 'Ưu Tiên Cao', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300' };
      case 'LOW':
        return { label: 'Ưu Tiên Thấp', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
      default:
        return { label: 'Trung Bình', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300' };
    }
  };

  const priorityInfo = getPriorityBadge(task.priority);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col"
        >
          {/* Header Banner */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20">
            <div className="flex items-center gap-2 flex-wrap">
              {task.isPersonal ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                  <Star className="w-3.5 h-3.5 fill-indigo-500 text-indigo-500" />
                  ⭐ Lịch cá nhân
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300">
                  <FolderKanban className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  {task.projectName || 'Dự án'}
                </span>
              )}
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${priorityInfo.bg}`}>
                {priorityInfo.label}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              title="Đóng xem nhanh"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {/* Title Section */}
            <div>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggleStatus(task.id, task.status, task.title)}
                  className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer ${
                    isDone
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400'
                      : 'border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 dark:border-slate-600 dark:hover:border-emerald-400'
                  }`}
                  title={isDone ? 'Bấm để chuyển về Chưa xong' : 'Bấm để Đánh dấu đã xong'}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950/50" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <h3
                    className={`text-lg font-black leading-snug break-words ${
                      isDone
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Toggle Status Switch Banner */}
            <div
              onClick={() => onToggleStatus(task.id, task.status, task.title)}
              className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer active:scale-98 select-none ${
                isDone
                  ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/60 hover:bg-emerald-100/60'
                  : 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700/60 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    isDone
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {isDone ? 'Trạng thái: Đã hoàn thành' : 'Trạng thái: Đang thực hiện / Chưa xong'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isDone
                      ? 'Nhấp vào đây để hủy hoàn thành (chuyển về Đang làm)'
                      : 'Nhấp vào đây để đánh dấu hoàn thành công việc'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch Pill */}
              <div
                className={`w-12 h-6 rounded-full p-0.5 transition-colors relative flex items-center ${
                  isDone ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-md" />
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              {/* Deadline */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  Hạn chót công việc
                </span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {formatDateTime(taskDue)}
                </span>
                <div className="pt-0.5">
                  <CountdownBadge dueDate={taskDue} isCompleted={isDone} />
                </div>
              </div>

              {/* Assignee */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  Người phụ trách
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.assigneeAvatar ? (
                    <img
                      src={task.assigneeAvatar}
                      alt={task.assigneeName || 'User'}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                      {(task.assigneeName || 'Tôi').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {task.assigneeName || 'Lịch cá nhân của tôi'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            {onDeleteTask ? (
              <button
                type="button"
                onClick={(e) => {
                  onDeleteTask(task.id, task.title, e);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenFullDetails(task.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer"
              >
                <span>Xem Chi Tiết Đầy Đủ</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TaskQuickViewModal;

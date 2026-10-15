import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckSquare, MessageSquare, Paperclip, AlertCircle } from 'lucide-react';
import { Task, TaskPriority, TaskStatus } from '../../services/taskService';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';

export interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onClick?: (task: Task) => void;
  className?: string;
}

const priorityConfig: Record<
  TaskPriority,
  { label: string; variant: 'danger' | 'warning' | 'info' | 'default' }
> = {
  URGENT: { label: 'Khẩn cấp', variant: 'danger' },
  HIGH: { label: 'Cao', variant: 'warning' },
  MEDIUM: { label: 'Trung bình', variant: 'default' },
  LOW: { label: 'Thấp', variant: 'info' },
};

const statusColors: Record<TaskStatus, string> = {
  TODO: 'bg-slate-400',
  IN_PROGRESS: 'bg-blue-500',
  REVIEW: 'bg-amber-500',
  DONE: 'bg-emerald-500',
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isDragging = false,
  onClick,
  className = '',
}) => {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  // Sub-tasks stats
  const subTasks = task.subTasks || [];
  const completedSubTasks = subTasks.filter((st) => st.isCompleted).length;
  const totalSubTasks = subTasks.length;
  const subTasksProgress = totalSubTasks > 0 ? (completedSubTasks / totalSubTasks) * 100 : 0;

  const commentsCount = task.comments?.length || 0;
  const attachmentsCount = task.attachments?.length || 0;

  const formatDueDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      onClick={() => onClick && onClick(task)}
      className={`group relative select-none rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all hover:border-indigo-400/80 hover:shadow-md cursor-pointer ${
        isDragging
          ? 'opacity-60 scale-105 shadow-2xl rotate-1 ring-2 ring-indigo-500'
          : 'opacity-100'
      } ${className}`}
    >
      {/* Status indicator line on left */}
      <span
        className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
          statusColors[task.status] || 'bg-slate-300'
        }`}
        aria-hidden="true"
      />

      <div className="pl-1.5 space-y-3">
        {/* Top Header: Priority Badge + Key/Project */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={priorityConfig[task.priority]?.variant || 'default'}
            size="sm"
            withDot
          >
            {priorityConfig[task.priority]?.label || task.priority}
          </Badge>

          {task.project && (
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate max-w-[120px]">
              {task.project.name}
            </span>
          )}
        </div>

        {/* Task Title */}
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
          {task.title}
        </h4>

        {/* Description snippet if present */}
        {task.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Sub-tasks Progress */}
        {totalSubTasks > 0 && (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <CheckSquare className="w-3 h-3 text-slate-400" />
                <span>
                  {completedSubTasks}/{totalSubTasks} subtasks
                </span>
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {Math.round(subTasksProgress)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  subTasksProgress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${subTasksProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer Info: Assignee + Due Date + Counters */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          {/* Assignee Avatar */}
          <div className="flex items-center gap-2">
            {task.assignee ? (
              <Avatar
                src={task.assignee.avatar}
                name={task.assignee.name}
                size="sm"
              />
            ) : (
              <span className="text-[11px] text-slate-400 italic">Chưa giao</span>
            )}
          </div>

          {/* Right meta icons */}
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            {/* Due date */}
            {task.dueDate && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                  isOverdue
                    ? 'text-rose-600 dark:text-rose-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
                title={isOverdue ? 'Quá hạn!' : `Hạn chót: ${task.dueDate}`}
              >
                {isOverdue ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <Calendar className="w-3.5 h-3.5" />
                )}
                {formatDueDate(task.dueDate)}
              </span>
            )}

            {/* Attachments */}
            {attachmentsCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px]" title={`${attachmentsCount} đính kèm`}>
                <Paperclip className="w-3.5 h-3.5" />
                <span>{attachmentsCount}</span>
              </span>
            )}

            {/* Comments */}
            {commentsCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px]" title={`${commentsCount} bình luận`}>
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{commentsCount}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TaskCard;

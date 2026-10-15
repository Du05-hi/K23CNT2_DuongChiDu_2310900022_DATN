import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  X,
  Edit2,
  Check,
  Calendar,
  Clock,
  User,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  Send,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Download,
  AlertCircle,
  Save,
  Loader2,
} from 'lucide-react';
import {
  Task,
  TaskStatus,
  TaskPriority,
  SubTask,
  Comment,
  TaskAttachment,
  UserSummary,
} from '../../services/taskService';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import { getSocket } from '../../socket';
import taskService from '../../services/taskService';

export interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedTask: Task) => Promise<void> | void;
  usersList?: UserSummary[];
}

type TabKey = 'details' | 'subtasks' | 'comments' | 'attachments';

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
  usersList = [],
}) => {
  const [currentTab, setCurrentTab] = useState<TabKey>('details');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [estimatedHours, setEstimatedHours] = useState<number>(0);
  const [actualHours, setActualHours] = useState<number>(0);

  // Sub-tasks state
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'TODO');
      setPriority(task.priority || 'MEDIUM');
      setAssigneeId(task.assigneeId || '');
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setEstimatedHours(task.estimatedHours || 0);
      setActualHours(task.actualHours || 0);
      setSubTasks(task.subTasks ? [...task.subTasks] : []);
      setComments(task.comments ? [...task.comments] : []);
      setAttachments(task.attachments ? [...task.attachments] : []);
      setIsEditingTitle(false);
    }
  }, [task]);

  // Socket.io for realtime comments
  useEffect(() => {
    if (!task || !isOpen) return;

    const socket = getSocket();
    const handleNewComment = (event: { taskId: string; comment: Comment }) => {
      if (event.taskId === task.id) {
        setComments((prev) => {
          // Avoid duplicate comments
          if (prev.some((comment) => comment.id === event.comment.id)) return prev;
          return [...prev, event.comment];
        });
      }
    };

    socket.on('task:comment_added', handleNewComment);

    return () => {
      socket.off('task:comment_added', handleNewComment);
    };
  }, [task, isOpen]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!task) return null;

  // Handlers for Sub-tasks
  const handleToggleSubTask = (id: string) => {
    setSubTasks((prev) =>
      prev.map((st) => (st.id === id ? { ...st, isCompleted: !st.isCompleted } : st))
    );
  };

  const handleAddSubTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubTaskTitle.trim()) return;

    const newSubTask: SubTask = {
      id: `subtask-${Date.now()}`,
      taskId: task.id,
      title: newSubTaskTitle.trim(),
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    setSubTasks((prev) => [...prev, newSubTask]);
    setNewSubTaskTitle('');
  };

  const handleDeleteSubTask = (id: string) => {
    setSubTasks((prev) => prev.filter((st) => st.id !== id));
  };

  // Handlers for Comments
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newCommentText.trim();
    if (!content || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const comment = await taskService.addComment(task.id, content);
      setComments((prev) =>
        prev.some((existingComment) => existingComment.id === comment.id)
          ? prev
          : [...prev, comment]
      );
      setNewCommentText('');
    } catch {
      toast.error('Không thể gửi bình luận.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handlers for Attachments
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newUploadedFiles: TaskAttachment[] = Array.from(files).map((file, idx) => ({
      id: `att-${Date.now()}-${idx}`,
      taskId: task.id,
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      createdAt: new Date().toISOString(),
    }));

    setAttachments((prev) => [...prev, ...newUploadedFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const selectedAssignee = usersList.find((u) => u.id === assigneeId) || task.assignee;
      const updatedTask: Task = {
        ...task,
        title,
        description,
        status,
        priority,
        assigneeId: assigneeId || undefined,
        assignee: selectedAssignee,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        estimatedHours: Number(estimatedHours),
        actualHours: Number(actualHours),
        subTasks,
        comments,
        attachments,
        updatedAt: new Date().toISOString(),
      };

      if (onSave) {
        await onSave(updatedTask);
      }
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate progress for subtasks
  const completedSubTasksCount = subTasks.filter((st) => st.isCompleted).length;
  const subTasksProgress =
    subTasks.length > 0 ? Math.round((completedSubTasksCount / subTasks.length) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
            className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <div className="flex-1 mr-4 space-y-3">
                {/* Title editable inline */}
                <div className="flex items-center gap-2">
                  {isEditingTitle ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="flex-1 rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 px-3 py-1.5 text-base sm:text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      <button
                        onClick={() => setIsEditingTitle(false)}
                        className="rounded-lg p-2 bg-indigo-600 text-white hover:bg-indigo-700 transition"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">
                        {title}
                      </h2>
                      <Edit2 className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" />
                    </div>
                  )}
                </div>

                {/* Status & Priority selects */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Status Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Trạng thái:</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="TODO">Cần làm (TODO)</option>
                      <option value="IN_PROGRESS">Đang thực hiện</option>
                      <option value="REVIEW">Đang review</option>
                      <option value="DONE">Đã hoàn thành</option>
                    </select>
                  </div>

                  {/* Priority Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Độ ưu tiên:</span>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="LOW">Thấp (LOW)</option>
                      <option value="MEDIUM">Trung bình (MEDIUM)</option>
                      <option value="HIGH">Cao (HIGH)</option>
                      <option value="URGENT">Khẩn cấp</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Đóng dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <button
                onClick={() => setCurrentTab('details')}
                className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  currentTab === 'details'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Chi tiết</span>
              </button>

              <button
                onClick={() => setCurrentTab('subtasks')}
                className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  currentTab === 'subtasks'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Sub-tasks</span>
                {subTasks.length > 0 && (
                  <span className="ml-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold">
                    {completedSubTasksCount}/{subTasks.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setCurrentTab('comments')}
                className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  currentTab === 'comments'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Bình luận</span>
                {comments.length > 0 && (
                  <span className="ml-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold">
                    {comments.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setCurrentTab('attachments')}
                className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  currentTab === 'attachments'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <Paperclip className="w-4 h-4" />
                <span>Đính kèm</span>
                {attachments.length > 0 && (
                  <span className="ml-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold">
                    {attachments.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: DETAILS */}
              {currentTab === 'details' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Description & Project */}
                  <div className="md:col-span-2 space-y-5">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Mô tả công việc
                      </label>
                      <textarea
                        rows={6}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Thêm mô tả chi tiết công việc, mục tiêu, yêu cầu nghiệm thu..."
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition"
                      />
                    </div>

                    {task.project && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-4 flex items-center gap-3">
                        <FolderKanban className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Dự án</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {task.project.name}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Meta Info Form */}
                  <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 p-4">
                    {/* Assignee */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                        Người phụ trách
                      </label>
                      <select
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="">-- Chưa chỉ định --</option>
                        {usersList.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Due Date */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                        Hạn chót (Due date)
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Estimated Hours */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                        Ước tính (Giờ)
                      </label>
                      <div className="relative flex items-center">
                        <Clock className="w-4 h-4 absolute left-3 text-slate-400" />
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={estimatedHours}
                          onChange={(e) => setEstimatedHours(Number(e.target.value))}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Actual Hours */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                        Thực tế (Giờ)
                      </label>
                      <div className="relative flex items-center">
                        <Clock className="w-4 h-4 absolute left-3 text-slate-400" />
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={actualHours}
                          onChange={(e) => setActualHours(Number(e.target.value))}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SUBTASKS */}
              {currentTab === 'subtasks' && (
                <div className="space-y-5">
                  {/* Progress Header */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-4">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <span>Tiến độ hoàn thành</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {completedSubTasksCount} / {subTasks.length} ({subTasksProgress}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${subTasksProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Add subtask input */}
                  <form onSubmit={handleAddSubTask} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Thêm subtask mới và nhấn Enter..."
                      value={newSubTaskTitle}
                      onChange={(e) => setNewSubTaskTitle(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!newSubTaskTitle.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm</span>
                    </button>
                  </form>

                  {/* Subtask list */}
                  <div className="space-y-2">
                    {subTasks.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400">
                        Chưa có subtask nào. Thêm mục con để chia nhỏ công việc!
                      </p>
                    ) : (
                      subTasks.map((st) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition group"
                        >
                          <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={st.isCompleted}
                              onChange={() => handleToggleSubTask(st.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                            />
                            <span
                              className={`text-sm ${
                                st.isCompleted
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {st.title}
                            </span>
                          </label>

                          <button
                            onClick={() => handleDeleteSubTask(st.id)}
                            className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition p-1"
                            title="Xóa subtask"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: COMMENTS */}
              {currentTab === 'comments' && (
                <div className="space-y-5">
                  {/* Comments Timeline */}
                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                    {comments.length === 0 ? (
                      <p className="text-center py-8 text-xs text-slate-400">
                        Chưa có bình luận nào. Hãy bắt đầu trao đổi về task này!
                      </p>
                    ) : (
                      comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50"
                        >
                          <Avatar
                            src={comment.author?.avatar}
                            name={comment.author?.name || 'Người dùng'}
                            size="sm"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {comment.author?.name || 'Người dùng'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(comment.createdAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment Form */}
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Viết bình luận hoặc phản hồi..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentText.trim() || isSubmittingComment}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition"
                    >
                      <Send className="w-4 h-4" />
                      <span>Gửi</span>
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 4: ATTACHMENTS */}
              {currentTab === 'attachments' && (
                <div className="space-y-5">
                  {/* Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer bg-slate-50/50 dark:bg-slate-850/50 transition"
                  >
                    <UploadCloud className="w-8 h-8 text-indigo-500 mb-2" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Kéo thả hoặc bấm để tải lên tài liệu đính kèm
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Hỗ trợ hình ảnh, PDF, Word, Excel (Tối đa 25MB)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>

                  {/* Attachments List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {attachments.map((att) => {
                      const isImage = att.fileType.startsWith('image/');
                      return (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:shadow-sm transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isImage ? (
                              <img
                                src={att.fileUrl}
                                alt={att.fileName}
                                className="w-10 h-10 rounded-lg object-cover border"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {att.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {(att.fileSize / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <a
                              href={att.fileUrl}
                              download={att.fileName}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 transition"
                              title="Tải về"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 transition"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer / Save Changes */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <span className="text-xs text-slate-400">
                Tạo ngày {new Date(task.createdAt).toLocaleDateString('vi-VN')}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TaskDetailModal;

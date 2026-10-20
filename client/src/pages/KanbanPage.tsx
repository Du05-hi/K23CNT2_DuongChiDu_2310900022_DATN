import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Calendar,
  Tag,
  CheckCircle2,
  Clock,
  Paperclip,
  Sparkles,
  Users,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import taskService, { type Task } from '@/services/taskService';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import TaskDetailsModal from '@/components/TaskDetailsModal';
import { apiClient } from '@/api/apiClient';
import type { User } from '@/types';

interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId?: string | null;
  assignee: string;
  dueDate: string;
  dueDateValue?: string;
  attachmentsCount: number;
}

const COLUMNS: Array<{ id: KanbanTask['status']; label: string; color: string }> = [
  { id: 'TODO', label: 'Cần làm (To Do)', color: 'border-slate-400' },
  { id: 'IN_PROGRESS', label: 'Đang thực hiện (In Progress)', color: 'border-indigo-500' },
  { id: 'REVIEW', label: 'Chờ kiểm thử (Review)', color: 'border-amber-500' },
  { id: 'DONE', label: 'Hoàn thành (Done)', color: 'border-emerald-500' },
];

const toKanbanTask = (task: Task, previous?: KanbanTask): KanbanTask => ({
  id: task.id,
  title: task.title,
  description: task.description || '',
  status: task.status,
  priority: task.priority,
  assigneeId: task.assigneeId,
  assignee: task.assignee?.name || 'Chưa giao',
  dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Chưa đặt hạn',
  dueDateValue: task.dueDate,
  attachmentsCount: task._count?.attachments ?? task.attachments?.length ?? previous?.attachmentsCount ?? 0,
});

export const KanbanPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { joinProject, leaveProject, socket } = useSocket();
  const { user } = useAuth();
  const canManageTasks = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [searchText, setSearchText] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('MEDIUM');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [users, setUsers] = useState<Pick<User, 'id' | 'name' | 'email'>[]>([]);
  const [activeColumn, setActiveColumn] = useState<KanbanTask['status'] | null>(null);

  useEffect(() => {
    if (!canManageTasks) {
      setUsers([]);
      return;
    }

    let active = true;
    apiClient.get<User[]>('/users', { params: { limit: 1000, isActive: true } })
      .then(({ data }) => {
        if (active) {
          setUsers(
            (Array.isArray(data) ? data : []).map(({ id, name, email }) => ({ id, name, email }))
          );
        }
      })
      .catch((error: unknown) => {
        console.error('Không thể tải danh sách người thực hiện:', error);
        if (active) toast.error('Không thể tải danh sách người thực hiện.');
      });

    return () => {
      active = false;
    };
  }, [canManageTasks]);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      return;
    }

    let active = true;
    taskService
      .getTasksByProject(projectId)
      .then((projectTasks) => {
        if (active) setTasks(projectTasks.map((task) => toKanbanTask(task)));
      })
      .catch((error: unknown) => {
        if (active) {
          console.error('Không thể tải công việc của dự án:', error);
          toast.error('Không thể tải danh sách công việc.');
        }
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  // Tham gia phòng Socket dự án để nhận realtime updates
  useEffect(() => {
    if (projectId) {
      joinProject(projectId);
    }

    if (socket) {
      const handleTaskUpdated = (event: { projectId: string; task: Task }) => {
        if (event.projectId !== projectId) return;
        setTasks((prev) =>
          prev.map((task) => task.id === event.task.id ? toKanbanTask(event.task, task) : task)
        );
      };

      const handleAttachmentUpdated = (event: {
        projectId: string;
        taskId: string;
        attachmentCount: number;
      }) => {
        if (event.projectId !== projectId) return;
        setTasks((prev) =>
          prev.map((task) => task.id === event.taskId
            ? { ...task, attachmentsCount: event.attachmentCount }
            : task)
        );
      };

      const handleTaskCreated = (task: Task) => {
        setTasks((prev) =>
          prev.some((existing) => existing.id === task.id)
            ? prev
            : [...prev, toKanbanTask(task)]
        );
      };

      const handleTaskDeleted = (event: { taskId: string }) => {
        setTasks((prev) => prev.filter((task) => task.id !== event.taskId));
      };

      socket.on('task_updated', handleTaskUpdated);
      socket.on('attachment_updated', handleAttachmentUpdated);
      socket.on('task:created', handleTaskCreated);
      socket.on('task:deleted', handleTaskDeleted);
      return () => {
        socket.off('task_updated', handleTaskUpdated);
        socket.off('attachment_updated', handleAttachmentUpdated);
        socket.off('task:created', handleTaskCreated);
        socket.off('task:deleted', handleTaskDeleted);
        if (projectId) {
          leaveProject(projectId);
        }
      };
    }
  }, [projectId, joinProject, leaveProject, socket]);

  const moveTask = async (taskId: string, targetStatus: KanbanTask['status']) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status === targetStatus) return;

    try {
      const updatedTask = await taskService.updateTaskStatus(taskId, { status: targetStatus });
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? toKanbanTask(updatedTask) : task))
      );
      if (projectId && socket?.connected) {
        socket.emit('task_moved', {
          projectId,
          taskId,
          status: updatedTask.status,
          position: updatedTask.position,
        });
      }

      if (targetStatus === 'DONE') {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        toast.success('🎉 Chúc mừng bạn đã hoàn thành nhiệm vụ!');
      }
    } catch (error) {
      console.error('Không thể cập nhật trạng thái công việc:', error);
      toast.error('Không thể cập nhật trạng thái công việc.');
    }
  };

  const handleCreateTask = async (status: KanbanTask['status']) => {
    if (!newTaskTitle.trim() || !projectId) return;

    try {
      const task = await taskService.createTask({
        title: newTaskTitle.trim(),
        projectId,
        status,
        description: newTaskDescription.trim() || undefined,
        priority: newTaskPriority,
        dueDate: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : undefined,
        assigneeId: newTaskAssigneeId || undefined,
      });
      setTasks((prev) =>
        prev.some((existing) => existing.id === task.id)
          ? prev
          : [...prev, toKanbanTask(task)]
      );
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('MEDIUM');
      setNewTaskDueDate('');
      setNewTaskAssigneeId('');
      setActiveColumn(null);
      toast.success('Đã thêm thẻ nhiệm vụ mới');
    } catch (error) {
      console.error('Không thể tạo công việc:', error);
      toast.error('Không thể tạo công việc.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Bảng Kanban Dự Án</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold">
                ID: {projectId || 'chưa chọn'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi tiến độ, trao đổi và cập nhật công việc theo thời gian thực
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-full font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Đồng bộ thời gian thực
          </span>
        </div>
      </div>

      {/* CÁC CỘT KANBAN */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Tìm theo tên, mô tả hoặc người được giao..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="sr-only">Lọc theo mức ưu tiên</span>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="ALL">Tất cả mức ưu tiên</option>
            <option value="URGENT">Khẩn cấp</option>
            <option value="HIGH">Cao</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="LOW">Thấp</option>
          </select>
        </label>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const query = searchText.trim().toLocaleLowerCase('vi');
          const colTasks = tasks.filter((task) => {
            const matchesStatus = task.status === col.id;
            const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter;
            const matchesSearch = !query || [task.title, task.description, task.assignee]
              .some((value) => value.toLocaleLowerCase('vi').includes(query));
            return matchesStatus && matchesPriority && matchesSearch;
          });
          return (
            <div
              key={col.id}
              className="flex flex-col rounded-3xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-4 h-full"
            >
              {/* Tiêu đề Cột */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full border-2 ${col.color}`} />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {col.label}
                  </h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {colTasks.length}
                </span>
              </div>

              {/* Danh sách nhiệm vụ trong cột */}
              <div className="flex-1 space-y-3 mt-3 overflow-y-auto pr-1">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          task.priority === 'URGENT' || task.priority === 'HIGH'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            : task.priority === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {task.priority === 'URGENT'
                          ? 'KHẨN CẤP'
                          : task.priority === 'HIGH'
                          ? 'ƯU TIÊN CAO'
                          : task.priority === 'MEDIUM'
                          ? 'TRUNG BÌNH'
                          : 'THẤP'}
                      </span>

                      {/* Dropdown nhanh chuyển trạng thái */}
                      <select
                        value={task.status}
                        disabled={!canManageTasks && task.assigneeId !== user?.id}
                        onChange={(e) =>
                          moveTask(task.id, e.target.value as KanbanTask['status'])
                        }
                        className="text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="REVIEW">Review</option>
                        <option value="DONE">Done</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setSelectedTaskId(task.id)}
                      className="block w-full text-left text-xs font-bold leading-snug text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                    >
                      {task.title}
                    </button>

                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {task.description}
                    </p>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {task.assignee}
                      </span>
                      {task.attachmentsCount > 0 && (
                        <span className="flex items-center gap-1" title={`${task.attachmentsCount} tệp đính kèm`}>
                          <Paperclip className="h-3 w-3" /> {task.attachmentsCount}
                        </span>
                      )}
                      <span className={`flex items-center gap-1 ${
                        task.dueDateValue && new Date(task.dueDateValue) < new Date() && task.status !== 'DONE'
                          ? 'font-semibold text-rose-600 dark:text-rose-400'
                          : ''
                      }`}>
                        <Clock className="h-3 w-3" />
                        {task.dueDateValue && new Date(task.dueDateValue) < new Date() && task.status !== 'DONE'
                          ? `Quá hạn: ${task.dueDate}`
                          : task.dueDate}
                      </span>
                    </div>
                    {selectedTaskId && (
                      <TaskDetailsModal
                        taskId={selectedTaskId}
                        canEditSubtasks={canManageTasks || tasks.find((task) => task.id === selectedTaskId)?.assigneeId === user?.id}
                        canAssignTask={canManageTasks}
                        usersList={users}
                        onTaskUpdated={(updatedTask) => {
                          setTasks((current) =>
                            current.map((task) =>
                              task.id === updatedTask.id ? toKanbanTask(updatedTask) : task
                            )
                          );
                        }}
                        onClose={() => setSelectedTaskId(null)}
                      />
                    )}
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400 dark:border-slate-700">
                    {tasks.some((task) => task.status === col.id)
                      ? 'Không có công việc khớp bộ lọc.'
                      : 'Chưa có công việc trong cột này.'}
                  </p>
                )}
              </div>

              {/* Nút thêm nhanh task vào cột */}
              {canManageTasks && <div className="pt-3">
                {activeColumn === col.id ? (
                  <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-sm">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Nhập tên nhiệm vụ..."
                      maxLength={200}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateTask(col.id);
                      }}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <textarea
                      value={newTaskDescription}
                      onChange={(e) => setNewTaskDescription(e.target.value)}
                      placeholder="Mô tả (không bắt buộc)"
                      maxLength={2000}
                      rows={2}
                      className="w-full resize-y rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
                        aria-label="Mức độ ưu tiên"
                        className="min-w-0 rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-700"
                      >
                        <option value="LOW">Ưu tiên thấp</option>
                        <option value="MEDIUM">Ưu tiên trung bình</option>
                        <option value="HIGH">Ưu tiên cao</option>
                        <option value="URGENT">Khẩn cấp</option>
                      </select>
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        aria-label="Hạn hoàn thành"
                        className="min-w-0 rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-700"
                      />
                    </div>
                    <select
                      value={newTaskAssigneeId}
                      onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                      aria-label="Người thực hiện"
                      className="w-full rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-700"
                    >
                      <option value="">Chưa giao người thực hiện</option>
                      {users.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.name} ({assignee.email})
                        </option>
                      ))}
                    </select>
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setActiveColumn(null)}
                        className="px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded-lg"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => handleCreateTask(col.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Thêm
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setActiveColumn(col.id);
                      setNewTaskTitle('');
                      setNewTaskDescription('');
                      setNewTaskPriority('MEDIUM');
                      setNewTaskDueDate('');
                    }}
                    className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-white/60 dark:hover:bg-slate-800/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm việc
                  </button>
                )}
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanPage;

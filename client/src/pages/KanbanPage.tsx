import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  Paperclip,
  Users,
  Search,
  SlidersHorizontal,
  Flame,
  UserCheck,
  RotateCcw,
  FileSpreadsheet,
  Printer,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ExternalLink,
  Mic,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import taskService, { type Task } from '@/services/taskService';
import projectService from '@/services/projectService';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import TaskDetailsModal from '@/components/TaskDetailsModal';
import CountdownBadge from '@/components/ui/CountdownBadge';
import { formatDateTime, fromDatetimeLocalToIso } from '@/utils/deadline';
import { apiClient } from '@/api/apiClient';
import type { User } from '@/types';
import VoiceCommandModal, { type ParsedVoiceCommand } from '@/components/voice/VoiceCommandModal';
import WorkloadHeatmapModal from '@/components/workload/WorkloadHeatmapModal';

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

const COLUMNS: Array<{ id: KanbanTask['status']; label: string; color: string; badgeColor: string }> = [
  { id: 'TODO', label: 'Cần làm (To Do)', color: 'border-slate-400', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { id: 'IN_PROGRESS', label: 'Đang thực hiện (In Progress)', color: 'border-indigo-500', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  { id: 'REVIEW', label: 'Chờ kiểm thử (Review)', color: 'border-amber-500', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'DONE', label: 'Hoàn thành (Done)', color: 'border-emerald-500', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
];

const toKanbanTask = (task: Task, previous?: KanbanTask): KanbanTask => ({
  id: task.id,
  title: task.title,
  description: task.description || '',
  status: task.status,
  priority: task.priority,
  assigneeId: task.assigneeId,
  assignee: task.assignee?.name || 'Chưa giao',
  dueDate: task.dueDate ? formatDateTime(task.dueDate) : 'Chưa đặt hạn',
  dueDateValue: task.dueDate,
  attachmentsCount: task._count?.attachments ?? task.attachments?.length ?? previous?.attachmentsCount ?? 0,
});

export const KanbanPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightTaskId = searchParams.get('highlightTaskId');

  const navigate = useNavigate();
  const { joinProject, leaveProject, socket } = useSocket();
  const { user } = useAuth();
  const canManageTasks = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Task & Project Data State
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [projectDetails, setProjectDetails] = useState<any>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightTaskId);

  // Filters State
  const [searchText, setSearchText] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [urgentOrOverdue, setUrgentOrOverdue] = useState(false);

  // Modal & Edit State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('MEDIUM');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [users, setUsers] = useState<Pick<User, 'id' | 'name' | 'email'>[]>([]);
  const [activeColumn, setActiveColumn] = useState<KanbanTask['status'] | null>(null);

  // 1. Fetch Users for Assignment
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
      });

    return () => {
      active = false;
    };
  }, [canManageTasks]);

  // 2. Fetch Project Details
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    projectService.getProjectById(projectId)
      .then((data) => {
        if (active) setProjectDetails(data);
      })
      .catch((err) => {
        console.warn('Không thể tải chi tiết dự án:', err);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  // 3. Fetch Tasks
  const loadProjectTasks = () => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    taskService
      .getTasksByProject(projectId)
      .then((projectTasks) => {
        setTasks(projectTasks.map((task) => toKanbanTask(task)));
      })
      .catch((error: unknown) => {
        console.error('Không thể tải công việc của dự án:', error);
        toast.error('Không thể tải danh sách công việc.');
      });
  };

  useEffect(() => {
    loadProjectTasks();
  }, [projectId]);

  const handleVoiceCommand = async (cmd: ParsedVoiceCommand) => {
    if (cmd.actionType === 'CREATE_TASK' && projectId) {
      try {
        const created = await taskService.createTask({
          projectId,
          title: cmd.taskData?.title || cmd.rawText,
          priority: cmd.taskData?.priority || 'MEDIUM',
          dueDate: cmd.taskData?.dueDate,
          status: 'TODO',
        });
        setTasks((prev) => [...prev, toKanbanTask(created)]);
        toast.success(`🎙️ Đã tạo việc bằng giọng nói: "${created.title}"`);
      } catch (err: any) {
        toast.error('Lỗi khi tạo việc bằng giọng nói: ' + (err?.response?.data?.message || err.message));
      }
    } else if (cmd.actionType === 'SEARCH') {
      const clean = cmd.rawText.replace(/^(tìm|lọc)\s+/i, '').trim();
      setSearchText(clean);
      toast.info(`Đang lọc theo giọng nói: "${clean}"`);
    } else {
      setSearchText(cmd.rawText);
      toast.info(`Đã nhận diện: "${cmd.rawText}"`);
    }
  };

  // 4. Highlight Pulse & Auto-Scroll when redirected from Notification
  useEffect(() => {
    if (!highlightTaskId || tasks.length === 0) return;

    setHighlightedId(highlightTaskId);

    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`task-card-${highlightTaskId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350);

    // 3 seconds highlight pulse animation
    const clearTimer = setTimeout(() => {
      setHighlightedId(null);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('highlightTaskId');
      setSearchParams(nextParams, { replace: true });
    }, 3000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightTaskId, tasks.length, searchParams, setSearchParams]);

  // 5. Socket.io Realtime Sync
  useEffect(() => {
    if (projectId) {
      joinProject(projectId);
    }

    if (socket) {
      const handleTaskUpdated = (event: { projectId: string; task: Task }) => {
        if (event.projectId !== projectId) return;
        setTasks((prev) =>
          prev.map((task) => (task.id === event.task.id ? toKanbanTask(event.task, task) : task))
        );
      };

      const handleAttachmentUpdated = (event: {
        projectId: string;
        taskId: string;
        attachmentCount: number;
      }) => {
        if (event.projectId !== projectId) return;
        setTasks((prev) =>
          prev.map((task) =>
            task.id === event.taskId
              ? { ...task, attachmentsCount: event.attachmentCount }
              : task
          )
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

  // Move task status handler
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
      } else {
        const statusLabel = COLUMNS.find((c) => c.id === targetStatus)?.label || targetStatus;
        toast.success(`Đã cập nhật trạng thái: ${statusLabel}`);
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
        dueDate: newTaskDueDate ? fromDatetimeLocalToIso(newTaskDueDate) || undefined : undefined,
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

  // Helper counts for Quick Filters
  const myTasksCount = useMemo(() => {
    return tasks.filter((t) => t.assigneeId === user?.id).length;
  }, [tasks, user?.id]);

  const urgentOrOverdueCount = useMemo(() => {
    const now = new Date();
    return tasks.filter(
      (t) =>
        t.priority === 'URGENT' ||
        (t.dueDateValue && new Date(t.dueDateValue) < now && t.status !== 'DONE')
    ).length;
  }, [tasks]);

  const isAnyFilterActive = searchText.trim() !== '' || priorityFilter !== 'ALL' || onlyMyTasks || urgentOrOverdue;

  const handleResetFilters = () => {
    setSearchText('');
    setPriorityFilter('ALL');
    setOnlyMyTasks(false);
    setUrgentOrOverdue(false);
  };

  // Export Project Report as CSV (UTF-8 with BOM for Vietnamese Excel)
  const handleExportCSV = () => {
    if (!projectId) return;
    const nowStr = new Date().toLocaleString('vi-VN');
    const projectName = projectDetails?.name || `Dự án ${projectId}`;
    const totalCount = tasks.length;
    const doneCount = tasks.filter((t) => t.status === 'DONE').length;
    const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const reviewCount = tasks.filter((t) => t.status === 'REVIEW').length;
    const todoCount = tasks.filter((t) => t.status === 'TODO').length;
    const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const overdueTasks = tasks.filter(
      (t) => t.dueDateValue && new Date(t.dueDateValue) < new Date() && t.status !== 'DONE'
    );

    const membersList = projectDetails?.members || [];

    const escapeCsv = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'BÁO CÁO TIẾN ĐỘ VÀ TÌNH HÌNH DỰ ÁN\r\n';
    csv += `Tên dự án:,${escapeCsv(projectName)}\r\n`;
    csv += `Mã dự án:,${escapeCsv(projectId)}\r\n`;
    csv += `Thời gian xuất báo cáo:,${escapeCsv(nowStr)}\r\n`;
    csv += `Tổng số công việc:,${totalCount}\r\n`;
    csv += `Đã hoàn thành (Done):,${doneCount}\r\n`;
    csv += `Đang thực hiện (In Progress):,${inProgressCount}\r\n`;
    csv += `Chờ kiểm thử (Review):,${reviewCount}\r\n`;
    csv += `Cần làm (To Do):,${todoCount}\r\n`;
    csv += `Tỷ lệ hoàn thành:,${completionRate}%\r\n`;
    csv += `Số lượng việc quá hạn:,${overdueTasks.length}\r\n`;
    csv += '\r\n';

    // 1. Members
    csv += 'DANH SÁCH THÀNH VIÊN THAM GIA DỰ ÁN\r\n';
    csv += 'STT,Họ và tên,Email,Vai trò dự án\r\n';
    if (membersList.length > 0) {
      membersList.forEach((m: any, idx: number) => {
        const u = m.user || {};
        csv += `${idx + 1},${escapeCsv(u.name || 'N/A')},${escapeCsv(u.email || 'N/A')},${escapeCsv(m.role || 'MEMBER')}\r\n`;
      });
    } else {
      csv += '1,"Chưa có dữ liệu thành viên","",""\r\n';
    }
    csv += '\r\n';

    // 2. Overdue tasks
    csv += 'DANH SÁCH CÁC ĐẦU VIỆC TRỄ HẠN (QUÁ HẠN)\r\n';
    csv += 'STT,Tên công việc,Người thực hiện,Mức độ ưu tiên,Hạn chót,Trạng thái\r\n';
    if (overdueTasks.length > 0) {
      overdueTasks.forEach((t, idx) => {
        const statusLabel = COLUMNS.find((c) => c.id === t.status)?.label || t.status;
        csv += `${idx + 1},${escapeCsv(t.title)},${escapeCsv(t.assignee)},${escapeCsv(t.priority)},${escapeCsv(t.dueDate)},${escapeCsv(statusLabel)}\r\n`;
      });
    } else {
      csv += '1,"Không có công việc nào bị quá hạn!","","","",""\r\n';
    }
    csv += '\r\n';

    // 3. All tasks
    csv += 'TOÀN BỘ CÔNG VIỆC DỰ ÁN\r\n';
    csv += 'STT,Tên công việc,Người thực hiện,Mức độ ưu tiên,Hạn chót,Trạng thái\r\n';
    tasks.forEach((t, idx) => {
      const statusLabel = COLUMNS.find((c) => c.id === t.status)?.label || t.status;
      csv += `${idx + 1},${escapeCsv(t.title)},${escapeCsv(t.assignee)},${escapeCsv(t.priority)},${escapeCsv(t.dueDate)},${escapeCsv(statusLabel)}\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeProjectName = (projectName || 'du-an').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, '_');
    a.download = `Bao_cao_tien_do_${safeProjectName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Đã xuất báo cáo tiến độ dạng file CSV thành công!');
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Completion stats calculation
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === 'DONE').length;
  const progressPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  const overdueTasksList = tasks.filter(
    (t) => t.dueDateValue && new Date(t.dueDateValue) < new Date() && t.status !== 'DONE'
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-6rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer"
            title="Quay lại danh mục dự án"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {projectDetails?.name || 'Bảng Kanban Dự Án'}
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800">
                {progressPercent}% hoàn thành ({completedTasksCount}/{totalTasksCount})
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
              {projectDetails?.description || 'Theo dõi tiến độ, trao đổi và cập nhật công việc theo thời gian thực'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Nút Cân Bằng Tải Nhân Sự (Workload Heatmap) */}
          <button
            type="button"
            onClick={() => setIsWorkloadModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/60 shadow-sm transition active:scale-95 cursor-pointer"
            title="Xem bản đồ nhiệt tải công việc & AI cân bằng tải"
          >
            <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>⚖️ Cân Bằng Tải Nhân Sự</span>
          </button>

          {/* Nút Ra Lệnh Giọng Nói AI (Voice Command) */}
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-purple-600 rounded-xl hover:from-rose-600 hover:to-purple-700 shadow-md shadow-rose-500/20 transition active:scale-95 cursor-pointer"
            title="Ra lệnh tạo việc hoặc tra cứu bằng giọng nói tiếng Việt"
          >
            <Mic className="w-4 h-4 animate-pulse" />
            <span>🎙️ Ra Lệnh Giọng Nói AI</span>
          </button>

          {/* Nút Xuất Báo Cáo Tiến Độ (Phần 4) */}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition active:scale-95 cursor-pointer"
            title="Xuất báo cáo tiến độ chi tiết dự án (CSV / In)"
          >
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>📊 Xuất Báo Cáo</span>
          </button>

          <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-full font-medium border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Đồng bộ thời gian thực
          </span>
        </div>
      </div>

      {/* BỘ LỌC KANBAN THÔNG MINH (Phần 4: Kanban Quick Filters) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:flex-row lg:items-center">
        {/* Ô tìm kiếm thời gian thực */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Tìm theo tên task, mô tả hoặc người được giao..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Các nút bấm lọc nhanh (Quick Filter Pills) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc: Chỉ việc của tôi */}
          <button
            type="button"
            onClick={() => setOnlyMyTasks(!onlyMyTasks)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              onlyMyTasks
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Việc của tôi</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              onlyMyTasks ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {myTasksCount}
            </span>
          </button>

          {/* Lọc: Khẩn cấp / Quá hạn */}
          <button
            type="button"
            onClick={() => setUrgentOrOverdue(!urgentOrOverdue)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              urgentOrOverdue
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${urgentOrOverdue ? 'text-white' : 'text-rose-500'}`} />
            <span>Khẩn cấp / Quá hạn</span>
            {urgentOrOverdueCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                urgentOrOverdue ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
              }`}>
                {urgentOrOverdueCount}
              </span>
            )}
          </button>

          {/* Lọc theo mức độ ưu tiên */}
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="ALL">Mọi mức ưu tiên</option>
              <option value="URGENT">Khẩn cấp (Urgent)</option>
              <option value="HIGH">Ưu tiên cao (High)</option>
              <option value="MEDIUM">Trung bình (Medium)</option>
              <option value="LOW">Thấp (Low)</option>
            </select>
          </div>

          {/* Nút reset bộ lọc */}
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Đặt lại toàn bộ bộ lọc"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* CÁC CỘT KANBAN */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const query = searchText.trim().toLocaleLowerCase('vi');
          const colTasks = tasks.filter((task) => {
            if (task.status !== col.id) return false;
            if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;
            if (onlyMyTasks && task.assigneeId !== user?.id) return false;
            if (urgentOrOverdue) {
              const isOverdue = task.dueDateValue && new Date(task.dueDateValue) < new Date() && task.status !== 'DONE';
              const isUrgent = task.priority === 'URGENT';
              if (!isOverdue && !isUrgent) return false;
            }
            if (query) {
              const matchesSearch = [task.title, task.description, task.assignee]
                .some((value) => value.toLocaleLowerCase('vi').includes(query));
              if (!matchesSearch) return false;
            }
            return true;
          });

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-3xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-4 h-full min-h-[500px]"
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
                {colTasks.map((task) => {
                  const isHighlighted = highlightedId === task.id;
                  const isOverdue = task.dueDateValue && new Date(task.dueDateValue) < new Date() && task.status !== 'DONE';

                  return (
                    <div
                      key={task.id}
                      id={`task-card-${task.id}`}
                      className={`p-4 rounded-2xl bg-white dark:bg-slate-800/90 border shadow-sm hover:shadow-md transition-all duration-300 space-y-2 group relative ${
                        isHighlighted
                          ? 'ring-4 ring-indigo-500 ring-offset-2 border-indigo-500 shadow-2xl scale-[1.02] animate-pulse duration-700 bg-indigo-50/60 dark:bg-indigo-950/40 z-10'
                          : 'border-slate-200/60 dark:border-slate-700/60'
                      }`}
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
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className="block w-full text-left text-xs font-bold leading-snug text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400 cursor-pointer"
                      >
                        {task.title}
                      </button>

                      {task.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <Users className="h-3 w-3" /> {task.assignee}
                        </span>
                        {task.attachmentsCount > 0 && (
                          <span className="flex items-center gap-1" title={`${task.attachmentsCount} tệp đính kèm`}>
                            <Paperclip className="h-3 w-3" /> {task.attachmentsCount}
                          </span>
                        )}
                        <div className="flex flex-col gap-1">
                          <span
                            className={`flex items-center gap-1 ${
                              isOverdue
                                ? 'font-bold text-rose-600 dark:text-rose-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            <Clock className="h-3 w-3 shrink-0" />
                            {task.dueDate}
                          </span>
                          {task.dueDateValue && (
                            <CountdownBadge dueDate={task.dueDateValue} isCompleted={task.status === 'DONE'} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400 dark:border-slate-700">
                    {tasks.some((task) => task.status === col.id)
                      ? 'Không có công việc khớp bộ lọc.'
                      : 'Chưa có công việc trong cột này.'}
                  </p>
                )}
              </div>

              {/* Nút thêm nhanh task vào cột */}
              {canManageTasks && (
                <div className="pt-3">
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
                          type="datetime-local"
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
                          type="button"
                          onClick={() => setActiveColumn(null)}
                          className="px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreateTask(col.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveColumn(col.id);
                        setNewTaskTitle('');
                        setNewTaskDescription('');
                        setNewTaskPriority('MEDIUM');
                        setNewTaskDueDate('');
                      }}
                      className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-white/60 dark:hover:bg-slate-800/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm việc
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL CHI TIẾT TASK (Render một lần duy nhất tại root) */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          canEditSubtasks={
            canManageTasks ||
            tasks.find((task) => task.id === selectedTaskId)?.assigneeId === user?.id
          }
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

      {/* MODAL XUẤT BÁO CÁO TIẾN ĐỘ DỰ ÁN (Phần 4: Export Project Report) */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Báo Cáo Tiến Độ Dự Án
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {projectDetails?.name || `Mã dự án: ${projectId}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto print:max-h-none">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                    Tổng Công Việc
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">
                    {totalTasksCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-center">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block">
                    Đã Hoàn Thành
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {completedTasksCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-center">
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block">
                    Tỷ Lệ Hoàn Thành
                  </span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                    {progressPercent}%
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 text-center">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium block">
                    Đầu Việc Quá Hạn
                  </span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                    {overdueTasksList.length}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                  <span>Tiến độ thực hiện mục tiêu</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Danh sách thành viên */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Danh Sách Thành Viên Dự Án ({projectDetails?.members?.length || 0})
                </h4>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {projectDetails?.members && projectDetails.members.length > 0 ? (
                    projectDetails.members.map((m: any) => (
                      <div key={m.id || m.userId} className="p-2.5 flex items-center justify-between bg-white dark:bg-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">
                            {m.user?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {m.user?.name || 'Thành viên'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {m.user?.email || ''}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {m.role === 'PROJECT_MANAGER' ? 'Quản lý dự án' : 'Thành viên'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="p-3 text-xs text-slate-400 text-center">Chưa có thành viên nào tham gia</p>
                  )}
                </div>
              </div>

              {/* Danh sách việc quá hạn nếu có */}
              {overdueTasksList.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    Các Đầu Việc Trễ Hạn Cần Xử Lý Gấp ({overdueTasksList.length})
                  </h4>
                  <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden divide-y divide-rose-100 dark:divide-rose-950 text-xs bg-rose-50/30 dark:bg-rose-950/20">
                    {overdueTasksList.map((t) => (
                      <div key={t.id} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                            {t.title}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Người phụ trách: {t.assignee} • Hạn chót: {t.dueDate}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
                          {t.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
                Hỗ trợ xuất bảng tính CSV chuẩn UTF-8 và in trực tiếp
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>In / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Xuất File CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AI VOICE COMMAND */}
      <VoiceCommandModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onExecuteCommand={handleVoiceCommand}
        title="AI Voice Command - Thêm Việc & Điều Khiển Bằng Giọng Nói"
      />

      {/* MODAL CÂN BẰNG TẢI NHÂN SỰ & WORKLOAD HEATMAP */}
      <WorkloadHeatmapModal
        isOpen={isWorkloadModalOpen}
        onClose={() => setIsWorkloadModalOpen(false)}
        tasks={tasks}
        users={users}
        projectId={projectId}
        onRebalanceSuccess={loadProjectTasks}
      />
    </div>
  );
};

export default KanbanPage;

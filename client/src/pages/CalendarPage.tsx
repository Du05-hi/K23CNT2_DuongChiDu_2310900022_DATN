import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  CheckSquare,
  Sparkles,
  ArrowUpRight,
  Plus,
  Bell,
  X,
  Loader2,
  Flag,
  User,
  CalendarCheck,
  AlertCircle,
  Mic,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/hooks/useAuth';
import CountdownBadge from '@/components/ui/CountdownBadge';
import { formatDateTime, formatDateOnly, pad } from '@/utils/deadline';
import TaskDetailsModal from '@/components/TaskDetailsModal';
import VoiceCommandModal, { type ParsedVoiceCommand } from '@/components/voice/VoiceCommandModal';

interface ProjectDeadlineItem {
  id: string;
  name: string;
  startDate?: string | null;
  endDate: string;
  deadline?: string;
  status: string;
  departmentName?: string;
  creatorName?: string;
}

interface TaskDeadlineItem {
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

// Helper chuẩn hóa chuỗi ngày an toàn tuyệt đối tránh lỗi lệch múi giờ
export const extractDateStr = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') {
    // Nếu là dạng ISO "2026-10-22T21:34:00..." lấy ngay 10 ký tự đầu:
    if (val.includes('T')) return val.split('T')[0];
    if (val.includes(' ')) return val.split(' ')[0];
    return val.substring(0, 10);
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const toDateKey = extractDateStr;
export const getLocalDateString = extractDateStr;

export const extractTimeStr = (val: any): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  } catch {}
  if (typeof val === 'string') {
    if (val.includes('T')) {
      const timePart = val.split('T')[1];
      if (timePart) return timePart.substring(0, 5);
    }
    if (val.includes(' ')) {
      const timePart = val.split(' ')[1];
      if (timePart) return timePart.substring(0, 5);
    }
  }
  return '';
};

export const getTimeString = extractTimeStr;

const DAYS_OF_WEEK = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Calendar View State: Year & Month
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayEventsDate, setSelectedDayEventsDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'PROJECTS' | 'TASKS' | 'PENDING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Quick Task Creation Modal State
  const [isQuickTaskModalOpen, setIsQuickTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [taskTime, setTaskTime] = useState('17:30');
  const [taskProjectId, setTaskProjectId] = useState('PERSONAL');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [taskDescription, setTaskDescription] = useState('');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Drag & Drop Task Rescheduling State
  const [draggingTask, setDraggingTask] = useState<{ id: string; title: string; dueDate?: string | null } | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const isDraggingRef = React.useRef(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Local state lưu các task vừa tạo để hiển thị ngay lập tức 0ms (Optimistic UI)
  const [createdTasks, setCreatedTasks] = useState<TaskDeadlineItem[]>([]);

  // 1. Fetch Calendar Events (Projects + Tasks) from Backend API
  const { data: calendarData, isLoading, refetch: refetchCalendar } = useQuery({
    queryKey: ['calendar-events', year, month],
    queryFn: async () => {
      const res = await apiClient.get<any>('/calendar/events', {
        params: { year, month: month + 1 },
      });
      // Do apiClient response interceptor tự động unwrap body.data (nếu có { success, data }),
      // ta xử lý an toàn cho cả hai trường hợp
      const raw = res.data;
      if (!raw) return { projects: [], tasks: [] };
      if (raw.tasks || raw.projects) return raw;
      if (raw.data && (raw.data.tasks || raw.data.projects)) return raw.data;
      return { projects: [], tasks: [] };
    },
  });

  const projects: ProjectDeadlineItem[] = useMemo(() => {
    const raw = calendarData;
    if (!raw) return [];
    if (Array.isArray(raw.projects)) return raw.projects;
    if (Array.isArray(raw.data?.projects)) return raw.data.projects;
    return [];
  }, [calendarData]);

  // Gộp các task từ server và các task vừa tạo mới (optimistic UI update 100%)
  const allTasksList: TaskDeadlineItem[] = useMemo(() => {
    const raw = calendarData;
    let serverTasks: TaskDeadlineItem[] = [];
    if (raw) {
      if (Array.isArray(raw.tasks)) serverTasks = raw.tasks;
      else if (Array.isArray(raw.data?.tasks)) serverTasks = raw.data.tasks;
      else if (Array.isArray(raw)) serverTasks = raw;
    }
    if (createdTasks.length === 0) return serverTasks;
    const serverTaskIds = new Set(serverTasks.map((t) => t.id));
    const newLocalTasks = createdTasks.filter((t) => !serverTaskIds.has(t.id));
    return [...newLocalTasks, ...serverTasks];
  }, [calendarData, createdTasks]);

  const tasks: TaskDeadlineItem[] = allTasksList;

  // DEBUG LOG theo đúng yêu cầu đề bài
  console.log("CALENDAR RAW TASKS:", tasks);

  // 2. Fetch Projects List for Quick Task Select dropdown
  const { data: projectOptions = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['user-projects-select'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/projects');
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      return list.map((p: any) => ({ id: p.id, name: p.name }));
    },
  });

  // 3. Due Reminders Auto Scanner (Runs on mount & every 60s)
  useEffect(() => {
    let isMounted = true;
    const checkReminders = async () => {
      try {
        const res = await apiClient.get<any>('/calendar/reminders');
        if (!isMounted) return;
        const dueSoon = res.data?.data?.dueSoonTasks || [];
        if (dueSoon.length > 0) {
          const first = dueSoon[0];
          const dueTime = new Date(first.dueDate).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          toast(
            `⏰ Nhắc hẹn: Công việc "${first.title}" sắp đến hạn lúc ${dueTime}!`,
            {
              duration: 7000,
              icon: '⚠️',
              style: {
                background: '#fff7ed',
                color: '#c2410c',
                fontWeight: 700,
                border: '1px solid #fdba74',
                boxShadow: '0 10px 15px -3px rgba(234, 88, 12, 0.2)',
              },
            }
          );
        }
      } catch (err) {
        // silent check error
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Open Quick Task modal for a given Date
  const handleOpenCreateModal = (targetDate?: Date) => {
    const d = targetDate || new Date();
    const dateStr = toDateKey(d);
    setTaskDate(dateStr);
    setTaskTime('17:30');
    setTaskTitle('');
    setTaskDescription('');
    setTaskProjectId('PERSONAL');
    setTaskPriority('MEDIUM');
    setSelectedDayEventsDate(null); // Đóng modal danh sách ngày để tránh đè modal
    setIsQuickTaskModalOpen(true);
  };

  // Drag & drop reschedule task handler
  const handleTaskDropOnDay = async (targetDate: Date) => {
    if (!draggingTask) return;
    const taskToMove = draggingTask;
    setDraggingTask(null);
    setDragOverDateKey(null);

    // Giữ nguyên giờ:phút cũ, chỉ cập nhật ngày mới
    const newDueDate = new Date(targetDate);
    if (taskToMove.dueDate) {
      const oldD = new Date(taskToMove.dueDate);
      if (!isNaN(oldD.getTime())) {
        newDueDate.setHours(oldD.getHours(), oldD.getMinutes(), oldD.getSeconds(), 0);
      } else {
        newDueDate.setHours(17, 30, 0, 0);
      }
    } else {
      newDueDate.setHours(17, 30, 0, 0);
    }

    const dayFormatted = `${pad(newDueDate.getDate())}/${pad(newDueDate.getMonth() + 1)}/${newDueDate.getFullYear()}`;
    const toastId = toast.loading(`Đang dời hạn chót sang ngày ${dayFormatted}...`);

    try {
      await apiClient.patch(`/tasks/${taskToMove.id}/deadline`, {
        dueDate: newDueDate.toISOString(),
      });

      toast.success(`Đã dời hạn chót công việc sang ngày ${dayFormatted}!`, { id: toastId });

      // Tự động cập nhật lại vị trí thẻ trên lịch ngay lập tức
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['my-work'] }),
      ]);
    } catch (error: any) {
      try {
        await apiClient.put(`/tasks/${taskToMove.id}`, {
          dueDate: newDueDate.toISOString(),
        });
        toast.success(`Đã dời hạn chót công việc sang ngày ${dayFormatted}!`, { id: toastId });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
          queryClient.invalidateQueries({ queryKey: ['tasks'] }),
          queryClient.invalidateQueries({ queryKey: ['my-work'] }),
        ]);
      } catch (err2: any) {
        toast.error(
          error.response?.data?.message || err2.response?.data?.message || 'Không thể dời hạn chót công việc.',
          { id: toastId }
        );
      }
    }
  };

  // Submit Quick Task handler
  const handleCreateQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề công việc / sự kiện.');
      return;
    }

    setIsSubmittingTask(true);
    try {
      // Chuẩn hóa chính xác thời gian theo local Date
      const formattedTime = taskTime && taskTime.trim() ? (taskTime.length === 5 ? `${taskTime}:00` : taskTime) : '17:30:00';
      const [h, m] = formattedTime.split(':').map((num) => parseInt(num, 10) || 0);
      const [y, mon, d] = taskDate.split('-').map((num) => parseInt(num, 10));

      let exactDateObj: Date;
      if (y && mon && d) {
        exactDateObj = new Date(y, mon - 1, d, h, m, 0);
      } else {
        exactDateObj = new Date();
      }
      const isoDeadline = exactDateObj.toISOString();

      const res = await apiClient.post('/calendar/quick-task', {
        title: taskTitle.trim(),
        date: taskDate,
        time: taskTime,
        deadline: isoDeadline,
        dueDate: isoDeadline,
        projectId: taskProjectId,
        priority: taskPriority,
        description: taskDescription.trim() || undefined,
      });

      toast.success(res.data?.message || (res as any)?.message || 'Đã thêm công việc vào lịch biểu thành công!');
      setIsQuickTaskModalOpen(false);

      // CẬP NHẬT TỨC THÌ (Optimistic UI Update): Thêm ngay task mới vào state và cache để thẻ hiển thị trên ô ngày lập tức 0ms
      const rawRes = res.data;
      const newTask = (rawRes && rawRes.id) ? rawRes : (rawRes?.data || null);
      if (newTask && newTask.id) {
        setCreatedTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
        queryClient.setQueriesData({ queryKey: ['calendar-events'] }, (oldData: any) => {
          if (!oldData) return { projects: [], tasks: [newTask] };
          const currentTasks = oldData.tasks || [];
          const exists = currentTasks.some((t: any) => t.id === newTask.id);
          return {
            ...oldData,
            tasks: exists ? currentTasks.map((t: any) => t.id === newTask.id ? newTask : t) : [newTask, ...currentTasks],
          };
        });
      }

      // Tự động gọi lại dữ liệu (refetch) ngay sau khi tạo việc mới trên lịch để đồng bộ
      await refetchCalendar();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['my-work'] }),
      ]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể tạo công việc. Vui lòng thử lại.');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Delete task handler
  const handleDeleteTask = async (taskId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${title}"?`)) {
      return;
    }
    const toastId = toast.loading('Đang xóa công việc...');
    try {
      await apiClient.delete(`/tasks/${taskId}`);
      toast.success('Đã xóa lịch hẹn/công việc thành công!', { id: toastId });

      setCreatedTasks((prev) => prev.filter((t) => t.id !== taskId));

      // Cập nhật ngay query cache
      queryClient.setQueriesData({ queryKey: ['calendar-events'] }, (oldData: any) => {
        if (!oldData) return { projects: [], tasks: [] };
        return {
          ...oldData,
          tasks: (oldData.tasks || []).filter((t: any) => t.id !== taskId),
        };
      });

      await refetchCalendar();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['my-work'] }),
      ]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể xóa công việc.', { id: toastId });
    }
  };

  const pendingCount = useMemo(() => {
    const pendingTasks = tasks.filter((t) => t.status !== 'DONE').length;
    const pendingProjects = projects.filter((p) => p.status !== 'COMPLETED').length;
    return pendingTasks + pendingProjects;
  }, [tasks, projects]);

  // Build Calendar Days for the Month View (6 weeks = 42 cells)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Day of week: 0 is Sunday in JS, so convert to 0=Monday ... 6=Sunday
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      dateKey: string; // YYYY-MM-DD
    }> = [];

    const todayLocalStr = toDateKey(new Date());

    // Days before first of month
    for (let i = startDayOfWeek; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      const key = toDateKey(d);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: key === todayLocalStr,
        dateKey: key,
      });
    }

    // Days in current month
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const d = new Date(year, month, day);
      const key = toDateKey(d);
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday: key === todayLocalStr,
        dateKey: key,
      });
    }

    // Trailing days to fill 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const key = toDateKey(d);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: key === todayLocalStr,
        dateKey: key,
      });
    }

    return days;
  }, [year, month]);

  const handleVoiceCommand = (cmd: ParsedVoiceCommand) => {
    const raw = cmd.rawText.trim();
    const lower = raw.toLowerCase();

    // 1. Điền câu nói vào ô tìm kiếm
    setSearchQuery(raw);

    // 2. TỰ ĐỘNG KÍCH HOẠT HÀNH ĐỘNG NGAY LẬP TỨC:
    // + Nếu nhận diện câu có từ khóa "quá hạn" hoặc "cần xử lý": Tự động kích hoạt bộ lọc tab "Cần Xử Lý" trên Lịch
    if (
      cmd.filterTarget === 'PENDING' ||
      lower.includes('quá hạn') ||
      lower.includes('cần xử lý') ||
      lower.includes('trễ hạn') ||
      lower.includes('chưa xong')
    ) {
      setFilterType('PENDING');
      const cleanSearch = raw
        .replace(/(tìm|lọc|xem|kiểm tra|danh sách|các)?\s*(công việc|task|nhiệm vụ)?\s*(quá hạn|cần xử lý|trễ hạn|chưa xong)/gi, '')
        .trim();
      setSearchQuery(cleanSearch);
      toast.success('🎙️ Đã tự động kích hoạt bộ lọc "Cần Xử Lý"!');
      return;
    }

    // + Nếu nhận diện "tất cả": Chuyển về tab "Tất Cả"
    if (
      cmd.filterTarget === 'ALL' ||
      lower === 'tất cả' ||
      lower === 'toàn bộ' ||
      lower.includes('tất cả') ||
      lower.includes('toàn bộ')
    ) {
      setFilterType('ALL');
      setSearchQuery('');
      toast.success('🎙️ Đã chuyển về tab "Tất Cả"!');
      return;
    }

    // Nếu nhận diện "dự án"
    if (
      cmd.filterTarget === 'PROJECTS' ||
      (lower.includes('dự án') && !lower.includes('tạo') && !lower.includes('thêm'))
    ) {
      setFilterType('PROJECTS');
      const cleanSearch = raw.replace(/(tìm|lọc|xem|kiểm tra|danh sách)?\s*(dự án)/gi, '').trim();
      setSearchQuery(cleanSearch);
      toast.success('🎙️ Đã chuyển sang tab "Dự Án"!');
      return;
    }

    // Nếu nhận diện "công việc"
    if (
      cmd.filterTarget === 'TASKS' ||
      (lower.includes('công việc') && !lower.includes('tạo') && !lower.includes('thêm'))
    ) {
      setFilterType('TASKS');
      const cleanSearch = raw.replace(/(tìm|lọc|xem|kiểm tra|danh sách)?\s*(công việc|task)/gi, '').trim();
      setSearchQuery(cleanSearch);
      toast.success('🎙️ Đã chuyển sang tab "Công Việc"!');
      return;
    }

    // Lệnh tạo việc mới
    if (cmd.actionType === 'CREATE_TASK') {
      const title = cmd.taskData?.title || raw;
      setTaskTitle(title);
      if (cmd.taskData?.dueDate) {
        setTaskDate(toDateKey(cmd.taskData.dueDate));
      }
      if (cmd.taskData?.priority) {
        setTaskPriority(cmd.taskData.priority);
      }
      setIsQuickTaskModalOpen(true);
      toast.success(`🎙️ Đã nhận diện lệnh tạo việc: "${title}"`);
      return;
    }

    // + Nếu là lệnh tìm kiếm: Tự động chạy hàm lọc danh sách công việc thời gian thực theo từ khóa vừa nói
    const cleanSearch = raw.replace(/^(tìm|lọc|tra cứu|xem|kiểm tra)\s+/i, '').trim();
    setSearchQuery(cleanSearch || raw);
    toast.success(`🔍 Đã tự động lọc danh sách theo: "${cleanSearch || raw}"`);
  };

  // Lọc danh sách công việc và dự án theo bộ lọc và tìm kiếm thời gian thực
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return tasks.filter((t) => {
      if (filterType === 'PROJECTS') return false;
      if (filterType === 'PENDING' && t.status === 'DONE') return false;
      if (q && !t.title.toLowerCase().includes(q) && (!t.projectName || !t.projectName.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [tasks, filterType, searchQuery]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return projects.filter((p) => {
      if (filterType === 'TASKS') return false;
      if (filterType === 'PENDING' && p.status === 'COMPLETED') return false;
      if (q && !p.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [projects, filterType, searchQuery]);

  // Map events to dateKey (YYYY-MM-DD) chuẩn hóa theo múi giờ địa phương (local timezone)
  const eventsByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        projects: ProjectDeadlineItem[];
        tasks: TaskDeadlineItem[];
      }
    >();

    projects.forEach((p) => {
      const dateKey = toDateKey(p.deadline || p.endDate);
      if (!dateKey) return;
      const existing = map.get(dateKey) || { projects: [], tasks: [] };
      existing.projects.push(p);
      map.set(dateKey, existing);
    });

    tasks.forEach((t) => {
      const rawDeadline = t.deadline || t.dueDate;
      if (!rawDeadline) return;
      const dateKey = toDateKey(rawDeadline);
      if (!dateKey) return;
      const existing = map.get(dateKey) || { projects: [], tasks: [] };
      existing.tasks.push(t);
      map.set(dateKey, existing);
    });

    return map;
  }, [projects, tasks]);

  // Selected Day Items for Detail Modal
  const selectedDayItems = useMemo(() => {
    if (!selectedDayEventsDate) return { projects: [], tasks: [] };
    const key = toDateKey(selectedDayEventsDate);
    const dayProjects = projects.filter((p) => toDateKey(p.deadline || p.endDate) === key);
    const dayTasks = tasks.filter((t) => toDateKey(t.deadline || t.dueDate) === key);
    return { projects: dayProjects, tasks: dayTasks };
  }, [selectedDayEventsDate, projects, tasks]);

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 transition-colors duration-200 dark:bg-slate-950 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30 inline-flex items-center gap-1.5 shadow-sm">
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              Lịch Biểu Deadline & Kế Hoạch
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Enterprise Work Timeline & Due Date Matrix
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Lịch Làm Việc & Hạn Chót Hoàn Thành
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gom toàn bộ deadline dự án và công việc cần bàn giao theo ngày và tuần.
          </p>
        </div>

        {/* Action Controls: Add Task + Month Navigation */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          {/* AI Voice Command Button */}
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-rose-500 to-purple-600 rounded-2xl shadow-md shadow-rose-500/20 hover:from-rose-600 hover:to-purple-700 active:scale-95 transition cursor-pointer"
            title="Ra lệnh tạo lịch hẹn hoặc tìm kiếm bằng giọng nói"
          >
            <Mic className="w-4 h-4 animate-pulse" />
            <span>🎙️ Giọng Nói AI</span>
          </button>

          {/* Add Task Button */}
          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>➕ Thêm Công Việc / Lịch Hẹn</span>
          </button>

          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-2.5 text-xs font-bold rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Hôm Nay
          </button>

          <div className="flex items-center rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-extrabold text-slate-900 dark:text-white min-w-[120px] text-center">
              Tháng {month + 1}, {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Tháng kế tiếp"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Bộ Lọc:
          </span>
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tất Cả ({projects.length + tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('PROJECTS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'PROJECTS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Dự Án ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('TASKS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'TASKS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Công Việc ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'PENDING'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Cần Xử Lý ({pendingCount})
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Tìm theo tên task / dự án..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3.5 pr-8 py-2 text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* CALENDAR MONTH GRID */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-center text-xs font-extrabold text-slate-600 dark:text-slate-300 py-3">
          {DAYS_OF_WEEK.map((d, i) => (
            <div key={d} className={i >= 5 ? 'text-indigo-600 dark:text-indigo-400' : ''}>
              {d}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800">
          {calendarDays.map((cell, idx) => {
            const targetDateStr = extractDateStr(cell.date);
            // Lọc các task thuộc ngày này bằng extractDateStr
            const matchedTasks = allTasksList.filter(
              (t) => extractDateStr(t.deadline || t.dueDate) === targetDateStr
            );
            // Lọc các dự án thuộc ngày này
            const cellProjects = filteredProjects.filter(
              (p) => extractDateStr(p.deadline || p.endDate) === targetDateStr
            );

            // Task hiển thị theo bộ lọc tab và tìm kiếm
            const displayTasks = matchedTasks.filter((t) => {
              if (filterType === 'PROJECTS') return false;
              if (filterType === 'PENDING' && t.status === 'DONE') return false;
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                return (
                  t.title.toLowerCase().includes(q) ||
                  (t.projectName && t.projectName.toLowerCase().includes(q))
                );
              }
              return true;
            });

            const totalCount = matchedTasks.length + cellProjects.length;
            const isCellHasTasks = matchedTasks.length > 0 || cellProjects.length > 0;

            const hasOverdue = matchedTasks.some(
              (t) => t.isOverdue || (t.status !== 'DONE' && new Date(t.deadline || t.dueDate) < new Date())
            );
            const hasDueSoon = matchedTasks.some((t) => t.isDueSoon);

            return (
              <div
                key={idx}
                onDoubleClick={() => handleOpenCreateModal(cell.date)}
                onClick={() => {
                  if (isDraggingRef.current) return;
                  setSelectedDayEventsDate(cell.date);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverDateKey(cell.dateKey);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (dragOverDateKey === cell.dateKey) {
                    setDragOverDateKey(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTaskDropOnDay(cell.date);
                }}
                className={`min-h-[125px] p-2 flex flex-col justify-between transition group cursor-pointer ${
                  !cell.isCurrentMonth
                    ? 'bg-slate-50/40 dark:bg-slate-950/40 opacity-40 hover:opacity-75'
                    : isCellHasTasks
                    ? 'bg-indigo-50/40 hover:bg-indigo-50/70 dark:bg-indigo-950/25 dark:hover:bg-indigo-950/45'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                } ${cell.isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/50 dark:bg-indigo-950/50' : ''} ${
                  dragOverDateKey === cell.dateKey
                    ? 'ring-2 ring-indigo-600 bg-indigo-100/70 dark:bg-indigo-950/70 shadow-inner'
                    : ''
                }`}
                title="Nhấp để xem chi tiết / Kéo thả task để dời hạn chót / Nhấp đúp để thêm việc"
              >
                {/* Cell Header: Day Number + Add Button + Counts */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col items-center">
                      <span
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                          cell.isToday
                            ? 'bg-indigo-600 text-white font-black shadow-sm'
                            : isCellHasTasks
                            ? 'font-black text-indigo-950 dark:text-indigo-100 group-hover:text-indigo-600'
                            : 'font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {/* Chấm nhỏ xanh/tím dưới số ngày để báo hiệu có lịch trình */}
                      {isCellHasTasks && !cell.isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 -mt-0.5" />
                      )}
                    </div>

                    {/* Quick Add Button on Hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCreateModal(cell.date);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-slate-800 dark:text-indigo-400 transition"
                      title="Thêm việc cho ngày này"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {totalCount > 0 && (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                        hasDueSoon
                          ? 'bg-amber-100 text-amber-800 animate-pulse ring-1 ring-amber-400 dark:bg-amber-950/80 dark:text-amber-300'
                          : hasOverdue
                          ? 'bg-rose-100 text-rose-700 animate-pulse ring-1 ring-rose-400 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300'
                      }`}
                    >
                      {totalCount} việc
                    </span>
                  )}
                </div>

                {/* Cell Body: Event Note Pills */}
                <div className="space-y-1 flex-1 overflow-hidden">
                  {/* Projects Chips (Dự án đến hạn) */}
                  {cellProjects.slice(0, 1).map((p) => (
                    <div
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${p.id}/kanban`);
                      }}
                      className="w-full px-2 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 text-[10px] font-bold truncate flex items-center gap-1 shadow-xs cursor-pointer mb-1"
                      title={`Hạn chót Dự án: ${p.name}`}
                    >
                      <FolderKanban className="w-2.5 h-2.5 shrink-0 text-purple-600 dark:text-purple-400" />
                      <span className="truncate">📁 {p.name}</span>
                    </div>
                  ))}

                  {/* BẮT BUỘC RENDER THẺ SỰ KIỆN: Nếu có task trong ngày, vẽ ngay thẻ note sự kiện */}
                  {displayTasks.slice(0, 2).map((t) => {
                    const taskDue = t.deadline || t.dueDate;
                    const isOverdue = t.isOverdue || (t.status !== 'DONE' && new Date(taskDue) < new Date());
                    const isUrgent = t.priority === 'URGENT' || isOverdue;
                    const timeStr = extractTimeStr(taskDue);

                    // Chấm tròn màu xanh/vàng/đỏ theo trạng thái
                    let dotColor = 'bg-amber-500';
                    if (t.status === 'DONE') {
                      dotColor = 'bg-emerald-500';
                    } else if (isUrgent) {
                      dotColor = 'bg-rose-500 animate-pulse';
                    }

                    return (
                      <div
                        key={t.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          isDraggingRef.current = true;
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', t.id);
                          setDraggingTask({ id: t.id, title: t.title, dueDate: taskDue });
                        }}
                        onDragEnd={() => {
                          setDraggingTask(null);
                          setDragOverDateKey(null);
                          setTimeout(() => {
                            isDraggingRef.current = false;
                          }, 150);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTaskId(t.id);
                        }}
                        className={`bg-indigo-50 border border-indigo-200 text-indigo-900 rounded p-1 mb-1 text-xs font-semibold shadow-xs flex items-center justify-between gap-1.5 cursor-pointer active:cursor-grabbing hover:bg-indigo-100 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-200 transition select-none group/task ${
                          draggingTask?.id === t.id ? 'opacity-40 ring-1 ring-indigo-400' : ''
                        } ${
                          isUrgent ? 'border-rose-300 text-rose-700 bg-rose-50/90 dark:bg-rose-950/60 dark:text-rose-300' : ''
                        }`}
                        title={`${t.isPersonal ? 'Lịch cá nhân' : 'Dự án'}: ${t.title} (${timeStr || 'Hạn chót'})`}
                      >
                        <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                          {/* Chấm tròn trạng thái */}
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                          {/* Giờ hiển thị: Lấy giờ:phút trực tiếp từ chuỗi deadline (VD: "21:34") */}
                          {timeStr && (
                            <span className="text-[10px] font-semibold font-mono shrink-0 opacity-80">
                              {timeStr}
                            </span>
                          )}
                          {/* Tên công việc (VD: "ge") */}
                          <span
                            className={`truncate ${
                              t.status === 'DONE' ? 'line-through opacity-70' : ''
                            }`}
                          >
                            {t.title}
                          </span>
                        </div>

                        {/* Quick action buttons on hover */}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/task:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskId(t.id);
                            }}
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTask(t.id, t.title, e)}
                            className="p-0.5 rounded hover:bg-rose-200 text-rose-600 dark:hover:bg-rose-950/80 transition"
                            title="Xóa công việc"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Nếu ô ngày có từ 3 công việc trở lên: Hiển thị 2 thẻ đầu tiên kèm badge nhỏ "+X việc khác..." bấm vào mở modal chi tiết ngày */}
                  {displayTasks.length >= 3 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDayEventsDate(cell.date);
                      }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-900/50 transition cursor-pointer flex items-center justify-between"
                    >
                      <span>+{displayTasks.length - 2} việc khác...</span>
                      <ChevronRight className="w-3 h-3 opacity-60" />
                    </button>
                  )}
                </div>

                {/* Footer indicator */}
                <div className="h-1 w-full" />
              </div>
            );
          })}
        </div>
      </div>

      {/* QUICK TASK CREATION MODAL */}
      <AnimatePresence>
        {isQuickTaskModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      Thêm Công Việc / Lịch Hẹn
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tạo nhiệm vụ hoặc ghi chú lịch biểu có chọn giờ cụ thể
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsQuickTaskModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateQuickTask} className="space-y-4">
                {/* 1. Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tên công việc / Sự kiện cần làm <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Họp giao ban dự án, nộp báo cáo tiến độ..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* 2. Date and Time Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Ngày thực hiện / Hạn chót
                    </label>
                    <input
                      type="date"
                      required
                      value={taskDate}
                      onChange={(e) => setTaskDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Giờ cụ thể (HH:mm)
                    </label>
                    <input
                      type="time"
                      required
                      value={taskTime}
                      onChange={(e) => setTaskTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* 3. Project selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                    <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                    Dự án liên kết
                  </label>
                  <select
                    value={taskProjectId}
                    onChange={(e) => setTaskProjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="PERSONAL">⭐ Việc cá nhân / Ghi chú lịch</option>
                    {projectOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        📁 {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Priority */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                    <Flag className="w-3.5 h-3.5 text-indigo-500" />
                    Mức độ ưu tiên
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'URGENT', label: 'Khẩn cấp', color: 'border-rose-400 text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
                      { key: 'HIGH', label: 'Cao', color: 'border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
                      { key: 'MEDIUM', label: 'Bình thường', color: 'border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
                      { key: 'LOW', label: 'Thấp', color: 'border-slate-300 text-slate-600 bg-slate-50 dark:bg-slate-800' },
                    ].map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setTaskPriority(p.key as any)}
                        className={`py-2 px-1 text-center rounded-2xl text-xs font-bold border transition cursor-pointer ${
                          taskPriority === p.key
                            ? `${p.color} ring-2 ring-indigo-500 ring-offset-1`
                            : 'border-slate-200 text-slate-500 bg-white dark:bg-slate-800 dark:border-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ghi chú / Mô tả (tùy chọn)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Nội dung chi tiết của nhiệm vụ hoặc link tài liệu..."
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsQuickTaskModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTask}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer disabled:opacity-60"
                  >
                    {isSubmittingTask ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Lưu Vào Lịch Biểu</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SELECTED DAY EVENTS MODAL / DRAWER */}
      <AnimatePresence>
        {selectedDayEventsDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      Danh Sách Deadline Ngày {formatDateOnly(selectedDayEventsDate)}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tổng hợp {selectedDayItems.projects.length} dự án & {selectedDayItems.tasks.length} công việc cần nộp đúng hạn.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const d = selectedDayEventsDate;
                      setSelectedDayEventsDate(null);
                      handleOpenCreateModal(d || undefined);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm việc</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDayEventsDate(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Projects List */}
              {selectedDayItems.projects.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                    Dự Án Đến Hạn Bàn Giao ({selectedDayItems.projects.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDayItems.projects.map((p) => (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-2xl border border-indigo-200/80 bg-indigo-50/40 dark:border-indigo-900/50 dark:bg-indigo-950/20 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {p.departmentName || 'Chung'}
                            </span>
                            <span>•</span>
                            <span>Hạn: {formatDateTime(p.endDate)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <CountdownBadge dueDate={p.endDate} isCompleted={p.status === 'COMPLETED'} />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDayEventsDate(null);
                              navigate(`/projects/${p.id}/kanban`);
                            }}
                            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-indigo-300 transition cursor-pointer"
                            title="Xem Kanban dự án"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks List */}
              {selectedDayItems.tasks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                    Nhiệm Vụ Cần Hoàn Thành ({selectedDayItems.tasks.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDayItems.tasks.map((t) => {
                      const isOverdue = t.isOverdue || (t.status !== 'DONE' && new Date(t.dueDate) < new Date());
                      const isDueSoon = t.isDueSoon;

                      return (
                        <div
                          key={t.id}
                          className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 shadow-2xs ${
                            isDueSoon
                              ? 'border-amber-300 bg-amber-50/70 animate-pulse ring-2 ring-amber-400 dark:bg-amber-950/40 dark:border-amber-800'
                              : isOverdue
                              ? 'border-rose-300 bg-rose-50/70 animate-pulse ring-2 ring-rose-400 dark:bg-rose-950/40 dark:border-rose-800'
                              : t.isPersonal
                              ? 'border-indigo-200 bg-indigo-50/30 dark:border-indigo-900/50 dark:bg-indigo-950/20'
                              : 'border-amber-200 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/20'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                                {t.title}
                              </p>
                              {t.isPersonal ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  ⭐ Lịch hẹn cá nhân
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  📁 {t.projectName || 'Dự án'}
                                </span>
                              )}
                              {isDueSoon && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-bounce">
                                  ⏰ SẮP ĐẾN HẠN
                                </span>
                              )}
                              {isOverdue && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white">
                                  QUÁ HẠN
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                              <span>{t.projectName || 'Dự án'}</span>
                              <span>•</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                Phụ trách: {t.assigneeName || 'Tôi'}
                              </span>
                              <span>•</span>
                              <span>Hạn: {formatDateTime(t.dueDate)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <CountdownBadge dueDate={t.dueDate} isCompleted={t.status === 'DONE'} />
                            <button
                              type="button"
                              onClick={() => setSelectedTaskId(t.id)}
                              className="p-2 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 transition cursor-pointer"
                              title="Xem chi tiết công việc"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTask(t.id, t.title, e)}
                              className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-rose-500 hover:text-rose-600 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-rose-400 transition cursor-pointer"
                              title="Xóa công việc / lịch hẹn"
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

              {/* Empty state for selected date */}
              {selectedDayItems.projects.length === 0 && selectedDayItems.tasks.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
                  <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    Không có deadline nào vào ngày này!
                  </p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    Bạn hoàn toàn thảnh thơi hoặc có thể tranh thủ tạo việc mới vào ngày này.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const d = selectedDayEventsDate;
                      setSelectedDayEventsDate(null);
                      handleOpenCreateModal(d || undefined);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-500 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Công Việc Ngay</span>
                  </button>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDayEventsDate(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Details Modal */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          canEditSubtasks={true}
          canAssignTask={user?.role === 'ADMIN' || user?.role === 'MANAGER'}
          usersList={[]}
          onTaskUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
          }}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Voice Command Modal */}
      <VoiceCommandModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onExecuteCommand={handleVoiceCommand}
        title="AI Voice Command - Thêm Việc & Lịch Hẹn Bằng Giọng Nói"
      />
    </div>
  );
};

export default CalendarPage;

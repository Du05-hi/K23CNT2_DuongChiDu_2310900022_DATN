import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  FolderKanban,
  Plus,
  Search,
  LayoutGrid,
  List,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  ArrowRight,
  Sparkles,
  X,
  AlertTriangle,
  FolderOpen,
  TrendingUp,
  Building,
  CheckSquare,
  ListTodo,
  ExternalLink,
  Flame,
  FilterX,
  ArrowUpRight,
  Target,
  CircleDot,
  Check,
  Scale,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Department, Project, ProjectStatus, User } from '../types';
import { apiClient } from '../api/apiClient';
import { useAuth } from '@/hooks/useAuth';
import taskService, { type TaskStatus, type TaskPriority } from '@/services/taskService';
import TaskDetailsModal from '@/components/TaskDetailsModal';
import { formatDateTime, toDatetimeLocalString, fromDatetimeLocalToIso } from '../utils/deadline';
import CountdownBadge from '../components/ui/CountdownBadge';
import WorkloadHeatmapModal from '@/components/workload/WorkloadHeatmapModal';

const statusBadgeStyles: Record<ProjectStatus, string> = {
  PLANNING: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  ARCHIVED: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: 'Lập Kế Hoạch',
  IN_PROGRESS: 'Đang Triển Khai',
  COMPLETED: 'Đã Hoàn Thành',
  ARCHIVED: 'Lưu Trữ',
};

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: 'Cần làm (To Do)',
  IN_PROGRESS: 'Đang làm (In Progress)',
  REVIEW: 'Chờ duyệt (Review)',
  DONE: 'Hoàn thành (Done)',
};

const taskPriorityBadge: Record<TaskPriority, { label: string; style: string }> = {
  URGENT: { label: 'Khẩn cấp', style: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900' },
  HIGH: { label: 'Ưu tiên cao', style: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-900' },
  MEDIUM: { label: 'Trung bình', style: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900' },
  LOW: { label: 'Thấp', style: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
};

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const isSameWeek = (date: Date, now: Date) => {
  const d = new Date(date);
  const current = new Date(now);
  const day = current.getDay();
  const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(current.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return d >= monday && d <= sunday;
};

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Navigation Tab State (Phần 2: Chuyển đổi giữa Danh mục dự án & Công việc của tôi)
  const [activeTab, setActiveTab] = useState<'projects' | 'my-tasks'>('projects');

  // Projects View State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // My Tasks View State
  const [myTasksSearch, setMyTasksSearch] = useState('');
  const [myTasksDateFilter, setMyTasksDateFilter] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'OVERDUE'>('ALL');
  const [myTasksStatusFilter, setMyTasksStatusFilter] = useState<string>('ALL');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'PLANNING' as ProjectStatus,
    startDate: '',
    endDate: '',
    departmentId: '',
  });
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // 1. Fetch Projects (Phần 1: Cập nhật đầy đủ dữ liệu từ backend)
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/projects');
      const raw = response.data;
      if (Array.isArray(raw)) return raw as Project[];
      if (raw && Array.isArray(raw.data)) return raw.data as Project[];
      return [];
    },
  });

  // 2. Fetch My Assigned Tasks (Phần 2: Gom toàn bộ các công việc được giao)
  const { data: myTasksRaw, isLoading: isLoadingMyTasks, refetch: refetchMyTasks } = useQuery({
    queryKey: ['my-assigned-tasks'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/tasks/my-tasks');
      const raw = response.data;
      if (raw && Array.isArray(raw.tasks)) return raw.tasks;
      if (Array.isArray(raw)) return raw;
      if (raw?.data && Array.isArray(raw.data.tasks)) return raw.data.tasks;
      return [];
    },
  });

  const myTasks: any[] = useMemo(() => (Array.isArray(myTasksRaw) ? myTasksRaw : []), [myTasksRaw]);

  // Fetch Departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await apiClient.get<Department[]>('/users/departments');
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  // Fetch Department Users for project assignment
  const { data: departmentUsers = [] } = useQuery({
    queryKey: ['project-department-users', formData.departmentId],
    queryFn: async () => {
      const usersRes: User[] = [];
      const response = await apiClient.get<User[]>('/users', {
        params: {
          limit: 1000,
          isActive: true,
          ...(formData.departmentId ? { departmentId: formData.departmentId } : {}),
        },
      });
      const data = Array.isArray(response.data) ? response.data : [];
      usersRes.push(...data);
      return usersRes.filter((person) => person.role === 'MANAGER' || person.role === 'EMPLOYEE');
    },
    enabled: isModalOpen || Boolean(selectedTaskId),
  });

  const formattedUsersList = useMemo(() => {
    return departmentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar || undefined,
    }));
  }, [departmentUsers]);

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchDept = deptFilter === 'ALL' || p.departmentId === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [projects, searchQuery, statusFilter, deptFilter]);

  // Project Stats Breakdown (Phần 1: Thống kê đúng theo số lượng dự án thực tế user tham gia)
  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const planning = projects.filter((p) => p.status === 'PLANNING').length;
    return { total, inProgress, completed, planning };
  }, [projects]);

  // Filtered My Tasks (Phần 2: Bộ lọc nhanh Tất cả, Hôm nay, Tuần này, Quá hạn)
  const filteredMyTasks = useMemo(() => {
    const now = new Date();
    const query = myTasksSearch.trim().toLowerCase();

    return myTasks.filter((t) => {
      // 1. Text Search
      if (query) {
        const matchTitle = t.title?.toLowerCase().includes(query);
        const matchDesc = t.description?.toLowerCase().includes(query);
        const matchProject = t.project?.name?.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchProject) return false;
      }

      // 2. Status Filter
      if (myTasksStatusFilter !== 'ALL' && t.status !== myTasksStatusFilter) {
        return false;
      }

      // 3. Date Quick Filter
      if (myTasksDateFilter === 'TODAY') {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        if (!isSameDay(d, now)) return false;
      } else if (myTasksDateFilter === 'THIS_WEEK') {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        if (!isSameWeek(d, now)) return false;
      } else if (myTasksDateFilter === 'OVERDUE') {
        const isOverdue = t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now;
        if (!isOverdue) return false;
      }

      return true;
    });
  }, [myTasks, myTasksSearch, myTasksStatusFilter, myTasksDateFilter]);

  // Quick Status Update for My Tasks (Phần 2: Cập nhật trực tiếp không cần vào từng dự án)
  const handleQuickUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await taskService.updateTaskStatus(taskId, { status: newStatus });
      toast.success(`Đã cập nhật trạng thái: ${taskStatusLabels[newStatus]}!`);
      if (newStatus === 'DONE') {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-assigned-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['my-work'] }),
      ]);
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái task:', err);
      toast.error('Không thể cập nhật trạng thái công việc.');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      description: '',
      status: 'PLANNING',
      startDate: toDatetimeLocalString(new Date()),
      endDate: '',
      departmentId: user?.role === 'MANAGER' ? user.departmentId || '' : '',
    });
    setSelectedManagerId(user?.role === 'MANAGER' ? user.id : '');
    setMemberIds([]);
    setMemberSearch('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      status: project.status,
      startDate: project.startDate ? toDatetimeLocalString(project.startDate) : '',
      endDate: project.endDate ? toDatetimeLocalString(project.endDate) : '',
      departmentId: project.departmentId || '',
    });
    const managerMember = project.members?.find((m) => (m as any).role === 'PROJECT_MANAGER' || m.user?.role === 'MANAGER');
    setSelectedManagerId(managerMember?.userId || '');
    setMemberIds(project.members?.map((m) => m.userId) || []);
    setMemberSearch('');
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên dự án.');
      return;
    }

    setIsSavingProject(true);
    try {
      const allMembers = Array.from(new Set([
        ...memberIds,
        ...(selectedManagerId ? [selectedManagerId] : []),
      ]));

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status,
        startDate: formData.startDate ? fromDatetimeLocalToIso(formData.startDate) : null,
        endDate: formData.endDate ? fromDatetimeLocalToIso(formData.endDate) : null,
        departmentId: formData.departmentId || null,
        memberIds: allMembers,
      };

      if (editingProject) {
        await apiClient.put(`/projects/${editingProject.id}`, payload);
        toast.success(`Đã cập nhật dự án "${formData.name.trim()}".`);
      } else {
        await apiClient.post('/projects', payload);
        toast.success(`Đã tạo dự án mới "${formData.name.trim()}" thành công!`);
      }

      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Lỗi khi lưu dự án:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu thông tin dự án.');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeletingProject(true);
    try {
      await apiClient.delete(`/projects/${projectToDelete.id}`);
      toast.success(`Đã xóa dự án "${projectToDelete.name}".`);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectToDelete(null);
    } catch (err: any) {
      console.error('Lỗi khi xóa dự án:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa dự án.');
    } finally {
      setIsDeletingProject(false);
    }
  };

  const getRemainingDays = (endDateStr?: string | null) => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 transition-colors duration-200 dark:bg-slate-950 sm:p-6 lg:p-8 space-y-7">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30 inline-flex items-center gap-1.5 shadow-sm">
              <FolderKanban className="w-4 h-4 text-indigo-500" />
              Quản Lý Dự Án Toàn Diện
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Enterprise Project Management
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Phân Hệ Quản Trị Dự Án & Công Việc
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi tiến độ, phân bổ nguồn lực đội ngũ và quản trị các bảng Kanban công việc.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
          {/* Nút Cân Bằng Tải Nhân Sự (Workload Heatmap) */}
          <button
            type="button"
            onClick={() => setIsWorkloadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-2xl hover:bg-amber-100 transition shadow-sm active:scale-95 cursor-pointer"
            title="Xem bản đồ nhiệt tải công việc & AI Cân bằng tải"
          >
            <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>⚖️ Cân Bằng Tải Nhân Sự</span>
          </button>

          {canManage && activeTab === 'projects' && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 rounded-2xl shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-purple-500 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Dự Án Mới</span>
            </button>
          )}
        </div>
      </header>

      {/* THANH CHUYỂN TAB LINH HOẠT (Phần 2: Tab 1 Danh mục dự án | Tab 2 Công việc của tôi) */}
      <nav className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1" aria-label="Tabs dự án">
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
            activeTab === 'projects'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Danh Mục Dự Án</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
            activeTab === 'projects' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}>
            {projects.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my-tasks')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
            activeTab === 'my-tasks'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Công Việc Của Tôi</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
            activeTab === 'my-tasks' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}>
            {myTasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/calendar')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400"
          title="Chuyển sang chế độ Lịch biểu Deadline"
        >
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span>Lịch Biểu Deadline</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Calendar View
          </span>
        </button>
      </nav>

      {/* ========================================================
          NỘI DUNG TAB 1: DANH MỤC DỰ ÁN
          ======================================================== */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          {/* Metric Quick Stats (Phần 1: Thống kê đúng theo số lượng dự án thực tế user tham gia) */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Tổng Số Dự Án</span>
                <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <FolderOpen className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white">{stats.total}</p>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Dự án bạn được phân quyền tham gia</span>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Đang Triển Khai</span>
                <div className="p-2 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Đang hoạt động sôi nổi</span>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Đã Hoàn Thành</span>
                <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Đã bàn giao nghiệm thu</span>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Lập Kế Hoạch</span>
                <div className="p-2 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-purple-600 dark:text-purple-400">{stats.planning}</p>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Chuẩn bị nguồn lực ban đầu</span>
            </div>
          </section>

          {/* Filter & Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm dự án theo tên hoặc mô tả..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">Mọi trạng thái</option>
                <option value="PLANNING">Lập Kế Hoạch</option>
                <option value="IN_PROGRESS">Đang Triển Khai</option>
                <option value="COMPLETED">Đã Hoàn Thành</option>
                <option value="ARCHIVED">Lưu Trữ</option>
              </select>

              {/* Department Filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="text-xs bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[200px] truncate"
              >
                <option value="ALL">Mọi phòng ban</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* View Switcher: Grid vs List */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                <strong>{filteredProjects.length}</strong> dự án phù hợp
              </span>

              <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-xl transition cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                  }`}
                  title="Xem dạng thẻ lưới"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-xl transition cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                  }`}
                  title="Xem dạng danh sách"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Projects Display */}
          {isLoadingProjects ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800/60" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Không tìm thấy dự án</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Hãy thử điều chỉnh bộ lọc hoặc tạo dự án mới nếu bạn có quyền Quản lý.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => {
                const totalTasks = project.tasks?.length ?? project.taskCount?.total ?? 0;
                const completedTasks =
                  project.tasks?.filter((t) => t.status === 'DONE').length ??
                  project.taskCount?.completed ??
                  0;
                const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                const daysLeft = getRemainingDays(project.endDate);

                return (
                  <div
                    key={project.id}
                    className="group rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadgeStyles[project.status]}`}>
                          {statusLabels[project.status]}
                        </span>

                        {canManage && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(project)}
                              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                              title="Chỉnh sửa dự án"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setProjectToDelete(project)}
                              className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title="Xóa dự án"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Title & Department */}
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white line-clamp-1 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-3">
                        <Building className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{project.department?.name || 'Phòng ban chung'}</span>
                      </p>

                      {/* Description */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-5">
                        {project.description || 'Chưa có thông tin mô tả chi tiết cho dự án này.'}
                      </p>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                          <span className="text-slate-600 dark:text-slate-400">Tiến độ công việc</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">{progress}%</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Key Metrics Row */}
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs mb-4">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tasks</span>
                            <strong className="text-slate-800 dark:text-slate-200">{completedTasks}/{totalTasks}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Hạn Chót</span>
                            <strong className="text-slate-800 dark:text-slate-200 text-xs block truncate" title={project.endDate ? formatDateTime(project.endDate) : 'Không có hạn'}>
                              {project.endDate ? formatDateTime(project.endDate) : 'Không deadline'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {project.endDate && (
                        <div className="mb-4">
                          <CountdownBadge dueDate={project.endDate} isDone={project.status === 'COMPLETED'} />
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Members + Kanban Button */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                      {/* Members Avatar Row */}
                      <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                        {project.members?.slice(0, 4).map((m) => (
                          <div
                            key={m.id}
                            title={m.user?.name}
                            className="h-7 w-7 rounded-full border-2 border-white dark:border-slate-900 bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white flex items-center justify-center shrink-0 shadow-sm"
                          >
                            {m.user?.name ? m.user.name[0] : 'U'}
                          </div>
                        ))}
                        {(project.members?.length || 0) > 4 && (
                          <div className="h-7 w-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                            +{(project.members?.length || 0) - 4}
                          </div>
                        )}
                      </div>

                      {/* Kanban CTA */}
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${project.id}/kanban`)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 transition cursor-pointer"
                      >
                        <span>Vào Kanban</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW TABLE */
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 font-bold uppercase tracking-wider">
                      <th className="py-4 px-5">Tên Dự Án</th>
                      <th className="py-4 px-5">Phòng Ban</th>
                      <th className="py-4 px-5">Trạng Thái</th>
                      <th className="py-4 px-5">Tiến Độ</th>
                      <th className="py-4 px-5">Tasks</th>
                      <th className="py-4 px-5">Hạn Chót</th>
                      <th className="py-4 px-5 text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredProjects.map((project) => {
                      const totalTasks = project.tasks?.length ?? project.taskCount?.total ?? 0;
                      const completedTasks =
                        project.tasks?.filter((t) => t.status === 'DONE').length ??
                        project.taskCount?.completed ??
                        0;
                      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                      const daysLeft = getRemainingDays(project.endDate);

                      return (
                        <tr
                          key={project.id}
                          className="bg-white/40 transition hover:bg-slate-50/80 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
                        >
                          <td className="py-4 px-5">
                            <div className="font-extrabold text-slate-900 dark:text-white">{project.name}</div>
                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{project.description}</div>
                          </td>

                          <td className="py-4 px-5 text-slate-700 dark:text-slate-300">
                            {project.department?.name || 'Chung'}
                          </td>

                          <td className="py-4 px-5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadgeStyles[project.status]}`}>
                              {statusLabels[project.status]}
                            </span>
                          </td>

                          <td className="py-4 px-5 w-44">
                            <div className="flex items-center gap-2">
                              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div
                                  className="h-full bg-indigo-600 rounded-full"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">{progress}%</span>
                            </div>
                          </td>

                          <td className="py-4 px-5 font-bold text-slate-800 dark:text-slate-200">
                            {completedTasks}/{totalTasks}
                          </td>

                          <td className="py-4 px-5">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                {project.endDate ? formatDateTime(project.endDate) : '—'}
                              </span>
                              {project.endDate && (
                                <CountdownBadge dueDate={project.endDate} isDone={project.status === 'COMPLETED'} />
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/projects/${project.id}/kanban`)}
                                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 transition cursor-pointer"
                              >
                                Vào Kanban
                              </button>
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(project)}
                                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setProjectToDelete(project)}
                                    className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          NỘI DUNG TAB 2: CÔNG VIỆC CỦA TÔI (MY ASSIGNED TASKS - Phần 2)
          ======================================================== */}
      {activeTab === 'my-tasks' && (
        <div className="space-y-6">
          {/* Quick Metrics for My Tasks */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Tổng Việc Được Giao</span>
                <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ListTodo className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white">{myTasks.length}</p>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Tất cả dự án bạn tham gia</span>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Cần Thực Hiện</span>
                <div className="p-2 rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
                  <Target className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-slate-700 dark:text-slate-300">
                {myTasks.filter((t) => t.status === 'TODO').length}
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Đang chờ bạn bắt đầu</span>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Đang Tiến Hành</span>
                <div className="p-2 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {myTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length}
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">In Progress & Review</span>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Việc Quá Hạn</span>
                <div className="p-2 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                {myTasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < new Date()).length}
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Cần ưu tiên hoàn thành ngay</span>
            </div>
          </section>

          {/* Toolbar & Quick Filters (Tất cả, Hôm nay, Tuần này, Quá hạn) */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo tên task hoặc tên dự án..."
                  value={myTasksSearch}
                  onChange={(e) => setMyTasksSearch(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={myTasksStatusFilter}
                onChange={(e) => setMyTasksStatusFilter(e.target.value)}
                className="text-xs bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">Mọi trạng thái</option>
                <option value="TODO">Cần làm (To Do)</option>
                <option value="IN_PROGRESS">Đang làm (In Progress)</option>
                <option value="REVIEW">Chờ duyệt (Review)</option>
                <option value="DONE">Hoàn thành (Done)</option>
              </select>
            </div>

            {/* Quick Date Filter Pills: Tất cả, Hôm nay, Tuần này, Quá hạn */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMyTasksDateFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  myTasksDateFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Tất cả ({myTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setMyTasksDateFilter('TODAY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  myTasksDateFilter === 'TODAY'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => setMyTasksDateFilter('THIS_WEEK')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  myTasksDateFilter === 'THIS_WEEK'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Tuần này
              </button>
              <button
                type="button"
                onClick={() => setMyTasksDateFilter('OVERDUE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  myTasksDateFilter === 'OVERDUE'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-rose-500 hover:text-rose-600 dark:text-rose-400'
                }`}
              >
                Quá hạn
              </button>
            </div>
          </div>

          {/* Bảng Danh Sách Công Việc Của Tôi (Có inline status selector) */}
          {isLoadingMyTasks ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800/60" />
              ))}
            </div>
          ) : filteredMyTasks.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Không có công việc nào thỏa mãn bộ lọc
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Bạn đã xử lý hết các đầu việc hoặc hãy thử chọn bộ lọc khác.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 font-bold uppercase tracking-wider">
                      <th className="py-4 px-5">Tên Công Việc</th>
                      <th className="py-4 px-5">Dự Án</th>
                      <th className="py-4 px-5">Mức Độ Ưu Tiên</th>
                      <th className="py-4 px-5">Hạn Chót (Deadline)</th>
                      <th className="py-4 px-5">Trạng Thái (Cập nhật nhanh)</th>
                      <th className="py-4 px-5 text-right">Điều Hướng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredMyTasks.map((task) => {
                      const isOverdue = task.status !== 'DONE' && task.dueDate && new Date(task.dueDate) < new Date();
                      const priorityInfo = taskPriorityBadge[task.priority as TaskPriority] || {
                        label: task.priority,
                        style: 'bg-slate-100 text-slate-700',
                      };

                      return (
                        <tr
                          key={task.id}
                          className="bg-white/40 transition hover:bg-slate-50/80 dark:bg-slate-900/40 dark:hover:bg-slate-800/60 group"
                        >
                          {/* Task Name */}
                          <td className="py-4 px-5">
                            <button
                              type="button"
                              onClick={() => setSelectedTaskId(task.id)}
                              className="font-extrabold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left block cursor-pointer"
                            >
                              {task.title}
                            </button>
                            {task.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </td>

                          {/* Project Name */}
                          <td className="py-4 px-5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {task.project?.name || 'Dự án'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Mã: {task.projectId}
                            </span>
                          </td>

                          {/* Priority */}
                          <td className="py-4 px-5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${priorityInfo.style}`}>
                              {priorityInfo.label}
                            </span>
                          </td>

                          {/* Deadline */}
                          <td className="py-4 px-5">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`} />
                                <span className={`font-semibold text-xs ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {formatDateTime(task.dueDate)}
                                </span>
                              </div>
                              {task.dueDate && (
                                <CountdownBadge dueDate={task.dueDate} isDone={task.status === 'DONE'} />
                              )}
                            </div>
                          </td>

                          {/* Quick Status Selector */}
                          <td className="py-4 px-5">
                            <select
                              value={task.status}
                              onChange={(e) => handleQuickUpdateStatus(task.id, e.target.value as TaskStatus)}
                              className={`text-xs rounded-xl px-2.5 py-1.5 font-bold border transition cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 ${
                                task.status === 'DONE'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                  : task.status === 'REVIEW'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <option value="TODO">Cần làm (To Do)</option>
                              <option value="IN_PROGRESS">Đang làm (In Progress)</option>
                              <option value="REVIEW">Chờ duyệt (Review)</option>
                              <option value="DONE">Hoàn thành (Done)</option>
                            </select>
                          </td>

                          {/* Actions: Jump to Project Kanban with Highlight */}
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/projects/${task.projectId}/kanban?highlightTaskId=${task.id}`)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 transition cursor-pointer shadow-sm"
                                title="Mở bảng Kanban và cuộn tới thẻ công việc này"
                              >
                                <span>Mở Kanban</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL CHI TIẾT TASK (Xem subtasks, comments, attachments) */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          canEditSubtasks={true}
          canAssignTask={canManage}
          usersList={formattedUsersList}
          onTaskUpdated={() => {
            void refetchMyTasks();
          }}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* MODAL: CREATE / EDIT PROJECT */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-indigo-500" />
                  {editingProject ? 'Chỉnh Sửa Dự Án' : 'Khởi Tạo Dự Án Mới'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSavingProject}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên dự án *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Nâng Cấp Hệ Thống AI Enterprise"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mô tả mục tiêu dự án
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Nhập phạm vi, yêu cầu và đầu ra kỳ vọng..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Phòng ban phụ trách
                    </label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer truncate"
                    >
                      <option value="">Chung (Toàn công ty)</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Trạng thái triển khai
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="PLANNING">Lập Kế Hoạch</option>
                      <option value="IN_PROGRESS">Đang Triển Khai</option>
                      <option value="COMPLETED">Đã Hoàn Thành</option>
                      <option value="ARCHIVED">Lưu Trữ</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ngày bắt đầu
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Hạn chót (Deadline)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Manager in Charge Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chọn Manager phụ trách dự án
                  </label>
                  <select
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Mặc định (Người tạo dự án phụ trách) --</option>
                    {departmentUsers
                      .filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role === 'ADMIN' ? 'Quản trị viên' : 'Quản lý'})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Team Members Assignment */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Chỉ định thành viên tham gia ({memberIds.length} đã chọn)
                    </label>
                    <input
                      type="text"
                      placeholder="Lọc nhân sự..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="text-[11px] px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 w-36"
                    />
                  </div>

                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2">
                    {departmentUsers
                      .filter((u) => !memberSearch.trim() || u.name.toLowerCase().includes(memberSearch.toLowerCase()))
                      .map((person) => (
                        <label
                          key={person.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={memberIds.includes(person.id)}
                            onChange={(e) => {
                              setMemberIds((current) =>
                                e.target.checked
                                  ? [...current, person.id]
                                  : current.filter((id) => id !== person.id)
                              );
                            }}
                            className="h-4 w-4 rounded border-slate-400 bg-white text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex-1 truncate">
                            <span className="font-bold text-slate-900 dark:text-white">{person.name}</span>
                            <span className="text-[11px] text-slate-400 ml-1.5">({person.email})</span>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                            {person.role}
                          </span>
                        </label>
                      ))}
                    {departmentUsers.length === 0 && (
                      <p className="text-xs text-slate-400 p-2 text-center">Không có nhân sự khả dụng.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSavingProject}
                    className="px-4 py-2 text-xs font-semibold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProject}
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-md shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProject ? 'Đang lưu...' : editingProject ? 'Lưu Thay Đổi' : 'Tạo Dự Án'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: DELETE CONFIRMATION */}
      <AnimatePresence>
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-900 dark:text-white"
            >
              <div className="flex items-center gap-3 text-rose-500 mb-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Xác Nhận Xóa Dự Án
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                Bạn có chắc chắn muốn xóa dự án{' '}
                <strong className="text-rose-500">{projectToDelete.name}</strong>?
                Toàn bộ dữ liệu công việc và tài liệu liên quan sẽ bị xóa vĩnh viễn khỏi hệ thống.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProjectToDelete(null)}
                  disabled={isDeletingProject}
                  className="px-4 py-2 text-xs font-semibold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={isDeletingProject}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-2xl shadow-md shadow-rose-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isDeletingProject ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CÂN BẰNG TẢI NHÂN SỰ & WORKLOAD HEATMAP */}
      <WorkloadHeatmapModal
        isOpen={isWorkloadModalOpen}
        onClose={() => setIsWorkloadModalOpen(false)}
        tasks={myTasks}
        users={departmentUsers}
        onRebalanceSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['my-assigned-tasks'] });
          refetchMyTasks();
        }}
      />
    </div>
  );
};

export default ProjectsPage;

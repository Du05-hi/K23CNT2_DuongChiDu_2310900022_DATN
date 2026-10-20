import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Department, Project, ProjectStatus, User } from '../types';
import { apiClient } from '../api/apiClient';
import { useAuth } from '@/hooks/useAuth';

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

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Fetch Projects
  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await apiClient.get<Project[]>('/projects');
      return Array.isArray(response.data) ? response.data : [];
    },
  });

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
    enabled: isModalOpen,
  });

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

  // Project Stats Breakdown
  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const planning = projects.filter((p) => p.status === 'PLANNING').length;
    return { total, inProgress, completed, planning };
  }, [projects]);

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      description: '',
      status: 'PLANNING',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      departmentId: user?.role === 'MANAGER' ? user.departmentId || '' : '',
    });
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
      startDate: project.startDate ? project.startDate.split('T')[0] : '',
      endDate: project.endDate ? project.endDate.split('T')[0] : '',
      departmentId: project.departmentId || '',
    });
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
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        departmentId: formData.departmentId || null,
        memberIds,
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
      setEditingProject(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể lưu dự án.');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete || isDeletingProject) return;
    setIsDeletingProject(true);
    try {
      await apiClient.delete(`/projects/${projectToDelete.id}`);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Đã xóa dự án "${projectToDelete.name}".`);
      setProjectToDelete(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể xóa dự án.');
    } finally {
      setIsDeletingProject(false);
    }
  };

  // Helper for Days Remaining
  const getRemainingDays = (endDate?: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 transition-colors duration-200 dark:bg-slate-950 sm:p-6 lg:p-8 space-y-8">
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
            Danh Mục Dự Án & Kế Hoạch Triển Khai
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi tiến độ, phân bổ nguồn lực đội ngũ và quản trị các bảng Kanban công việc.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 rounded-2xl shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-purple-500 active:scale-95 cursor-pointer self-start md:self-center"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Dự Án Mới</span>
          </button>
        )}
      </header>

      {/* Metric Quick Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium">Tổng Số Dự Án</span>
            <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FolderOpen className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white">{stats.total}</p>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Tất cả dự án được ghi nhận</span>
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
      {isLoading ? (
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
            Hãy thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.
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
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Thời Hạn</span>
                        <strong className={daysLeft !== null && daysLeft < 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'}>
                          {daysLeft === null
                            ? 'Không deadline'
                            : daysLeft < 0
                            ? `Quá hạn ${Math.abs(daysLeft)} ngày`
                            : daysLeft === 0
                            ? 'Hôm nay'
                            : `Còn ${daysLeft} ngày`}
                        </strong>
                      </div>
                    </div>
                  </div>
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
                        <span className={daysLeft !== null && daysLeft < 0 ? 'text-rose-500 font-bold' : 'text-slate-600 dark:text-slate-400'}>
                          {daysLeft === null
                            ? '—'
                            : daysLeft < 0
                            ? `Quá hạn ${Math.abs(daysLeft)}d`
                            : `${daysLeft} ngày`}
                        </span>
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
                      type="date"
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
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
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
    </div>
  );
};

export default ProjectsPage;

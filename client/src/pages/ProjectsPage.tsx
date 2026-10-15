import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  MoreVertical,
  Edit2,
  Trash2,
  ArrowRight,
  Sparkles,
  X,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Department, Project, ProjectStatus, User } from '../types';
import { apiClient } from '../api/apiClient';
import { useAuth } from '@/hooks/useAuth';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await apiClient.get<Project[]>('/projects');
      return Array.isArray(response.data) ? response.data : [];
    },
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await apiClient.get<Department[]>('/users/departments');
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: user?.role === 'ADMIN' || user?.role === 'MANAGER',
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

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
  const { data: departmentUsers = [], isLoading: isLoadingDepartmentUsers } = useQuery({
    queryKey: ['project-department-users', formData.departmentId],
    queryFn: async () => {
      if (user?.role === 'MANAGER' && !formData.departmentId) return [];
      const users: User[] = [];
      let page = 1;
      let pageUsers: User[];
      do {
        const response = await apiClient.get<User[]>('/users', {
          params: {
            limit: 1000,
            page,
            isActive: true,
            ...(formData.departmentId ? { departmentId: formData.departmentId } : {}),
          },
        });
        pageUsers = Array.isArray(response.data) ? response.data : [];
        users.push(...pageUsers);
        page += 1;
      } while (pageUsers.length === 1000);
      return users.filter((person) => person.role === 'MANAGER' || person.role === 'EMPLOYEE');
    },
    enabled: isModalOpen && (
      user?.role === 'ADMIN' ||
      (user?.role === 'MANAGER' && Boolean(formData.departmentId))
    ),
  });
  const availableDepartments = user?.role === 'MANAGER'
    ? departments.filter((department) => department.id === user.departmentId)
    : departments;

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
      startDate: project.startDate?.split('T')[0] || '',
      endDate: project.endDate?.split('T')[0] || '',
      departmentId: project.departmentId || '',
    });
    setMemberIds([]);
    setMemberSearch('');
    setIsModalOpen(true);
  };

  const filteredDepartmentUsers = departmentUsers.filter((person) => {
    const search = memberSearch.trim().toLocaleLowerCase();
    return !search ||
      person.name.toLocaleLowerCase().includes(search) ||
      person.email.toLocaleLowerCase().includes(search);
  });

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const projectData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
      };
      if (editingProject) {
        await apiClient.put(`/projects/${editingProject.id}`, projectData);
        toast.success('Đã cập nhật thông tin dự án.');
      } else {
        await apiClient.post('/projects', {
          ...projectData,
          departmentId: formData.departmentId || null,
          memberIds,
        });
        toast.success('Đã tạo dự án.');
      }
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      setMemberIds([]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể lưu dự án.');
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

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'PLANNING':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'IN_PROGRESS':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'COMPLETED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'ARCHIVED':
        return 'bg-slate-700 text-slate-300 border-slate-600';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getStatusText = (status: ProjectStatus) => {
    switch (status) {
      case 'PLANNING':
        return 'Kế hoạch';
      case 'IN_PROGRESS':
        return 'Đang triển khai';
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'ARCHIVED':
        return 'Lưu trữ';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 inline-flex items-center gap-1">
              <FolderKanban className="w-3.5 h-3.5" />
              Tổng Quan Dự Án
            </span>
            <span className="text-xs text-slate-400">
              {projects.length} dự án đang được quản lý
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Quản Lý Danh Mục Dự Án
          </h1>
        </div>

        {/* Action Button */}
        {user?.role !== 'EMPLOYEE' && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Dự Án Mới</span>
          </button>
        )}
      </div>

      {/* Filter and View Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên dự án..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PLANNING">Kế hoạch (Planning)</option>
            <option value="IN_PROGRESS">Đang thực hiện (In Progress)</option>
            <option value="COMPLETED">Hoàn thành (Completed)</option>
            <option value="ARCHIVED">Lưu trữ (Archived)</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 self-end sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Dạng lưới"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Dạng danh sách"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Projects Display */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-slate-400">Đang tải dự án...</div>
      ) : isError ? (
        <div role="alert" className="rounded-2xl border border-rose-800 bg-rose-950/40 p-6 text-sm text-rose-300">
          Không thể tải danh sách dự án. Vui lòng thử lại.
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center">
          <FolderOpen className="w-16 h-16 text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-300">
            Không tìm thấy dự án nào phù hợp
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Thử thay đổi bộ lọc tìm kiếm hoặc bắt đầu bằng việc khởi tạo một dự án mới.
          </p>
          {user?.role !== 'EMPLOYEE' && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl"
            >
              + Tạo Dự Án Mới Ngay
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project, idx) => {
            const totalTasks = project.taskCount?.total || 1;
            const completedTasks = project.taskCount?.completed || 0;
            const progress = Math.round((completedTasks / totalTasks) * 100);

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 shadow-xl backdrop-blur-xl flex flex-col justify-between transition-all"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                        project.status
                      )}`}
                    >
                      {getStatusText(project.status)}
                    </span>

                    <div className="flex items-center gap-1">
                      {user?.role !== 'EMPLOYEE' && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(project)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Chỉnh sửa dự án"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setProjectToDelete(project)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors"
                            title="Xóa dự án"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1 mb-2">
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {project.description || 'Chưa có mô tả cho dự án này.'}
                  </p>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 mb-5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        {completedTasks}/{totalTasks} Tasks hoàn thành
                      </span>
                      <span className="font-bold text-indigo-400">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-slate-800/80 space-y-4">
                  {/* Dates & Members */}
                  <div className="flex items-center justify-between text-xs">
                    {/* Overlapping Avatars */}
                    <div className="flex items-center -space-x-2">
                      {project.members && project.members.length > 0 ? (
                        project.members.map((m, mIdx) => (
                          <img
                            key={m.id || mIdx}
                            src={m.user?.avatar || 'https://via.placeholder.com/100'}
                            alt={m.user?.name}
                            title={m.user?.name}
                            className="w-7 h-7 rounded-full object-cover border-2 border-slate-900"
                          />
                        ))
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                          1
                        </div>
                      )}
                    </div>

                    {/* Deadline */}
                    {project.endDate && (
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Hạn: {project.endDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Open Kanban Button */}
                  <button
                    onClick={() => navigate(`/projects/${project.id}/kanban`)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Xem Bảng Kanban</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden backdrop-blur-xl shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Tên Dự Án</th>
                <th className="py-3.5 px-4">Trạng Thái</th>
                <th className="py-3.5 px-4">Tiến Độ</th>
                <th className="py-3.5 px-4">Thành Viên</th>
                <th className="py-3.5 px-4">Hạn Chót</th>
                <th className="py-3.5 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProjects.map((project) => {
                const totalTasks = project.taskCount?.total || 1;
                const completedTasks = project.taskCount?.completed || 0;
                const progress = Math.round((completedTasks / totalTasks) * 100);

                return (
                  <tr
                    key={project.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div>{project.name}</div>
                      <div className="text-[11px] text-slate-400 font-normal line-clamp-1 max-w-sm">
                        {project.description}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadge(
                          project.status
                        )}`}
                      >
                        {getStatusText(project.status)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-indigo-400">
                          {progress}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center -space-x-1.5">
                        {project.members?.map((m, mIdx) => (
                          <img
                            key={m.id || mIdx}
                            src={m.user?.avatar || 'https://via.placeholder.com/100'}
                            alt={m.user?.name}
                            className="w-6 h-6 rounded-full object-cover border border-slate-900"
                          />
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {project.endDate || 'Chưa đặt'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/kanban?projectId=${project.id}`)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors"
                        >
                          Kanban
                        </button>
                        {user?.role !== 'EMPLOYEE' && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(project)}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Chỉnh sửa dự án"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setProjectToDelete(project)}
                              className="p-1 text-rose-400 hover:text-rose-300"
                              title="Xóa dự án"
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
      )}

      {/* Create / Edit Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-white"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-indigo-400" />
                  {editingProject ? 'Chỉnh Sửa Dự Án' : 'Tạo Dự Án Mới'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tên dự án *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Cổng Tri Thức & Hệ Thống Đánh Giá KPI AI"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mô tả dự án
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Mô tả mục tiêu, phạm vi và công nghệ chính..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {!editingProject && (user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Phòng ban
                    </label>
                    <select
                      value={formData.departmentId}
                      onChange={(event) => {
                        setFormData({ ...formData, departmentId: event.target.value });
                        setMemberIds([]);
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {user?.role === 'ADMIN' && (
                        <option value="">Tất cả phòng ban / Không gán phòng ban</option>
                      )}
                      {availableDepartments.map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                    {user.role === 'MANAGER' && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Quản lý chỉ có thể tạo dự án trong phòng ban của mình.
                      </p>
                    )}
                  </div>
                )}

                {!editingProject && (user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-medium text-slate-300">
                      Thành viên tham gia dự án
                    </legend>
                    <input
                      type="search"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Tìm theo tên hoặc email..."
                      aria-label="Tìm thành viên theo tên hoặc email"
                      className="mb-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/70 p-2">
                      {isLoadingDepartmentUsers ? (
                        <p className="p-3 text-sm text-slate-400">Đang tải nhân sự...</p>
                      ) : filteredDepartmentUsers.map((person) => {
                        const isCurrentUser = person.id === user?.id;
                        const isSelected = isCurrentUser || memberIds.includes(person.id);
                        return (
                        <label
                          key={person.id}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 ${isCurrentUser ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-slate-700/70'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isCurrentUser}
                            onChange={(event) => {
                              setMemberIds((current) => event.target.checked
                                ? [...current, person.id]
                                : current.filter((memberId) => memberId !== person.id));
                            }}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-white">{person.name}</span>
                            <span className="block truncate text-xs text-slate-400">{person.email}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {isCurrentUser
                              ? 'Người tạo · tự động tham gia'
                              : person.role === 'MANAGER' ? 'Quản lý' : 'Nhân viên'}
                          </span>
                        </label>
                        );
                      })}
                      {!isLoadingDepartmentUsers && filteredDepartmentUsers.length === 0 && (
                        <p className="p-3 text-sm text-slate-400">
                          {memberSearch
                            ? 'Không tìm thấy nhân sự phù hợp.'
                            : formData.departmentId
                              ? 'Phòng ban chưa có nhân sự.'
                              : user?.role === 'ADMIN'
                                ? 'Chưa có Quản lý hoặc Nhân viên đang hoạt động.'
                                : 'Chọn phòng ban của bạn để tải danh sách nhân sự.'}
                        </p>
                      )}
                    </div>
                  </fieldset>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Trạng thái
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as ProjectStatus,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="PLANNING">Kế hoạch</option>
                      <option value="IN_PROGRESS">Đang triển khai</option>
                      <option value="COMPLETED">Hoàn thành</option>
                      <option value="ARCHIVED">Lưu trữ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Ngày bắt đầu
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Hạn chót
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30"
                  >
                    {editingProject ? 'Lưu Thay Đổi' : 'Tạo Dự Án'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Dialog */}
      <AnimatePresence>
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-white"
            >
              <div className="flex items-center gap-3 text-rose-400 mb-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-white">Xác Nhận Xóa Dự Án</h3>
              </div>
              <p className="text-xs text-slate-300 mb-5 leading-relaxed">
                Bạn có chắc chắn muốn xóa vĩnh viễn dự án{' '}
                <strong className="text-white">"{projectToDelete.name}"</strong>? Toàn bộ
                các tasks, bình luận và dữ liệu liên quan sẽ bị xóa vĩnh viễn và không thể khôi phục.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setProjectToDelete(null)}
                  disabled={isDeletingProject}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl bg-slate-800"
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={isDeletingProject}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-600/30 disabled:cursor-wait disabled:opacity-60"
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

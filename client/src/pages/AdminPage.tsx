import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Building,
  BarChart3,
  Search,
  Plus,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Edit,
  Trash2,
  AlertTriangle,
  FolderKanban,
  CheckSquare,
  TrendingUp,
  X,
  Mail,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { User, Role, Department } from '../types';
import { apiClient } from '../api/apiClient';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'stats'>('users');

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [userToToggle, setUserToToggle] = useState<User | null>(null);

  // Pagination for Users
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 4;

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [usersResponse, departmentsResponse, statsResponse] = await Promise.all([
        apiClient.get<User[]>('/users', { params: { limit: 1000 } }),
        apiClient.get<Array<Department & { _count: { users: number; projects: number } }>>('/users/departments'),
        apiClient.get<NonNullable<typeof dashboardStats>>('/users/dashboard-stats'),
        ]);
        if (!active) return;
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
        setDepartments(
        (Array.isArray(departmentsResponse.data) ? departmentsResponse.data : []).map((department) => ({
            ...department,
            userCount: department._count.users,
            projectCount: department._count.projects,
          }))
        );
      setDashboardStats(statsResponse.data);
      } catch (error) {
        console.error('Không thể tải dữ liệu quản trị:', error);
        if (active) toast.error('Không thể tải dữ liệu quản trị từ máy chủ.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadData();
    return () => {
      active = false;
    };
  }, []);

  const roleDistributionData = [
    { name: 'Admin', value: users.filter((u) => u.role === 'ADMIN').length, color: '#ef4444' },
    { name: 'Manager', value: users.filter((u) => u.role === 'MANAGER').length, color: '#3b82f6' },
    { name: 'Employee', value: users.filter((u) => u.role === 'EMPLOYEE').length, color: '#10b981' },
  ];

  // Department State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dashboardStats, setDashboardStats] = useState<{
    users: { total: number; active: number; inactive: number };
    departments: { total: number };
    projects: { total: number };
    tasks: { total: number; DONE: number; TODO: number; IN_PROGRESS: number; REVIEW: number; completionRate: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentUserIds, setDepartmentUserIds] = useState<string[]>([]);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');

  const taskStatusData = [
    { status: 'Cần làm', count: dashboardStats?.tasks.TODO ?? 0, fill: '#64748b' },
    { status: 'Đang làm', count: dashboardStats?.tasks.IN_PROGRESS ?? 0, fill: '#3b82f6' },
    { status: 'Đánh giá', count: dashboardStats?.tasks.REVIEW ?? 0, fill: '#f59e0b' },
    { status: 'Hoàn thành', count: dashboardStats?.tasks.DONE ?? 0, fill: '#10b981' },
  ];

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase());
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, userSearch, roleFilter, statusFilter]);

  // Paginated users
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;
  const currentUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  // Role change handler
  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      const response = await apiClient.put<User>(`/users/${userId}/role`, { role: newRole });
      setUsers((current) => current.map((u) => (u.id === userId ? { ...u, ...response.data } : u)));
      toast.success('Đã cập nhật vai trò thành công.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật vai trò.');
    }
  };

  // Toggle user active status
  const handleConfirmToggleActive = async () => {
    if (!userToToggle) return;

    const newStatus = !userToToggle.isActive;
    setUserToToggle(null);

    try {
      const response = await apiClient.put<{ isActive: boolean }>(`/users/${userToToggle.id}/status`);
      setUsers((current) =>
        current.map((u) => (u.id === userToToggle.id ? { ...u, isActive: response.data.isActive } : u))
      );
      toast.success(`Đã ${newStatus ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản ${userToToggle.name}.`);
      setDashboardStats((current) => current ? {
        ...current,
        users: {
          ...current.users,
          active: current.users.active + (newStatus ? 1 : -1),
          inactive: current.users.inactive + (newStatus ? -1 : 1),
        },
      } : current);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể thay đổi trạng thái tài khoản.');
    }
  };

  const openCreateDepartment = () => {
    setEditingDepartment(null);
    setDepartmentUserIds([]);
    setNewDeptName('');
    setNewDeptDesc('');
    setIsDeptModalOpen(true);
  };

  const openEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentUserIds(users
      .filter((user) => user.departmentId === department.id && user.role !== 'ADMIN')
      .map((user) => user.id));
    setNewDeptName(department.name);
    setNewDeptDesc(department.description || '');
    setIsDeptModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setIsSavingDepartment(true);
    try {
      if (editingDepartment) {
        const currentDepartment = editingDepartment;
        const updateResponse = await apiClient.put<Department>(`/users/departments/${currentDepartment.id}`, {
          name: newDeptName.trim(),
          description: newDeptDesc.trim(),
          userIds: departmentUserIds,
        });
        const response = await apiClient.get<Array<Department & { _count: { users: number; projects: number } }>>(
          '/users/departments'
        );
        setDepartments((Array.isArray(response.data) ? response.data : []).map((department) => ({
          ...department,
          userCount: department._count.users,
          projectCount: department._count.projects,
        })));
        const selectedIds = new Set(departmentUserIds);
        const updatedDepartment = updateResponse.data;
        setUsers((current) => current.map((user) => {
          if (user.role === 'ADMIN') return user;
          if (selectedIds.has(user.id)) {
            return {
              ...user,
              departmentId: currentDepartment.id,
              department: updatedDepartment,
            };
          }
          if (user.departmentId === currentDepartment.id) {
            return { ...user, departmentId: null, department: null };
          }
          return user;
        }));
        toast.success(`Đã cập nhật phòng ban "${newDeptName.trim()}".`);
      } else {
        const response = await apiClient.post<Department>('/users/departments', {
          name: newDeptName.trim(),
          description: newDeptDesc.trim(),
        });
        const newDepartment = { ...response.data, userCount: 0, projectCount: 0 };
        setDepartments((current) => [...current, newDepartment]);
        setDashboardStats((current) => current ? {
          ...current,
          departments: { total: current.departments.total + 1 },
        } : current);
        toast.success(`Đã tạo phòng ban "${newDepartment.name}" thành công.`);
      }
      setIsDeptModalOpen(false);
      setEditingDepartment(null);
      setDepartmentUserIds([]);
      setNewDeptName('');
      setNewDeptDesc('');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể lưu phòng ban.');
    } finally {
      setIsSavingDepartment(false);
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'MANAGER':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'EMPLOYEE':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
              Quyền Quản Trị Hệ Thống
            </span>
            <span className="text-xs text-slate-400">Admin Control Center</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Quản Trị Hệ Thống Toàn Diện
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Quản lý tài khoản người dùng, phân quyền phòng ban và giám sát chỉ số tổng thể toàn hệ thống.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Đang tải dữ liệu thật từ hệ thống...</p>}

      {/* Main Tabs Navigation */}
      <div className="flex p-1 rounded-2xl bg-slate-900 border border-slate-800 max-w-lg">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Người Dùng ({dashboardStats?.users.total ?? users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'departments'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Phòng Ban ({departments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Thống Kê Hệ Thống</span>
        </button>
      </div>

      {/* Tabs Content */}
      <AnimatePresence mode="wait">
        {/* ============================================================== */}
        {/* TAB 1: USERS MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === 'users' && (
          <motion.div
            key="tab-users"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc email..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">Mọi vai trò</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">Mọi trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Đã khóa</option>
                </select>
              </div>

              <div className="text-xs text-slate-400">
                Hiển thị <strong>{filteredUsers.length}</strong> người dùng
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden backdrop-blur-xl shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                      <th className="py-3.5 px-4">Thành Viên</th>
                      <th className="py-3.5 px-4">Phòng Ban</th>
                      <th className="py-3.5 px-4">Vai Trò (Role)</th>
                      <th className="py-3.5 px-4 text-center">Trạng Thái</th>
                      <th className="py-3.5 px-4 text-right">Khóa / Mở Khóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {currentUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={u.avatar || 'https://via.placeholder.com/100'}
                              alt={u.name}
                              className="w-9 h-9 rounded-full object-cover border border-white/20"
                            />
                            <div>
                              <div className="font-semibold text-white">{u.name}</div>
                              <div className="text-slate-400 text-[11px] flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-500" />
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-300">
                          {u.department?.name || 'Chưa phân bổ'}
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border bg-slate-800 focus:outline-none cursor-pointer ${getRoleBadge(
                              u.role
                            )}`}
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="MANAGER">MANAGER</option>
                            <option value="EMPLOYEE">EMPLOYEE</option>
                          </select>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium">
                              <XCircle className="w-3 h-3" />
                              Đã khóa
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setUserToToggle(u)}
                            className={`px-3 py-1.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                              u.isActive
                                ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                            }`}
                          >
                            {u.isActive ? 'Khóa Tài Khoản' : 'Kích Hoạt Lại'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Trang {currentPage} trên tổng số {totalPages}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="p-1.5 rounded-lg bg-slate-800 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="p-1.5 rounded-lg bg-slate-800 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: DEPARTMENTS MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === 'departments' && (
          <motion.div
            key="tab-departments"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-400" />
                  Danh Sách Phòng Ban Doanh Nghiệp
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Phân chia cơ cấu tổ chức và các đội nhóm chuyên trách
                </p>
              </div>

              <button
                onClick={openCreateDepartment}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Phòng Ban Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl shadow-lg flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                        <Building className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {dept.userCount} nhân sự
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white mb-2">{dept.name}</h4>
                    <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                      {dept.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>{dept.projectCount ?? 0} dự án</span>
                    <button
                      onClick={() => openEditDepartment(dept)}
                      className="text-indigo-400 hover:underline cursor-pointer"
                    >
                      Cài đặt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: SYSTEM STATISTICS */}
        {/* ============================================================== */}
        {activeTab === 'stats' && (
          <motion.div
            key="tab-stats"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium uppercase">Tổng Users</span>
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{dashboardStats?.users.total ?? 0} tài khoản</div>
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>
                    {dashboardStats?.users.total
                      ? Math.round((dashboardStats.users.active / dashboardStats.users.total) * 100)
                      : 0}% đang hoạt động
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium uppercase">Tổng Dự Án</span>
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                    <FolderKanban className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-300 mb-1">{dashboardStats?.projects.total ?? 0} Dự án</div>
                <div className="text-xs text-slate-400">{dashboardStats?.departments.total ?? 0} phòng ban</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium uppercase">Tổng Số Tasks</span>
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-amber-300 mb-1">{dashboardStats?.tasks.total ?? 0} Tasks</div>
                <div className="text-xs text-slate-400">Phân bố trên 4 cột Kanban</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium uppercase">Tasks Hoàn Thành</span>
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-400 mb-1">
                  {dashboardStats?.tasks.DONE ?? 0} Tasks ({dashboardStats?.tasks.completionRate ?? 0}%)
                </div>
                <div className="text-xs text-emerald-400">Tỷ lệ hoàn thành trong hệ thống</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Donut Chart: Roles */}
              <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white mb-1">
                    Phân Bố Vai Trò Người Dùng (Role)
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Tỷ lệ giữa Quản trị viên, Quản lý và Nhân viên
                  </p>
                </div>

                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {roleDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart: Tasks by Status */}
              <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white mb-1">
                    Thống Kê Trạng Thái Tasks Hệ Thống
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Số lượng công việc tại từng cột trạng thái Kanban
                  </p>
                </div>

                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={taskStatusData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="status" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" name="Số lượng tasks" radius={[6, 6, 0, 0]}>
                        {taskStatusData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Status Confirmation Dialog */}
      <AnimatePresence>
        {userToToggle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-white"
            >
              <div className="flex items-center gap-3 text-amber-400 mb-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-white">Xác Nhận Thay Đổi Trạng Thái</h3>
              </div>
              <p className="text-xs text-slate-300 mb-5 leading-relaxed">
                Bạn có chắc chắn muốn{' '}
                <strong className={userToToggle.isActive ? 'text-rose-400' : 'text-emerald-400'}>
                  {userToToggle.isActive ? 'KHÓA' : 'MỞ KHÓA'}
                </strong>{' '}
                tài khoản của nhân sự <strong className="text-white">{userToToggle.name}</strong> ({userToToggle.email})?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setUserToToggle(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl bg-slate-800"
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleConfirmToggleActive}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-md transition-colors ${
                    userToToggle.isActive
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  }`}
                >
                  Xác Nhận {userToToggle.isActive ? 'Khóa' : 'Kích Hoạt'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create / Edit Department Modal */}
      <AnimatePresence>
        {isDeptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-white"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-400" />
                  {editingDepartment ? 'Chỉnh Sửa Phòng Ban' : 'Tạo Phòng Ban Mới'}
                </h3>
                <button
                  onClick={() => setIsDeptModalOpen(false)}
                  disabled={isSavingDepartment}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDepartment} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tên phòng ban *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="VD: Phòng Trí Tuệ Nhân Tạo & Dữ Liệu Lớn"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mô tả chức năng & nhiệm vụ
                  </label>
                  <textarea
                    rows={3}
                    value={newDeptDesc}
                    onChange={(e) => setNewDeptDesc(e.target.value)}
                    placeholder="Nhập vai trò và phạm vi hoạt động của phòng ban..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {editingDepartment && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-medium text-slate-300">
                      Quản lý và nhân sự trong phòng ban
                    </legend>
                    <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/70 p-2">
                      {users.filter((person) => person.role !== 'ADMIN').map((person) => (
                        <label
                          key={person.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-700/70"
                        >
                          <input
                            type="checkbox"
                            checked={departmentUserIds.includes(person.id)}
                            onChange={(event) => {
                              setDepartmentUserIds((current) => event.target.checked
                                ? [...current, person.id]
                                : current.filter((userId) => userId !== person.id));
                            }}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-white">{person.name}</span>
                            <span className="block truncate text-xs text-slate-400">{person.email}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {person.role === 'MANAGER' ? 'Quản lý' : 'Nhân viên'}
                          </span>
                        </label>
                      ))}
                      {!users.some((person) => person.role !== 'ADMIN') && (
                        <p className="p-3 text-sm text-slate-400">Chưa có Quản lý hoặc Nhân viên.</p>
                      )}
                    </div>
                  </fieldset>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDeptModalOpen(false)}
                    disabled={isSavingDepartment}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDepartment}
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30"
                  >
                    {isSavingDepartment
                      ? 'Đang lưu...'
                      : editingDepartment ? 'Lưu Thay Đổi' : 'Tạo Phòng Ban'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPage;

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Building,
  BarChart3,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  AlertTriangle,
  FolderKanban,
  TrendingUp,
  X,
  Mail,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Activity,
  Server,
  Database,
  Key,
  RefreshCw,
  Copy,
  Check,
  Layers,
  Network,
  Cpu,
  Clock,
  UserCheck,
  UserPlus,
  ArrowUpRight,
  Filter,
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
import { User, Role, Department, Project, ActivityLog } from '../types';
import { apiClient } from '../api/apiClient';

interface DashboardStatsData {
  users: { total: number; active: number; inactive: number };
  departments: { total: number };
  projects: { total: number; PLANNING: number; IN_PROGRESS: number; COMPLETED: number; ARCHIVED: number };
  tasks: { total: number; DONE: number; TODO: number; IN_PROGRESS: number; REVIEW: number; completionRate: number };
}

interface SystemHealthData {
  status: string;
  database: {
    status: string;
    engine: string;
    latencyMs: number;
    health: string;
  };
  server: {
    nodeVersion: string;
    platform: string;
    uptimeSeconds: number;
    uptimeFormatted: string;
    memory: {
      heapUsedMB: number;
      heapTotalMB: number;
      rssMB: number;
    };
  };
  realtime: {
    status: string;
    connectedClients: number;
  };
  records: {
    users: number;
    activeUsers: number;
    departments: number;
    projects: number;
    tasks: number;
  };
  timestamp: string;
}

const roleBadgeStyles: Record<Role, string> = {
  ADMIN: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30',
  MANAGER: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30',
  EMPLOYEE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30',
};

const actionBadgeStyles: Record<string, string> = {
  USER_CREATED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  USER_ACTIVATED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  USER_SUSPENDED: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
  USER_ROLE_CHANGED: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  USER_DEPARTMENT_CHANGED: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
  USER_PASSWORD_RESET: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
  DEPARTMENT_CREATED: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  DEPARTMENT_UPDATED: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
  DEPARTMENT_DELETED: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
  PROJECT_CREATED: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/30',
};

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'stats'>('users');
  const [deptViewMode, setDeptViewMode] = useState<'grid' | 'organogram'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Core Data
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsData | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);

  // Users Filters & Pagination
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [userPage, setUserPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(5);

  // Audit Logs Filters & Pagination
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const auditPerPage = 8;

  // Modals
  const [drillDownModal, setDrillDownModal] = useState<'users' | 'departments' | 'projects' | 'system' | null>(null);
  const [userToToggle, setUserToToggle] = useState<User | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isCopiedPassword, setIsCopiedPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Create User Modal
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE' as Role,
    departmentId: '',
  });
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Create / Edit Department Modal
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [departmentUserIds, setDepartmentUserIds] = useState<string[]>([]);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [isDeletingDept, setIsDeletingDept] = useState(false);

  // Load All Core Data
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [usersRes, deptsRes, statsRes, healthRes, logsRes, projectsRes] = await Promise.allSettled([
        apiClient.get<User[]>('/users', { params: { limit: 1000 } }),
        apiClient.get<Array<Department & { _count: { users: number; projects: number } }>>('/users/departments'),
        apiClient.get<DashboardStatsData>('/users/dashboard-stats'),
        apiClient.get<SystemHealthData>('/users/system-health'),
        apiClient.get<ActivityLog[]>('/users/audit-logs', { params: { limit: 100 } }),
        apiClient.get<Project[]>('/projects'),
      ]);

      if (usersRes.status === 'fulfilled') {
        setUsers(Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
      }
      if (deptsRes.status === 'fulfilled') {
        setDepartments(
          (Array.isArray(deptsRes.value.data) ? deptsRes.value.data : []).map((dept) => ({
            ...dept,
            userCount: dept._count?.users ?? 0,
            projectCount: dept._count?.projects ?? 0,
          }))
        );
      }
      if (statsRes.status === 'fulfilled') {
        setDashboardStats(statsRes.value.data);
      }
      if (healthRes.status === 'fulfilled') {
        setSystemHealth(healthRes.value.data);
      }
      if (logsRes.status === 'fulfilled') {
        setAuditLogs(Array.isArray(logsRes.value.data) ? logsRes.value.data : []);
      }
      if (projectsRes.status === 'fulfilled') {
        setProjects(Array.isArray(projectsRes.value.data) ? projectsRes.value.data : []);
      }
    } catch (error) {
      console.error('Không thể tải toàn bộ dữ liệu quản trị:', error);
      toast.error('Lỗi khi cập nhật dữ liệu quản trị từ hệ thống.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      const matchDept =
        deptFilter === 'ALL' ||
        (deptFilter === 'NONE' && !u.departmentId) ||
        u.departmentId === deptFilter;
      return matchSearch && matchRole && matchStatus && matchDept;
    });
  }, [users, userSearch, roleFilter, statusFilter, deptFilter]);

  // Paginated Users
  const totalUserPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;
  const currentUsers = useMemo(() => {
    return filteredUsers.slice((userPage - 1) * usersPerPage, userPage * usersPerPage);
  }, [filteredUsers, userPage, usersPerPage]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch =
        !auditSearch.trim() ||
        log.description?.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.user?.name?.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.action?.toLowerCase().includes(auditSearch.toLowerCase());
      const matchAction =
        auditActionFilter === 'ALL' ||
        (auditActionFilter === 'USER' && log.action.startsWith('USER_')) ||
        (auditActionFilter === 'DEPARTMENT' && log.action.startsWith('DEPARTMENT_')) ||
        (auditActionFilter === 'PROJECT' && log.action.startsWith('PROJECT_')) ||
        (auditActionFilter === 'SECURITY' && (log.action.includes('PASSWORD') || log.action.includes('SUSPENDED')));
      return matchSearch && matchAction;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const totalAuditPages = Math.ceil(filteredAuditLogs.length / auditPerPage) || 1;
  const currentAuditLogs = useMemo(() => {
    return filteredAuditLogs.slice((auditPage - 1) * auditPerPage, auditPage * auditPerPage);
  }, [filteredAuditLogs, auditPage, auditPerPage]);

  // Role Change Handler
  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await apiClient.put<User>(`/users/${userId}/role`, { role: newRole });
      setUsers((current) =>
        current.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success(`Đã cập nhật vai trò người dùng thành ${newRole}.`);
      void loadData(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật vai trò.');
    }
  };

  // Department Change Handler
  const handleDepartmentChange = async (userId: string, newDeptId: string) => {
    try {
      await apiClient.put<User>(`/users/${userId}/department`, {
        departmentId: newDeptId || null,
      });
      const selectedDept = departments.find((d) => d.id === newDeptId) || null;
      setUsers((current) =>
        current.map((u) =>
          u.id === userId ? { ...u, departmentId: newDeptId || null, department: selectedDept } : u
        )
      );
      toast.success('Đã cập nhật phòng ban cho người dùng.');
      void loadData(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật phòng ban.');
    }
  };

  // Toggle Active Status
  const handleConfirmToggleActive = async () => {
    if (!userToToggle) return;
    const newStatus = !userToToggle.isActive;
    const target = userToToggle;
    setUserToToggle(null);

    try {
      const response = await apiClient.put<{ isActive: boolean }>(`/users/${target.id}/status`);
      setUsers((current) =>
        current.map((u) => (u.id === target.id ? { ...u, isActive: response.data.isActive } : u))
      );
      toast.success(`Đã ${newStatus ? 'kích hoạt' : 'khóa'} tài khoản ${target.name}.`);
      void loadData(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể thay đổi trạng thái tài khoản.');
    }
  };

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUserForm.name || !createUserForm.email || !createUserForm.password) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }
    if (createUserForm.password.length < 6) {
      toast.error('Mật khẩu tối thiểu phải 6 ký tự.');
      return;
    }
    setIsSubmittingUser(true);
    try {
      await apiClient.post('/users', {
        name: createUserForm.name.trim(),
        email: createUserForm.email.trim(),
        password: createUserForm.password,
        role: createUserForm.role,
        departmentId: createUserForm.departmentId || null,
      });
      toast.success(`Đã tạo tài khoản cho "${createUserForm.name}" thành công!`);
      setIsCreateUserModalOpen(false);
      setCreateUserForm({
        name: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
        departmentId: '',
      });
      await loadData(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tạo tài khoản người dùng.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToResetPassword || !newPasswordInput.trim()) return;
    if (newPasswordInput.trim().length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    setIsResettingPassword(true);
    try {
      await apiClient.put(`/users/${userToResetPassword.id}/reset-password`, {
        newPassword: newPasswordInput.trim(),
      });
      try {
        await navigator.clipboard.writeText(newPasswordInput.trim());
        setIsCopiedPassword(true);
        toast.success(`Mật khẩu đã đặt lại và tự động sao chép vào Clipboard!`);
      } catch {
        toast.success(`Đã đặt lại mật khẩu cho ${userToResetPassword.name}!`);
      }
      setTimeout(() => {
        setUserToResetPassword(null);
        setNewPasswordInput('');
        setIsCopiedPassword(false);
      }, 1200);
      void loadData(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Generate Random Secure Password
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = 'P@ss';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordInput(pwd);
  };

  // Save Department Handler (Create / Edit)
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setIsSavingDepartment(true);
    try {
      if (editingDepartment) {
        await apiClient.put(`/users/departments/${editingDepartment.id}`, {
          name: newDeptName.trim(),
          description: newDeptDesc.trim(),
          userIds: departmentUserIds,
        });
        toast.success(`Đã cập nhật phòng ban "${newDeptName.trim()}".`);
      } else {
        await apiClient.post('/users/departments', {
          name: newDeptName.trim(),
          description: newDeptDesc.trim(),
        });
        toast.success(`Đã tạo phòng ban "${newDeptName.trim()}" thành công.`);
      }
      setIsDeptModalOpen(false);
      setEditingDepartment(null);
      setNewDeptName('');
      setNewDeptDesc('');
      setDepartmentUserIds([]);
      await loadData(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể lưu phòng ban.');
    } finally {
      setIsSavingDepartment(false);
    }
  };

  // Delete Department Handler
  const handleDeleteDepartment = async () => {
    if (!deptToDelete) return;
    setIsDeletingDept(true);
    try {
      await apiClient.delete(`/users/departments/${deptToDelete.id}`);
      toast.success(`Đã xóa phòng ban "${deptToDelete.name}" thành công.`);
      setDeptToDelete(null);
      await loadData(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể xóa phòng ban.');
    } finally {
      setIsDeletingDept(false);
    }
  };

  // Open Edit Department Modal
  const openEditDepartment = (dept: Department) => {
    setEditingDepartment(dept);
    setNewDeptName(dept.name);
    setNewDeptDesc(dept.description || '');
    setDepartmentUserIds(
      users.filter((u) => u.departmentId === dept.id && u.role !== 'ADMIN').map((u) => u.id)
    );
    setIsDeptModalOpen(true);
  };

  // Open Create Department Modal
  const openCreateDepartment = () => {
    setEditingDepartment(null);
    setNewDeptName('');
    setNewDeptDesc('');
    setDepartmentUserIds([]);
    setIsDeptModalOpen(true);
  };

  // Chart Data Preparation
  const roleDistributionData = useMemo(() => {
    const adminCount = users.filter((u) => u.role === 'ADMIN').length;
    const managerCount = users.filter((u) => u.role === 'MANAGER').length;
    const employeeCount = users.filter((u) => u.role === 'EMPLOYEE').length;
    return [
      { name: 'Admin', value: adminCount, color: '#ef4444' },
      { name: 'Manager', value: managerCount, color: '#3b82f6' },
      { name: 'Employee', value: employeeCount, color: '#10b981' },
    ];
  }, [users]);

  const taskStatusData = useMemo(() => {
    return [
      { status: 'Cần làm', count: dashboardStats?.tasks.TODO ?? 0, fill: '#64748b' },
      { status: 'Đang làm', count: dashboardStats?.tasks.IN_PROGRESS ?? 0, fill: '#3b82f6' },
      { status: 'Đánh giá', count: dashboardStats?.tasks.REVIEW ?? 0, fill: '#f59e0b' },
      { status: 'Hoàn thành', count: dashboardStats?.tasks.DONE ?? 0, fill: '#10b981' },
    ];
  }, [dashboardStats]);

  // Executive Admins for Organogram
  const adminUsers = useMemo(() => users.filter((u) => u.role === 'ADMIN'), [users]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 transition-colors duration-200 dark:bg-slate-950 sm:p-6 lg:p-8 space-y-8">
      {/* ============================================================== */}
      {/* 1. TOP HEADER - ENTERPRISE CONTROL CENTER */}
      {/* ============================================================== */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30 inline-flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-rose-500 animate-pulse" />
              Admin Control Center Pro Max
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Enterprise Governance & Security
            </span>
            {systemHealth && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                Live Telemetry: {systemHealth.database.latencyMs}ms
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Trung Tâm Điều Hành & Quản Trị Hệ Thống
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản trị nhân sự toàn diện, phân cấp cơ cấu tổ chức phòng ban, giám sát nhật ký kiểm toán và độ ổn định máy chủ.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            title="Làm mới toàn bộ dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
            <span>{isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateUserModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-purple-500 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm Người Dùng</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. TOP 4 SYSTEM METRIC STAT CARDS (WITH DRILL-DOWN MODALS) */}
      {/* ============================================================== */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Users */}
        <button
          type="button"
          onClick={() => setDrillDownModal('users')}
          className="group rounded-3xl border border-slate-200 bg-white/90 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80 cursor-pointer"
        >
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium">Tổng Người Dùng</span>
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {dashboardStats?.users.total ?? users.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {dashboardStats?.users.active ?? users.filter((u) => u.isActive).length} hoạt động
                </span>{' '}
                • {dashboardStats?.users.inactive ?? users.filter((u) => !u.isActive).length} đã khóa
              </p>
            </div>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300 border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              Chi tiết →
            </span>
          </div>
        </button>

        {/* Card 2: Departments */}
        <button
          type="button"
          onClick={() => setDrillDownModal('departments')}
          className="group rounded-3xl border border-slate-200 bg-white/90 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-purple-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80 cursor-pointer"
        >
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium">Phòng Ban Chuyên Trách</span>
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <Building className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {departments.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Phân quyền & cơ cấu đội ngũ vận hành
              </p>
            </div>
            <span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-300 border border-purple-500/20 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              Cơ cấu →
            </span>
          </div>
        </button>

        {/* Card 3: Projects */}
        <button
          type="button"
          onClick={() => setDrillDownModal('projects')}
          className="group rounded-3xl border border-slate-200 bg-white/90 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-amber-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80 cursor-pointer"
        >
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium">Dự Án Toàn Hệ Thống</span>
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {dashboardStats?.projects.total ?? projects.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {dashboardStats?.tasks.completionRate ?? 0}% Hoàn thành tasks Kanban
              </p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              Tiến độ →
            </span>
          </div>
        </button>

        {/* Card 4: System Health */}
        <button
          type="button"
          onClick={() => setDrillDownModal('system')}
          className="group rounded-3xl border border-slate-200 bg-white/90 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80 cursor-pointer"
        >
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium">Trạng Thái Hệ Thống</span>
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {systemHealth?.status === 'ONLINE' ? 'Trực Tuyến' : 'Ổn Định'}
                </p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                MySQL DB Ping: {systemHealth?.database.latencyMs ?? 2}ms • Uptime {systemHealth?.server.uptimeFormatted ?? 'Hoạt động'}
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              Health →
            </span>
          </div>
        </button>
      </section>

      {/* ============================================================== */}
      {/* 3. MAIN TABS NAVIGATION */}
      {/* ============================================================== */}
      <nav className="flex p-1.5 rounded-3xl bg-slate-200/70 border border-slate-300/80 dark:bg-slate-900/90 dark:border-slate-800 max-w-2xl backdrop-blur-xl shadow-inner gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Quản Lý Người Dùng ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('departments')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
            activeTab === 'departments'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Phòng Ban & Cơ Cấu ({departments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Nhật Ký & Analytics</span>
        </button>
      </nav>

      {/* ============================================================== */}
      {/* 4. TABS CONTENT */}
      {/* ============================================================== */}
      <AnimatePresence mode="wait">
        {/* TAB 1: USER MANAGEMENT CENTER */}
        {activeTab === 'users' && (
          <motion.div
            key="tab-users"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Filter & Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc email..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                    className="w-full pl-10 pr-3.5 py-2 text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="text-xs bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                    setUserPage(1);
                  }}
                  className="text-xs bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">Mọi trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Đã khóa</option>
                </select>

                {/* Department Filter */}
                <select
                  value={deptFilter}
                  onChange={(e) => {
                    setDeptFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="text-xs bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[180px] truncate"
                >
                  <option value="ALL">Mọi phòng ban</option>
                  <option value="NONE">Chưa gán phòng ban</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Hiển thị <strong>{filteredUsers.length}</strong> người dùng
                </span>
                <select
                  value={usersPerPage}
                  onChange={(e) => {
                    setUsersPerPage(Number(e.target.value));
                    setUserPage(1);
                  }}
                  className="text-xs bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value={5}>5 / trang</option>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                </select>
              </div>
            </div>

            {/* Users Table Card */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 font-bold uppercase tracking-wider">
                      <th className="py-4 px-5">Nhân Sự & Email</th>
                      <th className="py-4 px-5">Phòng Ban Phụ Trách</th>
                      <th className="py-4 px-5">Vai Trò Hệ Thống</th>
                      <th className="py-4 px-5 text-center">Trạng Thái</th>
                      <th className="py-4 px-5 text-right">Hành Động Quản Trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {currentUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          Không tìm thấy người dùng phù hợp với điều kiện tìm kiếm.
                        </td>
                      </tr>
                    ) : (
                      currentUsers.map((u) => (
                        <tr
                          key={u.id}
                          className="bg-white/40 transition hover:bg-slate-50/80 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
                        >
                          {/* Member info */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-sm">
                                {u.avatar ? (
                                  <img src={u.avatar} alt={u.name} className="h-full w-full object-cover" />
                                ) : (
                                  u.name
                                    .split(' ')
                                    .map((p) => p[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white truncate">{u.name}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                  {u.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Department dropdown */}
                          <td className="py-4 px-5">
                            <select
                              value={u.departmentId || ''}
                              onChange={(e) => handleDepartmentChange(u.id, e.target.value)}
                              className="text-xs bg-slate-100/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[200px]"
                            >
                              <option value="">Chưa phân bổ</option>
                              {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                  {dept.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Role dropdown */}
                          <td className="py-4 px-5">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition focus:ring-2 focus:ring-indigo-500 ${roleBadgeStyles[u.role]}`}
                            >
                              <option value="ADMIN">ADMIN</option>
                              <option value="MANAGER">MANAGER</option>
                              <option value="EMPLOYEE">EMPLOYEE</option>
                            </select>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-5 text-center">
                            {u.isActive ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                Hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-semibold">
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                Đã khóa
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Reset Password Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setUserToResetPassword(u);
                                  setNewPasswordInput('');
                                  setIsCopiedPassword(false);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-medium text-xs bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 transition cursor-pointer"
                                title="Đặt lại mật khẩu khẩn cấp"
                              >
                                <Key className="w-3.5 h-3.5 text-amber-500" />
                                <span>Reset Pass</span>
                              </button>

                              {/* Toggle Active Button */}
                              <button
                                type="button"
                                onClick={() => setUserToToggle(u)}
                                className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition cursor-pointer ${
                                  u.isActive
                                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30'
                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30'
                                }`}
                              >
                                {u.isActive ? 'Khóa Tài Khoản' : 'Mở Khóa'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Trang <strong>{userPage}</strong> trên tổng số <strong>{totalUserPages}</strong> (Tổng {filteredUsers.length} người)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((p) => Math.max(p - 1, 1))}
                    className="p-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold px-2 text-slate-700 dark:text-slate-300">
                    {userPage} / {totalUserPages}
                  </span>
                  <button
                    disabled={userPage >= totalUserPages}
                    onClick={() => setUserPage((p) => Math.min(p + 1, totalUserPages))}
                    className="p-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: DEPARTMENT & ORGANOGRAM */}
        {activeTab === 'departments' && (
          <motion.div
            key="tab-departments"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-500" />
                  Cơ Cấu Phòng Ban & Phân Cấp Doanh Nghiệp
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Quản lý các phòng ban, chỉ định Trưởng phòng đại diện và trực quan hóa sơ đồ tổ chức.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* View Switcher: Card Grid vs Organogram */}
                <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setDeptViewMode('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      deptViewMode === 'grid'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Dạng Thẻ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeptViewMode('organogram')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      deptViewMode === 'organogram'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>Sơ Đồ Phân Cấp</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openCreateDepartment}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-md shadow-indigo-600/20 cursor-pointer transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Phòng Ban Mới</span>
                </button>
              </div>
            </div>

            {/* VIEW MODE 1: CARD GRID */}
            {deptViewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {departments.map((dept) => {
                  const deptMembers = users.filter((u) => u.departmentId === dept.id);
                  const deptManagers = deptMembers.filter((u) => u.role === 'MANAGER');
                  const deptEmployees = deptMembers.filter((u) => u.role === 'EMPLOYEE');

                  return (
                    <div
                      key={dept.id}
                      className="p-6 rounded-3xl border border-slate-200 bg-white/90 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between"
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                              <Building className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                                {dept.name}
                              </h4>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {dept.projectCount ?? 0} dự án phụ trách
                              </span>
                            </div>
                          </div>

                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {dept.userCount ?? deptMembers.length} Nhân sự
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-5 leading-relaxed">
                          {dept.description || 'Chưa có mô tả chi tiết nhiệm vụ và chức năng của phòng ban.'}
                        </p>

                        {/* Head of Department (Manager) Card */}
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 mb-5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Trưởng Phòng Phụ Trách</span>
                          </div>
                          {deptManagers.length > 0 ? (
                            <div className="space-y-1.5">
                              {deptManagers.map((mgr) => (
                                <div key={mgr.id} className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                      {mgr.name[0]}
                                    </div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                      {mgr.name}
                                    </p>
                                  </div>
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300 font-semibold shrink-0">
                                    MANAGER
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                              Chưa chỉ định Trưởng phòng (Manager)
                            </p>
                          )}
                        </div>

                        {/* Members Avatar Row */}
                        <div className="mb-5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            Thành viên ({deptEmployees.length} nhân viên)
                          </div>
                          <div className="flex items-center -space-x-2 overflow-hidden py-1">
                            {deptMembers.slice(0, 6).map((m) => (
                              <div
                                key={m.id}
                                title={`${m.name} (${m.role})`}
                                className="h-8 w-8 rounded-full border-2 border-white dark:border-slate-900 bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white flex items-center justify-center shrink-0 shadow-sm"
                              >
                                {m.avatar ? (
                                  <img src={m.avatar} alt={m.name} className="h-full w-full rounded-full object-cover" />
                                ) : (
                                  m.name[0]
                                )}
                              </div>
                            ))}
                            {deptMembers.length > 6 && (
                              <div className="h-8 w-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                                +{deptMembers.length - 6}
                              </div>
                            )}
                            {deptMembers.length === 0 && (
                              <span className="text-xs text-slate-400 italic">Chưa có nhân sự gán vào phòng</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => openEditDepartment(dept)}
                          className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa & Nhân sự</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeptToDelete(dept)}
                          className="flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW MODE 2: ORGANOGRAM TREE VIEW */}
            {deptViewMode === 'organogram' && (
              <div className="p-8 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl overflow-x-auto space-y-10">
                {/* Level 1: Board of Admins */}
                <div className="flex flex-col items-center">
                  <div className="px-6 py-4 rounded-3xl border border-rose-300 bg-rose-500/10 dark:border-rose-500/30 dark:bg-rose-950/40 text-center shadow-lg max-w-lg w-full">
                    <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500 text-white shadow-sm inline-block mb-2">
                      Ban Quản Trị Hệ Thống / Ban Lãnh Đạo
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Executive Board & System Administrators
                    </h4>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      {adminUsers.map((admin) => (
                        <div
                          key={admin.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm"
                        >
                          <div className="h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">
                            {admin.name[0]}
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {admin.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Connecting Stem */}
                  <div className="h-10 w-0.5 bg-gradient-to-b from-rose-500 to-indigo-500" />
                </div>

                {/* Level 2: Departments & Managers Tree */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {departments.map((dept) => {
                    const deptMembers = users.filter((u) => u.departmentId === dept.id);
                    const deptManagers = deptMembers.filter((u) => u.role === 'MANAGER');
                    const deptEmployees = deptMembers.filter((u) => u.role === 'EMPLOYEE');

                    return (
                      <div
                        key={dept.id}
                        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-5 shadow-sm space-y-4"
                      >
                        {/* Department Box */}
                        <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                          <h5 className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300">
                            {dept.name}
                          </h5>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {deptMembers.length} thành viên • {dept.projectCount ?? 0} dự án
                          </span>
                        </div>

                        {/* Line */}
                        <div className="h-4 w-0.5 bg-indigo-400/40 mx-auto" />

                        {/* Manager Lead Node */}
                        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                            Trưởng Phòng / Team Lead
                          </span>
                          {deptManagers.length > 0 ? (
                            deptManagers.map((mgr) => (
                              <p key={mgr.id} className="text-xs font-extrabold text-slate-900 dark:text-white">
                                🌟 {mgr.name}
                              </p>
                            ))
                          ) : (
                            <p className="text-xs text-amber-500 italic">Chưa chỉ định</p>
                          )}
                        </div>

                        {/* Line */}
                        <div className="h-4 w-0.5 bg-slate-300 dark:bg-slate-700 mx-auto" />

                        {/* Staff Members List */}
                        <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5 max-h-48 overflow-y-auto">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Chuyên viên / Nhân sự ({deptEmployees.length})
                          </span>
                          {deptEmployees.length > 0 ? (
                            deptEmployees.map((emp) => (
                              <div
                                key={emp.id}
                                className="flex items-center justify-between text-[11px] py-1 px-2 rounded-xl bg-slate-100/60 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                              >
                                <span className="truncate font-medium">{emp.name}</span>
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                                  STAFF
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">Chưa có nhân viên</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: SYSTEM AUDIT LOGS & ANALYTICS */}
        {activeTab === 'stats' && (
          <motion.div
            key="tab-stats"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Top Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Pie Chart: Role Distribution */}
              <div className="lg:col-span-5 p-6 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
                    Phân Bổ Vai Trò Người Dùng (Role Distribution)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Tỷ trọng cơ cấu tài khoản Admin, Manager và Employee
                  </p>
                </div>

                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
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
                          borderRadius: '1rem',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Admin</span>
                    <p className="text-sm font-extrabold text-rose-500">
                      {roleDistributionData[0].value}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Manager</span>
                    <p className="text-sm font-extrabold text-blue-500">
                      {roleDistributionData[1].value}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Employee</span>
                    <p className="text-sm font-extrabold text-emerald-500">
                      {roleDistributionData[2].value}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bar Chart: Task Status Breakdown */}
              <div className="lg:col-span-7 p-6 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
                    Thống Kê Công Việc & Trạng Thái Kanban
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Số lượng công việc đang xử lý trên toàn bộ dự án hệ thống
                  </p>
                </div>

                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taskStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                      <XAxis dataKey="status" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '1rem',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" name="Số lượng tasks" radius={[8, 8, 0, 0]}>
                        {taskStatusData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Tổng số tasks: <strong>{dashboardStats?.tasks.total ?? 0}</strong>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Tỷ lệ hoàn thành: {dashboardStats?.tasks.completionRate ?? 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Audit Logs Table Section */}
            <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-500" />
                    Nhật Ký Thao Tác Hệ Thống (Audit Logs)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ghi lại các sự kiện phân quyền, thay đổi phòng ban, khóa tài khoản và thiết lập an ninh.
                  </p>
                </div>

                {/* Filter and Search for Audit Logs */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm nhật ký..."
                      value={auditSearch}
                      onChange={(e) => {
                        setAuditSearch(e.target.value);
                        setAuditPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <select
                    value={auditActionFilter}
                    onChange={(e) => {
                      setAuditActionFilter(e.target.value);
                      setAuditPage(1);
                    }}
                    className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">Mọi loại sự kiện</option>
                    <option value="USER">Người dùng & Tài khoản</option>
                    <option value="DEPARTMENT">Phòng ban</option>
                    <option value="SECURITY">Bảo mật & Reset pass</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Thời Gian</th>
                      <th className="py-3 px-4">Người Thực Hiện</th>
                      <th className="py-3 px-4">Hành Động</th>
                      <th className="py-3 px-4">Mô Tả Chi Tiết</th>
                      <th className="py-3 px-4">Đối Tượng (Entity)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {currentAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chưa có nhật ký hoạt động nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      currentAuditLogs.map((log) => {
                        const style =
                          actionBadgeStyles[log.action] ||
                          'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

                        return (
                          <tr
                            key={log.id}
                            className="bg-white/40 transition hover:bg-slate-50/80 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
                          >
                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('vi-VN')}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {log.user?.name?.[0] || 'U'}
                                </div>
                                <span className="font-semibold text-slate-900 dark:text-white truncate">
                                  {log.user?.name || 'Hệ thống'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${style}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                              {log.description}
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                              {log.entityType} ({log.entityId.slice(0, 8)}...)
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Audit Pagination */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2">
                <span>
                  Trang <strong>{auditPage}</strong> / <strong>{totalAuditPages}</strong> ({filteredAuditLogs.length} sự kiện)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage((p) => Math.max(p - 1, 1))}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={auditPage >= totalAuditPages}
                    onClick={() => setAuditPage((p) => Math.min(p + 1, totalAuditPages))}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 5. ALL INTERACTIVE MODALS */}
      {/* ============================================================== */}

      {/* MODAL 1: DRILL DOWN STATS MODALS */}
      <AnimatePresence>
        {drillDownModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    {drillDownModal === 'users' && <Users className="w-5 h-5" />}
                    {drillDownModal === 'departments' && <Building className="w-5 h-5" />}
                    {drillDownModal === 'projects' && <FolderKanban className="w-5 h-5" />}
                    {drillDownModal === 'system' && <Server className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold">
                      {drillDownModal === 'users' && 'Phân Tích Chi Tiết Người Dùng Hệ Thống'}
                      {drillDownModal === 'departments' && 'Tổng Quan Các Phòng Ban & Quy Mô'}
                      {drillDownModal === 'projects' && 'Tiến Độ Dự Án & Tasks Kanban'}
                      {drillDownModal === 'system' && 'Thông Số Máy Chủ & Cơ Sở Dữ Liệu'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Dữ liệu kiểm toán và thông số vận hành thời gian thực
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDrillDownModal(null)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Users Drill Down Content */}
              {drillDownModal === 'users' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-xs text-slate-500">Tổng tài khoản</span>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                        {users.length}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">Đang hoạt động</span>
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                        {users.filter((u) => u.isActive).length}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                      <span className="text-xs text-rose-600 dark:text-rose-400">Bị khóa</span>
                      <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                        {users.filter((u) => !u.isActive).length}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Người dùng mới tham gia gần đây
                    </h4>
                    <div className="space-y-2">
                      {users.slice(0, 5).map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold">
                              {u.name[0]}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                              <p className="text-[11px] text-slate-500">{u.email}</p>
                            </div>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${roleBadgeStyles[u.role]}`}>
                            {u.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Departments Drill Down Content */}
              {drillDownModal === 'departments' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Danh sách toàn bộ các phòng ban đang hoạt động trong hệ thống:
                  </p>
                  <div className="space-y-2.5">
                    {departments.map((dept) => (
                      <div
                        key={dept.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
                      >
                        <div>
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white">{dept.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{dept.description || 'Không có mô tả'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">
                            {dept.userCount ?? 0} Nhân sự
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {dept.projectCount ?? 0} Dự án
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects Drill Down Content */}
              {drillDownModal === 'projects' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Lập Kế Hoạch</span>
                      <p className="text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-1">
                        {dashboardStats?.projects.PLANNING ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-blue-500/10 text-center">
                      <span className="text-[10px] text-blue-500 uppercase font-bold">Đang Thực Hiện</span>
                      <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                        {dashboardStats?.projects.IN_PROGRESS ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-center">
                      <span className="text-[10px] text-emerald-500 uppercase font-bold">Hoàn Thành</span>
                      <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                        {dashboardStats?.projects.COMPLETED ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-purple-500/10 text-center">
                      <span className="text-[10px] text-purple-500 uppercase font-bold">Lưu Trữ</span>
                      <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
                        {dashboardStats?.projects.ARCHIVED ?? 0}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Tiến độ tasks hệ thống
                    </h4>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span>Hoàn thành tasks: {dashboardStats?.tasks.DONE ?? 0}/{dashboardStats?.tasks.total ?? 0}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{dashboardStats?.tasks.completionRate ?? 0}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${dashboardStats?.tasks.completionRate ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* System Health Drill Down Content */}
              {drillDownModal === 'system' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-indigo-500 mb-1">
                        <Database className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Cơ Sở Dữ Liệu MySQL</span>
                      </div>
                      <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {systemHealth?.database.status === 'CONNECTED' ? 'Kết Nối Ổn Định' : 'Đang Kiểm Tra'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Ping Latency: <strong className="text-emerald-600 dark:text-emerald-400">{systemHealth?.database.latencyMs ?? 2}ms</strong>
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-purple-500 mb-1">
                        <Cpu className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Runtime & Memory</span>
                      </div>
                      <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                        Node {systemHealth?.server.nodeVersion || 'v20+'} ({systemHealth?.server.platform || 'Server'})
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        RAM Heap: <strong>{systemHealth?.server.memory.heapUsedMB ?? 0} MB</strong> / {systemHealth?.server.memory.heapTotalMB ?? 0} MB
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Thời gian hoạt động liên tục (Uptime):</span>
                      <strong className="text-slate-900 dark:text-white">{systemHealth?.server.uptimeFormatted ?? 'Không khả dụng'}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Kết nối Socket Live:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{systemHealth?.realtime.connectedClients ?? 1} Clients kết nối</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Đồng bộ bản ghi hệ thống:</span>
                      <strong className="text-slate-900 dark:text-white">
                        {systemHealth?.records.users ?? users.length} Users • {systemHealth?.records.projects ?? 0} Dự án • {systemHealth?.records.tasks ?? 0} Tasks
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDrillDownModal(null)}
                  className="px-5 py-2 text-xs font-semibold rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CREATE USER MODAL */}
      <AnimatePresence>
        {isCreateUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-900 dark:text-white"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-500" />
                  Thêm Người Dùng Mới
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  disabled={isSubmittingUser}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    required
                    value={createUserForm.name}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, name: e.target.value })}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email tài khoản *
                  </label>
                  <input
                    type="email"
                    required
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                    placeholder="VD: nguyenvana@company.com"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu khởi tạo * (Tối thiểu 6 ký tự)
                  </label>
                  <input
                    type="password"
                    required
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                    placeholder="Nhập mật khẩu..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Vai trò (Role)
                    </label>
                    <select
                      value={createUserForm.role}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value as Role })}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Phòng ban
                    </label>
                    <select
                      value={createUserForm.departmentId}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, departmentId: e.target.value })}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer truncate"
                    >
                      <option value="">Chưa gán</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateUserModalOpen(false)}
                    disabled={isSubmittingUser}
                    className="px-4 py-2 text-xs font-semibold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-md shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingUser ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: RESET PASSWORD MODAL */}
      <AnimatePresence>
        {userToResetPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-900 dark:text-white"
            >
              <div className="flex items-center gap-3 text-amber-500 mb-3">
                <Key className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Reset Mật Khẩu Khẩn Cấp
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Bạn đang thực hiện đặt lại mật khẩu cho tài khoản{' '}
                <strong className="text-slate-900 dark:text-white">{userToResetPassword.name}</strong> ({userToResetPassword.email}).
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Mật khẩu mới *
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold cursor-pointer"
                    >
                      ✨ Tạo ngẫu nhiên
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Nhập hoặc tạo mật khẩu mới..."
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setUserToResetPassword(null);
                      setNewPasswordInput('');
                    }}
                    disabled={isResettingPassword}
                    className="px-4 py-2 text-xs font-semibold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPassword || !newPasswordInput.trim()}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-2xl shadow-md shadow-amber-600/30 transition cursor-pointer disabled:opacity-50"
                  >
                    {isCopiedPassword ? <Check className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                    <span>{isResettingPassword ? 'Đang cập nhật...' : 'Xác Nhận Đặt Lại'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: CONFIRM TOGGLE ACTIVE STATUS */}
      <AnimatePresence>
        {userToToggle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-900 dark:text-white"
            >
              <div className="flex items-center gap-3 text-amber-500 mb-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Xác Nhận Thay Đổi Trạng Thái
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                Bạn có chắc chắn muốn{' '}
                <strong className={userToToggle.isActive ? 'text-rose-500' : 'text-emerald-500'}>
                  {userToToggle.isActive ? 'KHÓA' : 'MỞ KHÓA'}
                </strong>{' '}
                tài khoản của nhân sự <strong className="text-slate-900 dark:text-white">{userToToggle.name}</strong> ({userToToggle.email})?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUserToToggle(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-2xl bg-slate-100 dark:bg-slate-800 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmToggleActive}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-2xl shadow-md transition cursor-pointer ${
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

      {/* MODAL 5: CREATE / EDIT DEPARTMENT MODAL */}
      <AnimatePresence>
        {isDeptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-900 dark:text-white"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-500" />
                  {editingDepartment ? 'Chỉnh Sửa Phòng Ban' : 'Tạo Phòng Ban Mới'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  disabled={isSavingDepartment}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDepartment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên phòng ban *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="VD: Phòng Trí Tuệ Nhân Tạo & Dữ Liệu Lớn"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mô tả chức năng & nhiệm vụ
                  </label>
                  <textarea
                    rows={3}
                    value={newDeptDesc}
                    onChange={(e) => setNewDeptDesc(e.target.value)}
                    placeholder="Nhập vai trò và phạm vi hoạt động của phòng ban..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {editingDepartment && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      Gán nhân sự vào phòng ban này ({departmentUserIds.length} đã chọn)
                    </legend>
                    <div className="max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2">
                      {users
                        .filter((person) => person.role !== 'ADMIN')
                        .map((person) => (
                          <label
                            key={person.id}
                            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition"
                          >
                            <input
                              type="checkbox"
                              checked={departmentUserIds.includes(person.id)}
                              onChange={(event) => {
                                setDepartmentUserIds((current) =>
                                  event.target.checked
                                    ? [...current, person.id]
                                    : current.filter((id) => id !== person.id)
                                );
                              }}
                              className="h-4 w-4 rounded border-slate-400 bg-white text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                {person.name}
                              </p>
                              <p className="truncate text-[11px] text-slate-500">{person.email}</p>
                            </div>
                            <span
                              className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                person.role === 'MANAGER'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                              }`}
                            >
                              {person.role === 'MANAGER' ? 'Quản lý' : 'Nhân viên'}
                            </span>
                          </label>
                        ))}
                    </div>
                  </fieldset>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDeptModalOpen(false)}
                    disabled={isSavingDepartment}
                    className="px-4 py-2 text-xs font-semibold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDepartment}
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-md shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDepartment ? 'Đang lưu...' : editingDepartment ? 'Lưu Thay Đổi' : 'Tạo Phòng Ban'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 6: CONFIRM DELETE DEPARTMENT */}
      <AnimatePresence>
        {deptToDelete && (
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
                  Xác Nhận Xóa Phòng Ban
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Bạn có chắc chắn muốn xóa phòng ban{' '}
                <strong className="text-rose-500">{deptToDelete.name}</strong>?
                Nhân sự và dự án thuộc phòng ban này sẽ được giải phóng an toàn (về trạng thái chưa phân bổ).
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeptToDelete(null)}
                  disabled={isDeletingDept}
                  className="px-4 py-2 text-xs font-semibold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDepartment}
                  disabled={isDeletingDept}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-2xl shadow-md shadow-rose-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isDeletingDept ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPage;

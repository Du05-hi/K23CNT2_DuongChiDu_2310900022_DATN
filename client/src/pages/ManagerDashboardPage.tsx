import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderKanban,
  Search,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient } from '@/api/apiClient';
import TaskDetailsModal from '@/components/TaskDetailsModal';
import DashboardAiResponse from '@/components/DashboardAiResponse';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';
import aiService from '@/services/aiService';
import taskService from '@/services/taskService';

interface DashboardMember {
  id: string;
  name: string;
  email?: string;
  role: string;
  avatar?: string | null;
  isActive: boolean;
  department?: { id: string; name: string } | null;
  tasksAssigned: number;
  tasksOnTime: number;
  tasksLate: number;
  contributionRate: number;
  kpiScore: number;
}

interface DashboardProject {
  id: string;
  name: string;
  status: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budgetDays: number;
  progress: number;
  members: Array<{ id: string; name: string; avatar?: string | null }>;
}

interface DashboardTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  project?: { id: string; name: string } | null;
  assignee?: { id: string; name: string; avatar?: string | null } | null;
  dueDate?: string | null;
  overdueDays?: number;
}

interface DashboardData {
  role: string;
  teamSize: number;
  projects: { total: number; IN_PROGRESS: number };
  tasks: { TODO: number; IN_PROGRESS: number; REVIEW: number; DONE: number; total: number; overdue: number };
  monthlyKpi: { totalScore: number; rank: string; tasksCompleted: number; tasksOnTime: number } | null;
  recentProjects: Array<{ id: string; name: string; status: string; _count: { tasks: number; members: number } }>;
  recentTasks: Array<DashboardTaskItem>;
  teamMembers: DashboardMember[];
  projectList: DashboardProject[];
  approvalQueue: DashboardTaskItem[];
  overdueTasks: DashboardTaskItem[];
  completedTasks: DashboardTaskItem[];
  statusBreakdown: Array<{ name: string; value: number; color: string }>;
  weeklyTrend: Array<{ label: string; completed: number }>;
}

type ModalType = 'team' | 'projects' | 'tasks' | null;
type TaskModalFilter = 'completed' | 'overdue';

const priorityStyles: Record<string, string> = {
  LOW: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  MEDIUM: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  HIGH: 'bg-orange-500/10 text-orange-300 border border-orange-500/30',
  URGENT: 'bg-rose-500/10 text-rose-300 border border-rose-500/30',
};

const statusStyles: Record<string, string> = {
  TODO: 'bg-slate-500/10 text-slate-300 border border-slate-500/30',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-300 border border-blue-500/30',
  REVIEW: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  DONE: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatStatus = (status?: string | null) => {
  switch (status) {
    case 'TODO':
      return 'Cần làm';
    case 'IN_PROGRESS':
      return 'Đang làm';
    case 'REVIEW':
      return 'Đang duyệt';
    case 'DONE':
      return 'Hoàn thành';
    default:
      return status ?? 'Không xác định';
  }
};

const formatPriority = (priority?: string | null) => {
  if (!priority) return 'Medium';
  return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
};

const ManagerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [taskFilter, setTaskFilter] = useState<TaskModalFilter>('completed');
  const [modalSearch, setModalSearch] = useState('');
  const [modalPage, setModalPage] = useState(1);
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['role-dashboard'],
    queryFn: async () => {
      const response = await apiClient.get<DashboardData>('/users/role-dashboard');
      return response.data;
    },
  });

  useEffect(() => {
    if (!socket) return;
    const refreshDashboard = () => {
      void refetch();
    };
    socket.on('projects:changed', refreshDashboard);
    return () => {
      socket.off('projects:changed', refreshDashboard);
    };
  }, [socket, refetch]);

  useEffect(() => {
    setModalSearch('');
    setModalPage(1);
    setSelectedMemberId(null);
  }, [activeModal, taskFilter]);

  const chartData = data?.statusBreakdown ?? [
    { name: 'TO_DO', value: 0, color: '#64748b' },
    { name: 'IN_PROGRESS', value: 0, color: '#3b82f6' },
    { name: 'REVIEW', value: 0, color: '#f59e0b' },
    { name: 'DONE', value: 0, color: '#10b981' },
  ];

  const staffMembers = useMemo(() => data?.teamMembers ?? [], [data?.teamMembers]);
  const projectList = useMemo(() => data?.projectList ?? [], [data?.projectList]);
  const approvalQueue = data?.approvalQueue ?? [];
  const completedTasks = useMemo(() => data?.completedTasks ?? [], [data?.completedTasks]);
  const overdueTasks = useMemo(() => data?.overdueTasks ?? [], [data?.overdueTasks]);

  const teamModalItems = useMemo(() => {
    const list = [...staffMembers];
    if (!modalSearch.trim()) return list;
    const query = modalSearch.trim().toLowerCase();
    return list.filter((member) =>
      member.name.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query)
    );
  }, [modalSearch, staffMembers]);

  const projectModalItems = useMemo(() => {
    const list = [...projectList];
    if (!modalSearch.trim()) return list;
    const query = modalSearch.trim().toLowerCase();
    return list.filter((project) =>
      project.name.toLowerCase().includes(query) ||
      project.status.toLowerCase().includes(query) ||
      project.members.some((member) => member.name.toLowerCase().includes(query))
    );
  }, [modalSearch, projectList]);

  const taskModalItems = useMemo(() => {
    const list = taskFilter === 'completed' ? completedTasks : overdueTasks;
    if (!modalSearch.trim()) return list;
    const query = modalSearch.trim().toLowerCase();
    return list.filter((task) =>
      task.title.toLowerCase().includes(query) ||
      task.project?.name.toLowerCase().includes(query) ||
      task.assignee?.name.toLowerCase().includes(query)
    );
  }, [completedTasks, modalSearch, overdueTasks, taskFilter]);

  const totalPages = Math.max(1, Math.ceil((activeModal === 'team' ? teamModalItems.length : activeModal === 'projects' ? projectModalItems.length : taskModalItems.length) / 5));
  const paginatedList = useMemo(() => {
    const list = activeModal === 'team' ? teamModalItems : activeModal === 'projects' ? projectModalItems : taskModalItems;
    return list.slice((modalPage - 1) * 5, modalPage * 5);
  }, [activeModal, modalPage, projectModalItems, taskModalItems, teamModalItems]);

  const stats = [
    { key: 'team' as const, label: 'Nhân sự trong nhóm', value: data?.teamSize ?? 0, icon: Users, modal: 'team' as ModalType, filter: null as TaskModalFilter | null },
    { key: 'projects' as const, label: 'Dự án đang hoạt động', value: data?.projects?.IN_PROGRESS ?? 0, icon: FolderKanban, modal: 'projects' as ModalType, filter: null as TaskModalFilter | null },
    { key: 'completed' as const, label: 'Công việc hoàn thành', value: data?.tasks?.DONE ?? 0, icon: CheckCircle2, modal: 'tasks' as ModalType, filter: 'completed' as TaskModalFilter },
    { key: 'overdue' as const, label: 'Công việc quá hạn', value: data?.tasks?.overdue ?? 0, icon: AlertTriangle, modal: 'tasks' as ModalType, filter: 'overdue' as TaskModalFilter },
  ];

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiSummary(null);
    setAiError(null);
    try {
      const risksRaw = await aiService.detectRisks();
      const risks = Array.isArray(risksRaw)
        ? risksRaw
        : Array.isArray((risksRaw as any)?.data)
        ? (risksRaw as any).data
        : [];
      const highestWorkloadMember = Array.isArray(staffMembers) && staffMembers.length > 0
        ? [...staffMembers].sort((a, b) => (b.tasksAssigned || 0) - (a.tasksAssigned || 0))[0]
        : null;
      const riskLines = Array.isArray(risks)
        ? risks.slice(0, 3).map((risk) =>
            `- **${risk.projectName || risk.title || 'Dự án'}** (${risk.riskLevel || 'LOW'}): ${risk.description || 'Gemini chưa trả về nguyên nhân cụ thể.'}`
          )
        : [];
      const recommendations = Array.isArray(risks)
        ? [
            ...new Set(
              risks
                .map((risk) => (typeof risk.recommendation === 'string' ? risk.recommendation : '').trim())
                .filter(Boolean)
            ),
          ].slice(0, 3)
        : [];

      setAiSummary([
        '### Tải công việc',
        highestWorkloadMember
          ? `- **${highestWorkloadMember.name}** có ${highestWorkloadMember.tasksAssigned || 0} task được giao, trong đó ${highestWorkloadMember.tasksLate || 0} task trễ hạn. Đây là người có số task được gán cao nhất trong dữ liệu nhân sự hiện tại.`
          : '- Backend hiện không trả về nhân sự trong phạm vi quản lý.',
        '',
        '### Rủi ro dự án từ Gemini',
        ...(riskLines.length ? riskLines : ['- Không có dự án đang hoạt động trong phạm vi phân tích.']),
        '',
        '### Đề xuất phân bổ',
        ...(recommendations.length ? recommendations.map((recommendation) => `- ${recommendation}`) : ['- Gemini chưa trả về đề xuất cho các dự án trong phạm vi hiện tại.']),
      ].join('\n'));
      toast.success('AI Gemini đã hoàn tất phân tích tải công việc & rủi ro! ✨');
    } catch (error) {
      console.error('Không thể phân tích rủi ro quản trị:', error);
      const msg = error instanceof Error ? error.message : 'Không thể lấy phân tích từ AI. Vui lòng thử lại.';
      setAiError(msg);
      toast.error(msg);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApproveTask = async (taskId: string) => {
    const comment = approvalComments[taskId]?.trim();
    try {
      await taskService.updateTaskStatus(taskId, { status: 'DONE' });
      if (comment) {
        await taskService.addComment(taskId, comment);
      }
      setApprovalComments((current) => ({ ...current, [taskId]: '' }));
      await refetch();
      toast.success('Đã phê duyệt hoàn thành công việc!');
    } catch (error) {
      console.error('Không thể phê duyệt task:', error);
      toast.error('Không thể phê duyệt công việc. Vui lòng thử lại.');
    }
  };

  const handleRequestChanges = async (taskId: string) => {
    const comment = approvalComments[taskId]?.trim() || 'Yêu cầu chỉnh sửa bổ sung theo góp ý từ quản lý.';
    try {
      await taskService.updateTaskStatus(taskId, { status: 'TODO' });
      await taskService.addComment(taskId, comment);
      setApprovalComments((current) => ({ ...current, [taskId]: '' }));
      await refetch();
    } catch (error) {
      console.error('Không thể gửi yêu cầu chỉnh sửa:', error);
    }
  };

  const renderTaskModal = () => {
    const items = paginatedList as DashboardTaskItem[];

    return (
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/60 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            Không có công việc phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          items.map((task) => (
            <div key={task.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{task.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.project?.name ?? 'Không xác định dự án'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityStyles[task.priority] ?? priorityStyles.MEDIUM}`}>
                  {formatPriority(task.priority)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                <span className={`rounded-full px-2 py-1 ${statusStyles[task.status] ?? statusStyles.TODO}`}>
                  {formatStatus(task.status)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">Assignee: {task.assignee?.name ?? 'Chưa phân công'}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">Hạn: {formatDate(task.dueDate)}</span>
                {task.overdueDays && task.overdueDays > 0 ? (
                  <span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-500">Trễ {task.overdueDays} ngày</span>
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(task.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-500 hover:text-white dark:border-indigo-500/40 dark:text-indigo-300"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Xem chi tiết
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const modalTitle = activeModal === 'team' ? 'Nhân sự trong nhóm' : activeModal === 'projects' ? 'Dự án đang hoạt động' : 'Công việc';

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">Manager Control & Analytics Hub</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Xin chào, {user?.name}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Trung tâm điều hành quản trị với góc nhìn tổng thể về nguồn lực, tiến độ dự án và phê duyệt công việc.
          </p>
        </header>

        {isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            Không thể tải dữ liệu nhóm. Vui lòng thử tải lại.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800" />
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800" />
              <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800" />
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map(({ label, value, icon: Icon, modal, filter }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (modal) {
                      setActiveModal(modal);
                      if (filter) setTaskFilter(filter);
                    }
                  }}
                  className="group rounded-3xl border border-slate-200 bg-white/90 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80"
                >
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>{label}</span>
                    <Icon className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="mt-6 flex items-end justify-between gap-3">
                    <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
                    <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-300">
                      {label.includes('quá hạn') ? 'Priority' : 'Insight'}
                    </span>
                  </div>
                </button>
              ))}
            </section>

            <DashboardAiResponse
              content={aiSummary}
              isLoading={isAiLoading}
              error={aiError}
              onAnalyze={() => void handleAiAnalysis()}
              title="AI Management Assistant"
              buttonLabel="✨ AI Phân tích rủi ro"
            />

            <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Hiệu suất Nhân sự Phòng ban</h2>
                  <UserCheck className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-3 font-medium">Nhân viên</th>
                          <th className="px-3 py-3 font-medium">Task</th>
                          <th className="px-3 py-3 font-medium">Đúng hạn</th>
                          <th className="px-3 py-3 font-medium">Trễ hạn</th>
                          <th className="px-3 py-3 font-medium">Đóng góp</th>
                          <th className="px-3 py-3 font-medium">KPI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {staffMembers.length > 0 ? (
                          staffMembers.map((member) => (
                            <tr key={member.id} className="bg-white transition hover:bg-slate-50 dark:bg-slate-900/60 dark:hover:bg-slate-800/80">
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
                                    {member.avatar ? (
                                      <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" />
                                    ) : (
                                      member.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-800 dark:text-slate-200">{member.name}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{member.role}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{member.tasksAssigned}</td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{member.tasksOnTime}</td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{member.tasksLate}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-indigo-500" style={{ width: `${Math.min(member.contributionRate, 100)}%` }} />
                                  </div>
                                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{member.contributionRate}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{member.kpiScore}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                              Chưa có dữ liệu nhân sự để hiển thị.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Trung tâm Phê duyệt Công việc</h2>
                  <BarChart3 className="h-5 w-5 text-violet-500" />
                </div>
                <div className="space-y-3">
                  {approvalQueue.length > 0 ? (
                    approvalQueue.map((task) => (
                      <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-100">{task.title}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.project?.name ?? 'Không xác định'} · {task.assignee?.name ?? 'Chưa phân công'}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${priorityStyles[task.priority] ?? priorityStyles.MEDIUM}`}>
                            {formatPriority(task.priority)}
                          </span>
                        </div>

                        <textarea
                          value={approvalComments[task.id] ?? ''}
                          onChange={(event) =>
                            setApprovalComments((current) => ({
                              ...current,
                              [task.id]: event.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="Nhập nhận xét hoặc lưu ý..."
                          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 transition focus:border-indigo-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        />

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleApproveTask(task.id)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
                          >
                            <Check className="h-4 w-4" />
                            Phê duyệt
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRequestChanges(task.id)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-600 transition hover:bg-amber-500 hover:text-white dark:text-amber-300"
                          >
                            <X className="h-4 w-4" />
                            Yêu cầu sửa
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                      Không có task nào đang chờ duyệt.
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Phân bổ Trạng thái Task</h2>
                  <BarChart3 className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={5}>
                        {chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  {chartData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 rounded-xl bg-slate-100 px-2 py-1.5 dark:bg-slate-800">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      {entry.name === 'TO_DO' ? 'To Do' : entry.name === 'IN_PROGRESS' ? 'In Progress' : entry.name === 'REVIEW' ? 'Review' : 'Done'}: {entry.value}
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tiến độ Xu hướng Công việc</h2>
                  <Clock3 className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.weeklyTrend ?? []} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="completed" radius={[8, 8, 0, 0]} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dự án trong phạm vi quản lý</h2>
                  <FolderKanban className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="space-y-4">
                  {projectList.length > 0 ? (
                    projectList.map((project) => (
                      <div key={project.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{project.name}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(project.startDate)} → {formatDate(project.endDate)}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyles[project.status] ?? statusStyles.TODO}`}>
                            {project.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>Tiến độ tổng thể</span>
                            <span>{project.progress}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${project.progress}%` }} />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex -space-x-2">
                            {project.members.slice(0, 4).map((member) => (
                              <div key={member.id} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-200 text-[10px] font-semibold text-slate-600 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-200">
                                {member.avatar ? <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" /> : member.name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                          </div>
                          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                            <div>Ngân sách thời gian</div>
                            <strong className="text-slate-800 dark:text-slate-100">{project.budgetDays} ngày</strong>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Chưa có dự án thuộc phạm vi quản lý.
                    </div>
                  )}
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Công việc gần đây</h2>
                  <Clock3 className="h-5 w-5 text-cyan-500" />
                </div>
                <div className="space-y-3">
                  {(data?.recentTasks ?? []).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-indigo-500/40 dark:hover:bg-slate-700"
                    >
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.project?.name ?? 'Không xác định'}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${priorityStyles[task.priority] ?? priorityStyles.MEDIUM}`}>
                        {formatPriority(task.priority)}
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-md sm:p-4">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-2xl dark:border-slate-700 dark:bg-slate-900/95 sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Detail Modal</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{modalTitle}</h3>
              </div>
              <button type="button" onClick={() => setActiveModal(null)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={modalSearch}
                    onChange={(event) => {
                      setModalSearch(event.target.value);
                      setModalPage(1);
                    }}
                    placeholder={activeModal === 'team' ? 'Tìm kiếm nhân viên...' : activeModal === 'projects' ? 'Tìm kiếm dự án...' : 'Tìm kiếm công việc...'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>

                {activeModal === 'tasks' && (
                  <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setTaskFilter('completed')}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${taskFilter === 'completed' ? 'bg-indigo-500 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      Hoàn thành
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskFilter('overdue')}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${taskFilter === 'overdue' ? 'bg-indigo-500 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      Quá hạn
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
              {activeModal === 'team' && (
                <div className="space-y-3">
                  {paginatedList.map((member) => {
                    const typedMember = member as DashboardMember;
                    const memberTasks = (data?.recentTasks ?? []).filter((task) => task.assignee?.id === typedMember.id);
                    return (
                      <div key={typedMember.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">
                              {typedMember.avatar ? <img src={typedMember.avatar} alt={typedMember.name} className="h-full w-full object-cover" /> : typedMember.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{typedMember.name}</p>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${typedMember.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'}`}>
                                  {typedMember.isActive ? 'Hoạt động' : 'Không hoạt động'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{typedMember.role} · {typedMember.department?.name ?? 'Chưa có phòng ban'}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-900">Task đang gán: {typedMember.tasksAssigned}</span>
                            <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-900">KPI: {typedMember.kpiScore}</span>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>Tỷ lệ hoàn thành</span>
                            <span>{typedMember.contributionRate}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-indigo-500" style={{ width: `${typedMember.contributionRate}%` }} />
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Task trễ hạn: {typedMember.tasksLate}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedMemberId(selectedMemberId === typedMember.id ? null : typedMember.id)}
                            className="rounded-xl border border-indigo-200 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-500 hover:text-white dark:border-indigo-500/40 dark:text-indigo-300"
                          >
                            {selectedMemberId === typedMember.id ? 'Ẩn task' : 'Xem task cá nhân'}
                          </button>
                        </div>

                        {selectedMemberId === typedMember.id && (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Task cá nhân</div>
                            <div className="space-y-2">
                              {memberTasks.length > 0 ? memberTasks.slice(0, 3).map((task) => (
                                <button
                                  key={task.id}
                                  type="button"
                                  onClick={() => setSelectedTaskId(task.id)}
                                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-left text-xs dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <span className="text-slate-700 dark:text-slate-200">{task.title}</span>
                                  <span className="text-indigo-600 dark:text-indigo-300">Xem</span>
                                </button>
                              )) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Nhân sự này chưa có task nào được giao.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {activeModal === 'projects' && (
                <div className="space-y-3">
                  {paginatedList.map((project) => {
                    const typedProject = project as DashboardProject;
                    return (
                      <div key={typedProject.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{typedProject.name}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(typedProject.startDate)} - {formatDate(typedProject.endDate)}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyles[typedProject.status] ?? statusStyles.TODO}`}>
                            {typedProject.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                          <div>
                            <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                              <span>Tiến độ tổng thể</span>
                              <span>{typedProject.progress}%</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${typedProject.progress}%` }} />
                            </div>
                          </div>
                          <div className="rounded-xl bg-white p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            <div>Ngân sách thời gian</div>
                            <strong className="text-slate-800 dark:text-slate-100">{typedProject.budgetDays} ngày</strong>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex -space-x-2">
                            {typedProject.members.slice(0, 5).map((member) => (
                              <div key={member.id} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-200 text-[10px] font-semibold text-slate-700 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-200">
                                {member.avatar ? <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" /> : member.name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedTaskId((data?.recentTasks[0]?.id) ?? null)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          >
                            Xem tổng quan
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeModal === 'tasks' && renderTaskModal()}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Trang {modalPage}/{totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalPage((current) => Math.max(1, current - 1))}
                  disabled={modalPage === 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Trước
                </button>
                <button
                  type="button"
                  onClick={() => setModalPage((current) => Math.min(totalPages, current + 1))}
                  disabled={modalPage >= totalPages}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Sau
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          canEditSubtasks={true}
          canAssignTask={true}
          usersList={staffMembers.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email ?? '',
            avatar: member.avatar ?? undefined,
          }))}
          onTaskUpdated={() => {
            void refetch();
          }}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </main>
  );
};

export default ManagerDashboardPage;

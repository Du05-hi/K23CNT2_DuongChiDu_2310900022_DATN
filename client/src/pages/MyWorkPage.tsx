import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Search,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient } from '@/api/apiClient';
import DashboardAiResponse from '@/components/DashboardAiResponse';
import TaskDetailsModal from '@/components/TaskDetailsModal';
import { useAuth } from '@/hooks/useAuth';
import aiService from '@/services/aiService';
import taskService, { type Task, type TaskStatus } from '@/services/taskService';

interface MyTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  project: { id: string; name: string; status?: string; description?: string | null };
  assignee?: { id: string; name: string; avatar?: string | null } | null;
  creator?: { id: string; name: string; avatar?: string | null } | null;
  subTasks?: Array<{ id: string; title: string; isCompleted: boolean }>;
  attachments?: Array<{ id: string; fileName: string }>;
  progress?: number;
  attachmentsCount?: number;
  subtaskCount?: number;
  completedSubtaskCount?: number;
  isOverdue?: boolean;
  isUpcomingDeadline?: boolean;
  hoursUntilDue?: number | null;
}

interface MyWorkResponse {
  summary: {
    TODO: number;
    IN_PROGRESS: number;
    REVIEW: number;
    DONE: number;
    overdue: number;
    upcomingWithin48h: number;
    total: number;
  };
  tasks: MyTask[];
  kpiHistory: Array<{ period: string; totalScore: number; rank: string; tasksCompleted: number; tasksOnTime: number }>;
  monthlyKpi: { totalScore: number; rank: string; tasksCompleted: number; tasksOnTime: number } | null;
  upcomingDeadlines: MyTask[];
}

const statusStyles: Record<string, string> = {
  TODO: 'bg-slate-500/10 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-700 border border-blue-200 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200',
  REVIEW: 'bg-amber-500/10 text-amber-700 border border-amber-200 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  DONE: 'bg-emerald-500/10 text-emerald-700 border border-emerald-200 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
};

const priorityStyles: Record<string, string> = {
  LOW: 'bg-emerald-500/10 text-emerald-700 border border-emerald-200 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  MEDIUM: 'bg-amber-500/10 text-amber-700 border border-amber-200 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200',
  HIGH: 'bg-orange-500/10 text-orange-700 border border-orange-200 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-200',
  URGENT: 'bg-rose-500/10 text-rose-700 border border-rose-200 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200',
};

const tabs = ['ALL', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
type TabType = (typeof tabs)[number];

const formatStatus = (status: string) => {
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
      return status;
  }
};

const formatPriority = (priority?: string) => {
  if (!priority) return 'Medium';
  return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getDueCountdown = (value?: string | null) => {
  if (!value) return 'Không giới hạn';
  const target = new Date(value).getTime();
  const now = Date.now();
  const diffHours = (target - now) / 3600000;
  const diffDays = diffHours / 24;

  if (diffHours <= 0) return 'Quá hạn';
  if (diffDays >= 1) return `${Math.max(1, Math.ceil(diffDays))} ngày`;
  return `${Math.max(1, Math.ceil(diffHours))} giờ`;
};

const MyWorkPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState<TabType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'URGENT'>('ALL');
  const [deadlineFilter, setDeadlineFilter] = useState<'ALL' | '24H' | '48H'>('ALL');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [taskModalType, setTaskModalType] = useState<'TODO' | 'IN_PROGRESS' | 'DONE' | 'overdue' | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalPage, setModalPage] = useState(1);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<MyWorkResponse>({
    queryKey: ['my-work'],
    queryFn: async () => {
      const response = await apiClient.get<MyWorkResponse>('/tasks/my-tasks');
      return response.data;
    },
  });

  const tasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesTab = selectedTab === 'ALL' || task.status === selectedTab;
      const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter;
      const matchesQuery = !query || task.title.toLowerCase().includes(query) || task.project?.name.toLowerCase().includes(query);
      const matchesDeadline =
        deadlineFilter === 'ALL' ||
        (deadlineFilter === '24H' && Boolean(task.hoursUntilDue !== null && task.hoursUntilDue !== undefined && task.hoursUntilDue <= 24 && task.hoursUntilDue > 0)) ||
        (deadlineFilter === '48H' && Boolean(task.hoursUntilDue !== null && task.hoursUntilDue !== undefined && task.hoursUntilDue <= 48 && task.hoursUntilDue > 0));

      return matchesTab && matchesPriority && matchesQuery && matchesDeadline;
    });
  }, [deadlineFilter, priorityFilter, searchQuery, selectedTab, tasks]);

  const statCards = [
    { label: 'Cần thực hiện', value: data?.summary.TODO ?? 0, icon: Target, type: 'TODO' as const },
    { label: 'Đang thực hiện', value: data?.summary.IN_PROGRESS ?? 0, icon: Clock3, type: 'IN_PROGRESS' as const },
    { label: 'Đã hoàn thành', value: data?.summary.DONE ?? 0, icon: CheckCircle2, type: 'DONE' as const },
    { label: 'Quá hạn', value: data?.summary.overdue ?? 0, icon: AlertTriangle, type: 'overdue' as const },
  ];

  const cardModalItems = useMemo(() => {
    if (!taskModalType) return [];
    if (taskModalType === 'overdue') {
      return tasks.filter((task) => task.isOverdue);
    }
    return tasks.filter((task) => task.status === taskModalType);
  }, [taskModalType, tasks]);

  const modalItems = useMemo(() => {
    const list = [...cardModalItems];
    if (!modalSearch.trim()) return list;
    const query = modalSearch.trim().toLowerCase();
    return list.filter((task) => task.title.toLowerCase().includes(query) || task.project?.name.toLowerCase().includes(query));
  }, [cardModalItems, modalSearch]);

  const totalPages = Math.max(1, Math.ceil(modalItems.length / 4));
  const paginatedModalItems = modalItems.slice((modalPage - 1) * 4, modalPage * 4);

  const handleSubtaskToggle = async (taskId: string, subTaskId: string, isCompleted: boolean) => {
    try {
      await taskService.updateSubTask(taskId, subTaskId, !isCompleted);
      await refetch();
    } catch (error) {
      console.error('Không thể cập nhật subtask:', error);
    }
  };

  const handleQuickStatus = async (taskId: string, nextStatus: TaskStatus) => {
    try {
      await taskService.updateTaskStatus(taskId, { status: nextStatus });
      await refetch();
    } catch (error) {
      console.error('Không thể cập nhật trạng thái task:', error);
    }
  };

  const handlePersonalAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiSummary(null);
    setAiError(null);
    try {
      setAiSummary(await aiService.generateMyWorkInsights());
    } catch (error) {
      console.error('Không thể phân tích công việc cá nhân:', error);
      setAiError(error instanceof Error ? error.message : 'Không thể lấy phân tích từ AI. Vui lòng thử lại.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const kpiChartData = (data?.kpiHistory ?? []).map((entry) => ({
    month: entry.period.slice(5),
    score: entry.totalScore,
  }));

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-500">Personal Work & Productivity Center</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Công việc của {user?.name}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Theo dõi tiến độ cá nhân, deadline khẩn cấp, subtask và KPI hiệu suất trong một trung tâm làm việc doanh nghiệp.</p>
            </div>
            <button
              type="button"
              onClick={() => setKpiOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
            >
              <TrendingUp className="h-4 w-4" />
              KPI Analytics
            </button>
          </div>
        </header>

        {isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
            Không thể tải dữ liệu công việc cá nhân. Vui lòng thử lại.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="h-[420px] animate-pulse rounded-3xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800" />
              <div className="h-[420px] animate-pulse rounded-3xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800" />
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map(({ label, value, icon: Icon, type }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTaskModalType(type === 'overdue' ? 'overdue' : type)}
                  className="group rounded-[28px] border border-slate-200 bg-white/90 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/80"
                >
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>{label}</span>
                    <span className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-300">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-300">
                      Live
                    </span>
                  </div>
                </button>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <article className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Đánh giá hiệu suất</p>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Dòng thời gian deadline khẩn cấp</h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                    {['24H', '48H'].map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setDeadlineFilter(range as '24H' | '48H')}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${deadlineFilter === range ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {(data?.upcomingDeadlines ?? []).length ? (
                    (data?.upcomingDeadlines ?? []).slice(0, 5).map((task) => (
                      <div key={task.id} className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3 dark:border-rose-500/30 dark:bg-rose-500/5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{task.title}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.project?.name} • {task.assignee?.name ?? 'Bạn'}</p>
                          </div>
                          <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600 dark:text-rose-300">
                            {task.priority}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>Hạn: {formatDate(task.dueDate)}</span>
                          <span className="font-semibold text-rose-600 dark:text-rose-300">{getDueCountdown(task.dueDate)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                      Không có deadline trong khoảng 48h tới.
                    </div>
                  )}
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">KPI tháng hiện tại</p>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Hiệu suất cá nhân</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKpiOpen(true)}
                    className="rounded-xl border border-indigo-200 bg-indigo-500/10 p-2 text-indigo-600 transition hover:bg-indigo-500 hover:text-white dark:border-indigo-500/30 dark:text-indigo-300"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {data?.monthlyKpi ? (
                  <>
                    <p className="mt-6 text-4xl font-bold text-indigo-500">{data.monthlyKpi.totalScore.toFixed(1)} <span className="text-base text-slate-400">/ 100</span></p>
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-200">{data.monthlyKpi.rank}</span>
                      <span>{data.monthlyKpi.tasksOnTime} / {data.monthlyKpi.tasksCompleted} đúng hạn</span>
                    </div>
                    <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400" style={{ width: `${Math.min(100, data.monthlyKpi.totalScore)}%` }} />
                    </div>
                    <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                        <span>Task hoàn thành</span>
                        <strong>{data.monthlyKpi.tasksCompleted}</strong>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                        <span>Task đúng hạn</span>
                        <strong>{data.monthlyKpi.tasksOnTime}</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-6 text-sm text-slate-400">Chưa có dữ liệu KPI cho tháng hiện tại.</p>
                )}
              </article>
            </section>

            <DashboardAiResponse
              content={aiSummary}
              isLoading={isAiLoading}
              error={aiError}
              onAnalyze={() => void handlePersonalAiAnalysis()}
              title="AI Productivity Assistant"
              buttonLabel="✨ AI phân tích công việc"
            />

            <section className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Quản lý công việc</p>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Personal Work Board</h2>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Tìm công việc hoặc dự án..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value as 'ALL' | 'HIGH' | 'URGENT')}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="ALL">Tất cả ưu tiên</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedTab(tab)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${selectedTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                  >
                    {tab === 'ALL' ? 'Tất cả' : formatStatus(tab)}
                  </button>
                ))}
              </div>

              {filteredTasks.length ? (
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{task.title}</h3>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${priorityStyles[task.priority] ?? priorityStyles.MEDIUM}`}>
                              {formatPriority(task.priority)}
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusStyles[task.status] ?? statusStyles.TODO}`}>
                              {formatStatus(task.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span>{task.project?.name}</span>
                            <span>•</span>
                            <span>Hạn: {formatDate(task.dueDate)}</span>
                            <span>•</span>
                            <span>{task.attachmentsCount ?? task.attachments?.length ?? 0} attachment</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={task.status}
                            onChange={(event) => handleQuickStatus(task.id, event.target.value as TaskStatus)}
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            <option value="TODO">Cần làm</option>
                            <option value="IN_PROGRESS">Đang làm</option>
                            <option value="REVIEW">Gửi duyệt</option>
                            <option value="DONE">Hoàn thành</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setSelectedTaskId(task.id)}
                            className="rounded-xl border border-indigo-200 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-500 hover:text-white dark:border-indigo-500/30 dark:text-indigo-300"
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
                        <div>
                          <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>Progress</span>
                            <span>{task.progress ?? 0}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400" style={{ width: `${task.progress ?? 0}%` }} />
                          </div>
                          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span>Subtask: {task.completedSubtaskCount ?? 0}/{task.subtaskCount ?? task.subTasks?.length ?? 0}</span>
                            <span>•</span>
                            <span className={task.isOverdue ? 'text-rose-500' : 'text-emerald-500'}>{task.isOverdue ? 'Quá hạn' : getDueCountdown(task.dueDate)}</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/50">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Subtask tracker</p>
                          <div className="space-y-2">
                            {(task.subTasks ?? []).slice(0, 3).map((subtask) => (
                              <label key={subtask.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={subtask.isCompleted}
                                  onChange={() => handleSubtaskToggle(task.id, subtask.id, subtask.isCompleted)}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className={subtask.isCompleted ? 'line-through text-slate-400' : ''}>{subtask.title}</span>
                              </label>
                            ))}
                            {!(task.subTasks ?? []).length && <span className="text-xs text-slate-400">Chưa có subtask.</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  Không có công việc phù hợp với bộ lọc hiện tại.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {taskModalType && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-md sm:p-4">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900/95 sm:max-h-[calc(100dvh-2rem)] sm:p-5">
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Drill-down</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {taskModalType === 'overdue' ? 'Công việc quá hạn' : `Công việc ${formatStatus(taskModalType)}`}
                </h3>
              </div>
              <button type="button" onClick={() => setTaskModalType(null)} className="rounded-xl border border-slate-200 p-2 text-slate-500 dark:border-slate-700 dark:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex shrink-0 flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={modalSearch}
                  onChange={(event) => {
                    setModalSearch(event.target.value);
                    setModalPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="Tìm công việc theo tên hoặc dự án..."
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
              {paginatedModalItems.length ? (
                paginatedModalItems.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-indigo-500/30"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.project?.name} • {task.assignee?.name ?? 'Bạn'}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className={`rounded-full px-2 py-1 ${priorityStyles[task.priority] ?? priorityStyles.MEDIUM}`}>{formatPriority(task.priority)}</span>
                      <span>{formatDate(task.dueDate)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Không có dữ liệu phù hợp.
                </div>
              )}
            </div>

            <div className="mt-5 flex shrink-0 items-center justify-between">
              <button type="button" onClick={() => setModalPage((page) => Math.max(1, page - 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:text-slate-200">
                Trước
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-300">Trang {modalPage}/{totalPages}</span>
              <button type="button" onClick={() => setModalPage((page) => Math.min(totalPages, page + 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:text-slate-200">
                Sau
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          canEditSubtasks={true}
          canAssignTask={false}
          usersList={[]}
          onTaskUpdated={async () => {
            await refetch();
            setSelectedTaskId(null);
          }}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {kpiOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-md sm:p-4">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl min-h-0 flex-col overflow-y-auto overscroll-contain rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900/95 sm:max-h-[calc(100dvh-2rem)] sm:p-5">
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Interactive KPI Analytics</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Lịch sử KPI 6 tháng gần nhất</h3>
              </div>
              <button type="button" onClick={() => setKpiOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500 dark:border-slate-700 dark:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpiChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[10, 10, 0, 0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">Điểm định lượng</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{data?.monthlyKpi?.totalScore?.toFixed(1) ?? '0.0'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">Đúng hạn</p>
                <p className="mt-2 text-2xl font-bold text-emerald-500">{data?.monthlyKpi?.tasksOnTime ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">Hạng</p>
                <p className="mt-2 text-2xl font-bold text-violet-500">{data?.monthlyKpi?.rank ?? 'C'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default MyWorkPage;

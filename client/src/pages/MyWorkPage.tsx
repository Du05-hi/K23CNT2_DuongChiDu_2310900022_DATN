import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, Target } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/hooks/useAuth';

interface DashboardData {
  tasks: { total: number; TODO: number; IN_PROGRESS: number; REVIEW: number; DONE: number; overdue: number };
  monthlyKpi: { totalScore: number; rank: string; tasksCompleted: number; tasksOnTime: number } | null;
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    project: { id: string; name: string };
  }>;
}

interface MyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  project: { id: string; name: string };
}

const MyWorkPage: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-work'],
    queryFn: async () => {
      const [dashboardResponse, tasksResponse] = await Promise.all([
        apiClient.get<DashboardData>('/users/role-dashboard'),
        apiClient.get<MyTask[]>('/tasks/my-tasks'),
      ]);
      return {
        ...dashboardResponse.data,
        recentTasks: Array.isArray(tasksResponse.data) ? tasksResponse.data : [],
      };
    },
  });

  const stats = [
    { label: 'Cần thực hiện', value: data?.tasks?.TODO ?? 0, icon: Target },
    { label: 'Đang thực hiện', value: data?.tasks?.IN_PROGRESS ?? 0, icon: Clock3 },
    { label: 'Đã hoàn thành', value: data?.tasks?.DONE ?? 0, icon: CheckCircle2 },
    { label: 'Quá hạn', value: data?.tasks?.overdue ?? 0, icon: AlertTriangle },
  ];

  return (
    <main className="min-h-screen bg-[#0b0f19] p-4 text-slate-100 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-emerald-400">Không gian cá nhân</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Công việc của {user?.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Tiến độ và KPI hiển thị theo dữ liệu công việc thực tế của bạn.</p>
      </header>

      {isError && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">Không thể tải công việc của bạn. Vui lòng thử tải lại.</p>}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-400">Đang tải công việc...</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <article key={label} className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-sm">
                <div className="flex items-center justify-between text-sm text-slate-400">{label}<Icon className="h-5 w-5 text-emerald-400" /></div>
                <p className="mt-3 text-3xl font-bold text-white">{value}</p>
              </article>
            ))}
          </section>
          <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-white">Danh sách công việc được giao</h2>
              <div className="mt-4 divide-y divide-slate-800">
                {data?.recentTasks?.map((task) => (
                  <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <h3 className="font-medium text-slate-100">{task.title}</h3>
                      <p className="mt-1 text-xs text-slate-400">{task.project.name}{task.dueDate ? ` · Hạn ${new Date(task.dueDate).toLocaleDateString('vi-VN')}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{task.priority}</span>
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">{task.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                ))}
                {!data?.recentTasks?.length && <p className="py-6 text-sm text-slate-400">Bạn chưa được giao công việc nào.</p>}
              </div>
            </article>
            <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-sm">
              <h2 className="font-semibold text-white">KPI tháng hiện tại</h2>
              {data?.monthlyKpi ? (
                <>
                  <p className="mt-4 text-4xl font-bold text-indigo-400">{data.monthlyKpi.totalScore.toFixed(1)}<span className="text-base text-slate-400"> / 100</span></p>
                  <p className="mt-2 text-sm text-slate-300">Xếp loại {data.monthlyKpi.rank}</p>
                  <p className="mt-4 text-xs text-slate-400">{data.monthlyKpi.tasksOnTime} / {data.monthlyKpi.tasksCompleted} công việc hoàn thành đúng hạn</p>
                </>
              ) : <p className="mt-4 text-sm text-slate-400">Chưa có kết quả KPI cho kỳ này.</p>}
            </article>
          </section>
        </>
      )}
      </div>
    </main>
  );
};

export default MyWorkPage;

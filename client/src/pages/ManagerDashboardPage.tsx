import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, FolderKanban, Users } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';

interface DashboardData {
  teamSize: number;
  projects: { total: number; IN_PROGRESS: number };
  tasks: { total: number; DONE: number; IN_PROGRESS: number; overdue: number };
  recentProjects: Array<{ id: string; name: string; status: string; _count: { tasks: number; members: number } }>;
}

const ManagerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
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

  const stats = [
    { label: 'Nhân sự trong nhóm', value: data?.teamSize ?? 0, icon: Users },
    { label: 'Dự án đang hoạt động', value: data?.projects?.IN_PROGRESS ?? 0, icon: FolderKanban },
    { label: 'Công việc hoàn thành', value: data?.tasks?.DONE ?? 0, icon: CheckCircle2 },
    { label: 'Công việc quá hạn', value: data?.tasks?.overdue ?? 0, icon: AlertTriangle },
  ];

  return (
    <main className="min-h-screen bg-[#0b0f19] p-4 text-slate-100 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-indigo-400">Không gian quản lý</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Xin chào, {user?.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Theo dõi dự án, tiến độ và công việc thuộc phạm vi quản lý của bạn.</p>
      </header>

      {isError && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">Không thể tải dữ liệu nhóm. Vui lòng thử tải lại.</p>}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-400">Đang tải số liệu từ hệ thống...</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <article key={label} className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-sm">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  {label}<Icon className="h-5 w-5 text-indigo-400" />
                </div>
                <p className="mt-3 text-3xl font-bold text-white">{value}</p>
              </article>
            ))}
          </section>
          <section className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-white">Dự án trong phạm vi của bạn</h2>
            <div className="mt-4 divide-y divide-slate-800">
              {data?.recentProjects?.map((project) => (
                <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <h3 className="font-medium text-slate-100">{project.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">{project._count.members} thành viên · {project._count.tasks} công việc</p>
                  </div>
                  <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-300">{project.status.replace('_', ' ')}</span>
                </div>
              ))}
              {!data?.recentProjects?.length && <p className="py-6 text-sm text-slate-400">Chưa có dự án trong phạm vi quản lý.</p>}
            </div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
              <h2 className="font-semibold text-white">Tiến độ công việc</h2>
              <p className="mt-3 text-sm text-slate-300">{data?.tasks?.IN_PROGRESS ?? 0} đang thực hiện / {data?.tasks?.total ?? 0} tổng công việc</p>
            </article>
            <article className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
              <h2 className="font-semibold text-white">Việc cần ưu tiên</h2>
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-300"><Clock3 className="h-4 w-4" />{data?.tasks?.overdue ?? 0} công việc đã quá hạn cần xử lý.</p>
            </article>
          </section>
        </>
      )}
      </div>
    </main>
  );
};

export default ManagerDashboardPage;

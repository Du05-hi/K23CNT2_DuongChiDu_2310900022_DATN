import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Award,
  TrendingUp,
  Download,
  Calculator,
  Users,
  Target,
  Sparkles,
  Calendar,
  Building,
  CheckCircle2,
  ChevronDown,
  ArrowUpRight,
  Loader2,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks/useAuth';

interface KpiEmployeeRecord {
  id: string;
  name: string;
  avatar?: string | null;
  departmentId?: string | null;
  department: string;
  tasksCompleted: number;
  tasksOnTime: number;
  qualityScore: number;
  scoreBreakdown: {
    taskCompletion: number;
    onTime: number;
    bonus: number;
  };
  kpiScore: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  badges: string[];
}

export const KpiPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch KPI data
  const { data: employees = [], isLoading, isError } = useQuery({
    queryKey: ['kpiEmployees', selectedMonth, selectedDept],
    queryFn: async () => {
      const res = await apiClient.get<KpiEmployeeRecord[]>('/kpi/report', {
        params: { period: selectedMonth, departmentId: selectedDept },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await apiClient.get<Array<{ id: string; name: string }>>('/users/departments');
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const { data: trends = [] } = useQuery({
    queryKey: ['kpiTrends', selectedMonth],
    queryFn: async () => {
      const response = await apiClient.get<{ trends: Array<{ period: string; averageScore: number }> }>(
        '/kpi/dashboard',
        { params: { period: selectedMonth } }
      );
      return response.data.trends ?? [];
    },
  });

  const filteredEmployees = employees;

  const scores = filteredEmployees.map((e) => e.kpiScore);
  const avgScore = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : '0';
  const maxScore = scores.length ? Math.max(...scores).toFixed(1) : '0';
  const minScore = scores.length ? Math.min(...scores).toFixed(1) : '0';
  const targetAchievedCount = filteredEmployees.filter((e) => e.kpiScore >= 80).length;
  const bestPerformer = [...filteredEmployees].sort((a, b) => b.kpiScore - a.kpiScore)[0];

  // AI Calculate KPI action
  const handleCalculateKPI = async () => {
    setIsCalculating(true);
    try {
      await apiClient.post('/kpi/calculate', {
        period: selectedMonth,
        departmentId: selectedDept,
      });
      toast.success('Đã tính toán lại điểm KPI cho nhân sự trong phạm vi được phép.');
      queryClient.invalidateQueries({ queryKey: ['kpiEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['kpiTrends'] });
    } catch (error: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      toast.error(message || 'Không thể tính KPI. Vui lòng kiểm tra quyền truy cập và kết nối máy chủ.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Export CSV
  const handleExportExcel = () => {
    const headers = [
      'ID,Họ và tên,Phòng ban,Tasks hoàn thành,Đúng hạn,Điểm chất lượng,Điểm KPI,Xếp loại',
    ];
    const rows = filteredEmployees.map(
      (e) =>
        `"${e.id}","${e.name}","${e.department}",${e.tasksCompleted},${e.tasksOnTime},${e.qualityScore},${e.kpiScore},"${e.rank}"`
    );

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Bao_Cao_KPI_${selectedMonth}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Đã xuất file báo cáo KPI (.CSV) thành công! 📊');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-8">
      {/* Header and Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Đánh Giá Hiệu Suất Tự Động
            </span>
            <span className="text-xs text-slate-400">Chu kỳ {selectedMonth}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {user?.role === 'EMPLOYEE' ? 'Kết quả KPI cá nhân' : 'Quản Lý KPI & Báo Cáo Hiệu Suất'}
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {user?.role !== 'EMPLOYEE' && (
            <button
              type="button"
              onClick={handleCalculateKPI}
              disabled={isCalculating}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
            >
              {isCalculating ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Đang tính KPI...</span></> : <><Calculator className="w-4 h-4" /><span>Tính toán KPI</span></>}
            </button>
          )}

          {user?.role !== 'EMPLOYEE' && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-xl hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Xuất Excel (.CSV)</span>
            </button>
          )}
        </div>
      </div>

      {user?.role === 'EMPLOYEE' ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div>
              <h2 className="font-semibold text-white">Đánh giá tháng {selectedMonth}</h2>
              <p className="mt-1 text-xs text-slate-400">Kết quả được tính từ các công việc hoàn thành trong kỳ.</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Calendar className="h-4 w-4 text-indigo-400" />
              Kỳ đánh giá
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          </div>

          {isError ? (
            <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">
              Không tải được kết quả KPI cá nhân. Vui lòng thử lại sau.
            </p>
          ) : isLoading ? (
            <p className="py-12 text-center text-sm text-slate-400">Đang tải kết quả KPI...</p>
          ) : !filteredEmployees[0] ? (
            <p className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
              Chưa có kết quả KPI cho tháng {selectedMonth}.
            </p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <article className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/70 to-slate-900 p-6">
                <p className="text-sm font-medium text-indigo-200">Điểm KPI tổng</p>
                <p className="mt-3 text-5xl font-extrabold text-white">
                  {filteredEmployees[0].kpiScore.toFixed(1)}
                  <span className="ml-2 text-base font-medium text-slate-400">/ 100</span>
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                    style={{ width: `${Math.min(filteredEmployees[0].kpiScore, 100)}%` }}
                  />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-slate-300">{filteredEmployees[0].name}</span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Xếp loại {filteredEmployees[0].rank}
                  </span>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-base font-semibold text-white">Chi tiết điểm đánh giá</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 text-xs text-slate-400">
                      <tr>
                        <th className="py-3 pr-4 font-medium">Tiêu chí</th>
                        <th className="py-3 text-right font-medium">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-200">
                      <tr>
                        <td className="py-3 pr-4">Công việc hoàn thành</td>
                        <td className="py-3 text-right font-semibold">{filteredEmployees[0].tasksCompleted}</td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4">Hoàn thành đúng hạn</td>
                        <td className="py-3 text-right font-semibold">
                          {filteredEmployees[0].tasksOnTime} ({filteredEmployees[0].qualityScore}%)
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4">Điểm hoàn thành công việc</td>
                        <td className="py-3 text-right font-semibold">{filteredEmployees[0].scoreBreakdown.taskCompletion.toFixed(1)}</td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4">Điểm đúng hạn</td>
                        <td className="py-3 text-right font-semibold">{filteredEmployees[0].scoreBreakdown.onTime.toFixed(1)}</td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4">Điểm thưởng ưu tiên</td>
                        <td className="py-3 text-right font-semibold">{filteredEmployees[0].scoreBreakdown.bonus.toFixed(1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Điểm KPI tổng được giới hạn tối đa 100 điểm.
                </p>
              </article>
            </div>
          )}
        </section>
      ) : (
        <>
      {isError && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">Không tải được báo cáo KPI từ máy chủ.</p>}
      {!isLoading && !isError && filteredEmployees.length === 0 && (
        <p className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
          Chưa có dữ liệu KPI cho kỳ {selectedMonth}. Quản trị viên hoặc quản lý có thể tính KPI sau khi công việc được cập nhật.
        </p>
      )}

      {/* Filter Selectors */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span className="text-xs text-slate-300 font-medium">Kỳ đánh giá:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {user?.role === 'ADMIN' && (
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-300 font-medium">Phòng ban:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">Tất cả phòng ban</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium uppercase">Điểm Trung Bình Nhóm</span>
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{avgScore} <span className="text-xs text-slate-400 font-normal">/ 100</span></div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{filteredEmployees.length} nhân sự có kết quả trong kỳ</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium uppercase">Điểm Cao Nhất</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-300 mb-1">{maxScore} <span className="text-xs text-slate-400 font-normal">đ</span></div>
          <div className="text-xs text-slate-400">{bestPerformer ? `${bestPerformer.name} (Hạng ${bestPerformer.rank})` : 'Chưa có kết quả'}</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium uppercase">Điểm Thấp Nhất</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-300 mb-1">{minScore} <span className="text-xs text-slate-400 font-normal">đ</span></div>
          <div className="text-xs text-slate-400">{filteredEmployees.length ? 'Điểm KPI thấp nhất trong kỳ đã chọn' : 'Chưa có kết quả'}</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium uppercase">Đạt Chỉ Tiêu (≥80đ)</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 mb-1">
            {targetAchievedCount} / {filteredEmployees.length}
          </div>
          <div className="text-xs text-slate-400">
              Tỷ lệ đạt chuẩn: {filteredEmployees.length ? Math.round((targetAchievedCount / filteredEmployees.length) * 100) : 0}%
            </div>
          </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* BarChart: Employee Comparison */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart className="w-4 h-4 text-indigo-400" />
                So Sánh Điểm KPI Từng Nhân Viên
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Xếp hạng theo điểm tổng hợp kỳ hiện tại</p>
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredEmployees.map((e) => ({
                  name: e.name.split(' ').slice(-1)[0],
                  fullName: e.name,
                  score: e.kpiScore,
                  quality: e.qualityScore,
                }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" domain={[50, 100]} tick={{ fontSize: 11 }} />
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
                <Bar dataKey="score" name="Điểm KPI Tổng" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="quality" name="Tỷ lệ đúng hạn (%)" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LineChart: Historical Trend */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Xu Hướng KPI 6 Tháng Gần Nhất
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Điểm trung bình KPI theo dữ liệu đã lưu</p>
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="period" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" domain={[60, 100]} tick={{ fontSize: 11 }} />
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
                <Line
                  type="monotone"
                  dataKey="averageScore"
                  name="Điểm trung bình"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leaderboard Table Section */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Bảng Xếp Hạng Leaderboard Nhân Sự
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Top 3 nhận được huy hiệu vinh danh và tiền thưởng năng suất tháng
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            Tổng cộng: {filteredEmployees.length} nhân sự
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold sticky top-0">
                <th className="py-3.5 px-4 w-16 text-center">Hạng</th>
                <th className="py-3.5 px-4">Nhân sự</th>
                <th className="py-3.5 px-4">Phòng ban</th>
                <th className="py-3.5 px-4 text-center">Tasks Hoàn thành</th>
                <th className="py-3.5 px-4 text-center">Đúng hạn</th>
                <th className="py-3.5 px-4 w-44">Tiến độ KPI</th>
                <th className="py-3.5 px-4 text-right">Điểm KPI</th>
                <th className="py-3.5 px-4 text-center">Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEmployees.map((emp, index) => {
                const rankNum = index + 1;
                const isTop1 = rankNum === 1;
                const isTop2 = rankNum === 2;
                const isTop3 = rankNum === 3;

                const rowBg = isTop1
                  ? 'bg-amber-500/[0.07] border-l-4 border-l-amber-400'
                  : isTop2
                  ? 'bg-slate-400/[0.05] border-l-4 border-l-slate-300'
                  : isTop3
                  ? 'bg-orange-500/[0.05] border-l-4 border-l-orange-400'
                  : 'hover:bg-slate-800/30';

                return (
                  <motion.tr
                    key={emp.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`transition-colors ${rowBg}`}
                  >
                    <td className="py-3 px-4 text-center font-bold">
                      {isTop1 ? (
                        <span className="text-xl">🥇</span>
                      ) : isTop2 ? (
                        <span className="text-xl">🥈</span>
                      ) : isTop3 ? (
                        <span className="text-xl">🥉</span>
                      ) : (
                        <span className="text-slate-400 font-semibold">#{rankNum}</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {emp.avatar ? (
                          <img src={emp.avatar} alt={emp.name} className="w-9 h-9 rounded-full object-cover border border-white/20" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                            {emp.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            {emp.name}
                            {isTop1 && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {emp.badges.map((b, bIdx) => (
                              <span
                                key={bIdx}
                                className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-300">{emp.department}</td>

                    <td className="py-3 px-4 text-center font-medium text-slate-200">
                      {emp.tasksCompleted}
                    </td>

                    <td className="py-3 px-4 text-center font-medium text-emerald-400">
                      {emp.tasksOnTime}
                    </td>

                    <td className="py-3 px-4">
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full"
                          style={{ width: `${Math.min(emp.kpiScore, 100)}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-extrabold text-sm text-emerald-400">
                      {emp.kpiScore}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                          emp.rank === 'S'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : emp.rank === 'A'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : emp.rank === 'B'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}
                      >
                        Hạng {emp.rank}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default KpiPage;

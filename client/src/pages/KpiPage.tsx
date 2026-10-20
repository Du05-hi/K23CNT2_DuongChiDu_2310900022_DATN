import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Printer,
  ChevronDown,
  ArrowUpRight,
  Loader2,
  Flame,
  Crown,
  Medal,
  Star,
  CheckSquare,
  FileSpreadsheet,
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
  scoreBreakdown?: {
    taskCompletion?: number;
    onTime?: number;
    bonus?: number;
    priority?: number;
  };
  kpiScore: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  badges?: string[];
}

export const KpiPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Period state
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedQuarter, setSelectedQuarter] = useState('Q4');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active computed period string
  const activePeriod = useMemo(() => {
    if (periodType === 'quarter') return `${selectedYear}-${selectedQuarter}`;
    if (periodType === 'year') return selectedYear;
    return selectedMonth;
  }, [periodType, selectedYear, selectedQuarter, selectedMonth]);

  // Fetch KPI data
  const { data: employees = [], isLoading, isError } = useQuery({
    queryKey: ['kpiEmployees', activePeriod, selectedDept],
    queryFn: async () => {
      const res = await apiClient.get<KpiEmployeeRecord[]>('/kpi/report', {
        params: { period: activePeriod, departmentId: selectedDept },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // Fetch Departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await apiClient.get<Array<{ id: string; name: string }>>('/users/departments');
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  // Fetch Trends
  const { data: trends = [] } = useQuery({
    queryKey: ['kpiTrends', activePeriod],
    queryFn: async () => {
      const response = await apiClient.get<{ trends: Array<{ period: string; averageScore: number }> }>(
        '/kpi/dashboard',
        { params: { period: activePeriod } }
      );
      return response.data?.trends ?? [];
    },
  });

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [employees, searchQuery]);

  // Top 3 Leaderboard
  const leaderboard = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => b.kpiScore - a.kpiScore).slice(0, 3);
  }, [filteredEmployees]);

  // Aggregate stats
  const scores = filteredEmployees.map((e) => e.kpiScore);
  const avgScore = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : '0';
  const targetAchievedCount = filteredEmployees.filter((e) => e.kpiScore >= 80).length;

  // AI Calculate KPI action
  const handleCalculateKPI = async () => {
    setIsCalculating(true);
    try {
      await apiClient.post('/kpi/calculate', {
        period: activePeriod,
        departmentId: selectedDept,
      });
      toast.success('Đã tính toán lại điểm KPI toàn diện cho đội ngũ.');
      await queryClient.invalidateQueries({ queryKey: ['kpiEmployees'] });
      await queryClient.invalidateQueries({ queryKey: ['kpiTrends'] });
    } catch (error: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      toast.error(message || 'Không thể tính KPI. Vui lòng thử lại sau.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Họ và tên,Phòng ban,Tasks hoàn thành,Đúng hạn,Điểm công việc,Điểm đúng hạn,Điểm thưởng,Tổng KPI,Xếp loại',
    ];
    const rows = filteredEmployees.map((e) => {
      const taskScore = e.scoreBreakdown?.taskCompletion ?? Math.round(e.kpiScore * 0.4);
      const onTimeScore = e.scoreBreakdown?.onTime ?? Math.round(e.kpiScore * 0.4);
      const bonusScore = e.scoreBreakdown?.bonus ?? Math.round(e.kpiScore * 0.2);
      return `"${e.name}","${e.department}",${e.tasksCompleted},${e.tasksOnTime},${taskScore},${onTimeScore},${bonusScore},${e.kpiScore},"${e.rank}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bao_Cao_KPI_${activePeriod}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã xuất file báo cáo KPI (.CSV) thành công!');
  };

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  const getRankBadge = (rank: string) => {
    switch (rank) {
      case 'S':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-300 dark:border-amber-500/40';
      case 'A':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-300 dark:border-purple-500/40';
      case 'B':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-300 dark:border-blue-500/40';
      case 'C':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600';
      default:
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-300 dark:border-rose-500/40';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 transition-colors duration-200 dark:bg-slate-950 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30 inline-flex items-center gap-1.5 shadow-sm">
              <Award className="w-4 h-4 text-indigo-500" />
              Đánh Giá Hiệu Suất Nhân Sự
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Enterprise KPI Performance & Merit Center
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Bảng Đánh Giá & Xếp Hạng KPI Doanh Nghiệp
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Phân tích bóc tách điểm hiệu suất, tỷ lệ đúng hạn và vinh danh nhân sự xuất sắc theo kỳ.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
          {canManage && (
            <button
              type="button"
              onClick={handleCalculateKPI}
              disabled={isCalculating}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-purple-500 active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tính toán KPI...</span>
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  <span>Tính Lại KPI</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="In hoặc Lưu PDF báo cáo doanh nghiệp"
          >
            <Printer className="w-4 h-4 text-indigo-500" />
            <span>In Báo Cáo</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="Xuất dữ liệu Excel CSV"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </header>

      {/* Printable Report Header (visible only when printing) */}
      <div className="hidden print:block text-center border-b pb-4 mb-6">
        <h2 className="text-xl font-bold uppercase">BÁO CÁO ĐÁNH GIÁ HIỆU SUẤT KPI NHÂN SỰ</h2>
        <p className="text-sm text-slate-600 mt-1">Kỳ đánh giá: {activePeriod} • Hệ thống Quản trị Doanh nghiệp</p>
      </div>

      {/* Period Selection & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Type Switcher */}
          <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setPeriodType('month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                periodType === 'month'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Theo Tháng
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('quarter')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                periodType === 'quarter'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Theo Quý
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('year')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                periodType === 'year'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Theo Năm
            </button>
          </div>

          {/* Dynamic Period Input */}
          {periodType === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          )}

          {periodType === 'quarter' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Q1">Quý 1 (Q1)</option>
                <option value="Q2">Quý 2 (Q2)</option>
                <option value="Q3">Quý 3 (Q3)</option>
                <option value="Q4">Quý 4 (Q4)</option>
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
          )}

          {periodType === 'year' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="2026">Năm 2026</option>
              <option value="2025">Năm 2025</option>
            </select>
          )}

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[200px] truncate"
          >
            <option value="ALL">Toàn Bộ Phòng Ban</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder="Tìm theo tên hoặc phòng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3.5 pr-3 py-2 text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* DEPARTMENT KPI LEADERBOARD (TOP 3 HONORS) */}
      {leaderboard.length > 0 && (
        <section className="space-y-4 print:hidden">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Bảng Vinh Danh Top 3 Nhân Sự Xuất Sắc Kỳ {activePeriod}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {leaderboard.map((emp, index) => {
              const medalConfig =
                index === 0
                  ? {
                      title: 'Quán Quân KPI',
                      medal: '🥇',
                      badgeColor: 'from-amber-400 to-amber-600 text-white shadow-amber-500/30',
                      border: 'border-amber-300 dark:border-amber-500/50 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-slate-900',
                    }
                  : index === 1
                  ? {
                      title: 'Á Quân KPI',
                      medal: '🥈',
                      badgeColor: 'from-slate-300 to-slate-500 text-white shadow-slate-400/30',
                      border: 'border-slate-300 dark:border-slate-600/50 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-800/20 dark:to-slate-900',
                    }
                  : {
                      title: 'Hạng Ba Xuất Sắc',
                      medal: '🥉',
                      badgeColor: 'from-amber-700 to-amber-900 text-white shadow-amber-800/30',
                      border: 'border-amber-700/30 dark:border-amber-800/40 bg-gradient-to-b from-amber-100/20 to-white dark:from-amber-950/10 dark:to-slate-900',
                    };

              return (
                <div
                  key={emp.id}
                  className={`relative rounded-3xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${medalConfig.border}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-r shadow-md ${medalConfig.badgeColor}`}>
                      {medalConfig.medal} {medalConfig.title}
                    </span>
                    <span className="text-2xl font-black text-amber-500">#{index + 1}</span>
                  </div>

                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt={emp.name} className="h-full w-full rounded-2xl object-cover" />
                      ) : (
                        emp.name[0]
                      )}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{emp.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{emp.department}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Điểm KPI Tổng</span>
                      <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{emp.kpiScore}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Tỷ Lệ Hoàn Thành</span>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {emp.tasksCompleted} tasks
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI BREAKDOWN TABLE (ALL EMPLOYEES) */}
      <section className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-500" />
              Bảng Phân Tích Bóc Tách Điểm KPI Chi Tiết
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Bóc tách theo điểm hoàn thành công việc (40%), đúng hạn (40%) và điểm cộng thưởng Manager (20%).
            </p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Điểm trung bình toàn phòng: <strong className="text-indigo-600 dark:text-indigo-400">{avgScore}</strong> • Đạt chuẩn: <strong>{targetAchievedCount}</strong> nhân sự
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 font-bold uppercase tracking-wider">
                <th className="py-4 px-4">Nhân Sự</th>
                <th className="py-4 px-4">Phòng Ban</th>
                <th className="py-4 px-4 text-center">Hoàn Thành</th>
                <th className="py-4 px-4 text-center">Đúng Hạn</th>
                <th className="py-4 px-4 text-center">Điểm Task (40%)</th>
                <th className="py-4 px-4 text-center">Đúng Hạn (40%)</th>
                <th className="py-4 px-4 text-center">Thưởng (20%)</th>
                <th className="py-4 px-4 text-center">Tổng Điểm</th>
                <th className="py-4 px-4 text-center">Xếp Loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Chưa có dữ liệu đánh giá KPI cho kỳ này. Hãy bấm "Tính Lại KPI" ở trên.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const taskScore = emp.scoreBreakdown?.taskCompletion ?? Math.round(emp.kpiScore * 0.4);
                  const onTimeScore = emp.scoreBreakdown?.onTime ?? Math.round(emp.kpiScore * 0.4);
                  const bonusScore = emp.scoreBreakdown?.bonus ?? Math.round(emp.kpiScore * 0.2);

                  return (
                    <tr
                      key={emp.id}
                      className="bg-white/40 transition hover:bg-slate-50/80 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {emp.name[0]}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white truncate">{emp.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">{emp.department}</td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {emp.tasksCompleted}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {emp.tasksOnTime}
                      </td>

                      <td className="py-3.5 px-4 text-center text-indigo-600 dark:text-indigo-400 font-bold">
                        {taskScore}
                      </td>

                      <td className="py-3.5 px-4 text-center text-blue-600 dark:text-blue-400 font-bold">
                        {onTimeScore}
                      </td>

                      <td className="py-3.5 px-4 text-center text-amber-600 dark:text-amber-400 font-bold">
                        +{bonusScore}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{emp.kpiScore}</span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${getRankBadge(emp.rank)}`}>
                          Hạng {emp.rank}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Printable Report Signatures */}
      <div className="hidden print:grid grid-cols-3 gap-6 text-center pt-8 text-xs">
        <div>
          <p className="font-bold uppercase">Người Lập Biểu</p>
          <p className="text-slate-400 mt-12">(Ký và ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-bold uppercase">Trưởng Phòng Ban</p>
          <p className="text-slate-400 mt-12">(Ký và ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-bold uppercase">Giám Đốc Phê Duyệt</p>
          <p className="text-slate-400 mt-12">(Ký và đóng dấu)</p>
        </div>
      </div>
    </div>
  );
};

export default KpiPage;

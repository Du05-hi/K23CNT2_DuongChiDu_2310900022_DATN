import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Edit3,
  Check,
  X,
  Eye,
  History,
  Clock,
  AlertCircle,
  HelpCircle,
  Copy,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { KpiEmployeeRecord, kpiService } from '../services/kpiService';
import KpiCertificateModal, { type CertificateData } from '@/components/kpi/KpiCertificateModal';

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

  // Primary state for KPI list
  const [kpiList, setKpiList] = useState<KpiEmployeeRecord[]>([]);

  // Editing bonus state
  const [editingBonusUserId, setEditingBonusUserId] = useState<string | null>(null);
  const [bonusInputVal, setBonusInputVal] = useState<number>(0);
  const [isSavingBonus, setIsSavingBonus] = useState(false);

  // Detail & History modal
  const [selectedUserDetail, setSelectedUserDetail] = useState<KpiEmployeeRecord | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateData | null>(null);
  const [userHistoryLogs, setUserHistoryLogs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // AI KPI Review state
  const [aiReviewText, setAiReviewText] = useState<string | null>(null);
  const [isLoadingAiReview, setIsLoadingAiReview] = useState(false);
  const [isCopiedReview, setIsCopiedReview] = useState(false);

  // Active computed period string
  const activePeriod = useMemo(() => {
    if (periodType === 'quarter') return `${selectedYear}-${selectedQuarter}`;
    if (periodType === 'year') return selectedYear;
    return selectedMonth;
  }, [periodType, selectedYear, selectedQuarter, selectedMonth]);

  // Fetch KPI data
  const { data: fetchedEmployees, isLoading, isError } = useQuery({
    queryKey: ['kpiEmployees', activePeriod, selectedDept],
    queryFn: async () => {
      const res = await apiClient.get<any>('/kpi', {
        params: { period: activePeriod, departmentId: selectedDept },
      });
      const raw = res.data;
      if (Array.isArray(raw)) return raw as KpiEmployeeRecord[];
      if (raw && Array.isArray(raw.data)) return raw.data as KpiEmployeeRecord[];
      return [] as KpiEmployeeRecord[];
    },
  });

  // Sync fetched data with local kpiList
  useEffect(() => {
    if (fetchedEmployees && Array.isArray(fetchedEmployees)) {
      setKpiList(fetchedEmployees);
    }
  }, [fetchedEmployees]);

  // Fetch Departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await apiClient.get<Array<{ id: string; name: string }>>('/users/departments');
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  // Recalculate KPI handler
  const handleRecalculateKpi = async () => {
    setIsCalculating(true);
    try {
      const res = await apiClient.post('/kpi/calculate', {
        period: activePeriod,
        departmentId: selectedDept,
      });
      const raw = res.data;
      const items: KpiEmployeeRecord[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : [];
      setKpiList(items);
      queryClient.setQueryData(['kpiEmployees', activePeriod, selectedDept], items);
      toast.success(raw?.message || 'Đã tính toán lại điểm KPI toàn diện cho đội ngũ.');
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

  // Alias
  const handleCalculateKPI = handleRecalculateKpi;

  // Save Bonus Score
  const handleSaveBonus = async (userId: string) => {
    if (!canManage) return;
    setIsSavingBonus(true);
    try {
      const score = Math.max(0, Math.min(20, Number(bonusInputVal) || 0));
      const res = await apiClient.patch('/kpi/bonus', {
        userId,
        period: activePeriod,
        bonusScore: score,
      });

      const updatedRecord: KpiEmployeeRecord = res.data?.data;
      if (updatedRecord) {
        setKpiList((prev) =>
          prev.map((item) => (item.userId === userId || item.id === updatedRecord.id ? { ...item, ...updatedRecord } : item))
        );
      }
      toast.success(res.data?.message || 'Đã cập nhật điểm thưởng Manager thành công!');
      setEditingBonusUserId(null);
      await queryClient.invalidateQueries({ queryKey: ['kpiEmployees'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật điểm thưởng.');
    } finally {
      setIsSavingBonus(false);
    }
  };

  // Open User Detail & History Modal
  const handleViewDetail = async (emp: KpiEmployeeRecord) => {
    setSelectedUserDetail(emp);
    setAiReviewText(null);
    setIsCopiedReview(false);
    setIsLoadingHistory(true);
    try {
      const res = await apiClient.get(`/kpi/user/${emp.userId}`);
      const history = res.data?.data?.history || res.data?.history || [];
      setUserHistoryLogs(history);
    } catch (err) {
      setUserHistoryLogs([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // AI KPI Performance Review Handler
  const handleGenerateAiReview = async () => {
    if (!selectedUserDetail) return;
    setIsLoadingAiReview(true);
    try {
      const res = await apiClient.post<any>('/kpi/ai-review', {
        userId: selectedUserDetail.userId,
        period: activePeriod,
      });
      const review = res.data?.data?.review || res.data?.review;
      if (review) {
        setAiReviewText(review);
        toast.success('Đã hoàn tất bản nhận xét hiệu suất AI!');
      } else {
        toast.error('Không nhận được nội dung nhận xét từ AI.');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể tạo nhận xét AI lúc này. Vui lòng thử lại.');
    } finally {
      setIsLoadingAiReview(false);
    }
  };

  // Copy AI Review to clipboard
  const handleCopyAiReview = async () => {
    if (!aiReviewText) return;
    try {
      await navigator.clipboard.writeText(aiReviewText);
      setIsCopiedReview(true);
      toast.success('Đã sao chép nhận xét AI vào bộ nhớ tạm!');
      setTimeout(() => setIsCopiedReview(false), 2500);
    } catch {
      toast.error('Không thể sao chép văn bản vào clipboard.');
    }
  };

  // Filtered list
  const filteredEmployees = useMemo(() => {
    return kpiList.filter((e) => {
      const name = (e.userName || e.name || '').toLowerCase();
      const email = (e.userEmail || '').toLowerCase();
      const dept = (e.departmentName || e.department || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [kpiList, searchQuery]);

  // Top 3 Leaderboard
  const leaderboard = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
  }, [filteredEmployees]);

  // Aggregate stats
  const scores = filteredEmployees.map((e) => e.totalScore);
  const avgScore = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : '0';
  const targetAchievedCount = filteredEmployees.filter((e) => e.totalScore >= 80).length;

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Họ và tên,Email,Phòng ban,Tasks hoàn thành,Tổng tasks,Tỷ lệ hoàn thành %,Đúng hạn,Tỷ lệ đúng hạn %,Điểm Task (40đ),Điểm Đúng Hạn (40đ),Điểm Thưởng (20đ),Tổng Điểm,Xếp Loại',
    ];
    const rows = filteredEmployees.map((e) => {
      const name = e.userName || e.name || 'N/A';
      const email = e.userEmail || '';
      const dept = e.departmentName || e.department || 'N/A';
      return `"${name}","${email}","${dept}",${e.completedTasksCount},${e.totalTasksCount},${e.completionRate}%,${e.onTimeTasksCount},${e.onTimeRate}%,${e.taskCompletionScore},${e.onTimeScore},${e.bonusScore},${e.totalScore},"${e.rank}"`;
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

  const handlePrintReport = () => {
    toast.success('Đang chuẩn bị trang in báo cáo KPI doanh nghiệp...');
    window.print();
  };

  // Rank badge styling: S - Tím, A - Xanh lá, B - Xanh dương, C - Vàng, D - Đỏ
  const getRankBadgeClass = (rank: string) => {
    const upper = (rank || 'D').toUpperCase().charAt(0);
    switch (upper) {
      case 'S':
        return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-black shadow-xs';
      case 'A':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-black shadow-xs';
      case 'B':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 font-bold shadow-xs';
      case 'C':
        return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-bold shadow-xs';
      default:
        return 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-bold shadow-xs';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 transition-colors duration-200 dark:bg-slate-950 sm:p-6 lg:p-8 space-y-8">
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
            Công thức chuẩn mực: Hoàn thành task (40%) + Đúng hạn (40%) + Điểm thưởng Manager (20%).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
          {canManage && (
            <button
              type="button"
              onClick={handleRecalculateKpi}
              disabled={isCalculating}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-purple-500 active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tính toán lại KPI...</span>
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

      {/* Printable Report Header */}
      <div className="hidden print:block text-center border-b pb-4 mb-6">
        <h2 className="text-xl font-bold uppercase">BÁO CÁO ĐÁNH GIÁ HIỆU SUẤT KPI NHÂN SỰ</h2>
        <p className="text-sm text-slate-600 mt-1">Kỳ đánh giá: {activePeriod} • Hệ thống Quản trị Doanh nghiệp</p>
      </div>

      {/* Filter Toolbar */}
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
              className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
            />
          )}

          {periodType === 'quarter' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
              >
                <option value="Q1">Quý 1 (Q1)</option>
                <option value="Q2">Quý 2 (Q2)</option>
                <option value="Q3">Quý 3 (Q3)</option>
                <option value="Q4">Quý 4 (Q4)</option>
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
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
              className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
            >
              <option value="2026">Năm 2026</option>
              <option value="2025">Năm 2025</option>
            </select>
          )}

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[200px] truncate font-medium"
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
            placeholder="Tìm theo tên, email, phòng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3.5 pr-3 py-2 text-xs rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* TOP 3 HONORS LEADERBOARD */}
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

              const displayName = emp.userName || emp.name || 'Nhân sự';
              const displayAvatar = emp.userAvatar || emp.avatar;
              const displayDept = emp.departmentName || emp.department || 'Chưa phân bổ';

              return (
                <div
                  key={emp.id || emp.userId}
                  className={`relative rounded-3xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${medalConfig.border}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-r shadow-md ${medalConfig.badgeColor}`}>
                      {medalConfig.medal} {medalConfig.title}
                    </span>
                    <span className="text-2xl font-black text-amber-500">#{index + 1}</span>
                  </div>

                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md overflow-hidden shrink-0">
                      {displayAvatar ? (
                        <img src={displayAvatar} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">{displayName}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{displayDept}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Điểm KPI Tổng</span>
                      <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{emp.totalScore}đ</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Tỷ Lệ Hoàn Thành</span>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {emp.completedTasksCount}/{emp.totalTasksCount} ({emp.completionRate}%)
                      </p>
                    </div>
                  </div>

                  {/* Nút Cấp Bằng Khen Danh Dự (Phần 2: Top 3 & Quán Quân) */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCertificate({
                        recipientName: displayName,
                        recipientAvatar: displayAvatar,
                        departmentName: displayDept,
                        totalScore: emp.totalScore,
                        rankTitle: medalConfig.title,
                        rankNumber: index + 1,
                        completionRate: emp.completionRate,
                        completedTasksCount: emp.completedTasksCount,
                        totalTasksCount: emp.totalTasksCount,
                        period: activePeriod,
                      })
                    }
                    className="w-full mt-3.5 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl text-xs font-bold bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white shadow-sm shadow-amber-500/25 transition active:scale-95 cursor-pointer"
                    title="Mở Bằng Khen vinh danh điện tử chuẩn doanh nghiệp"
                  >
                    <span>🎖️</span>
                    <span>Cấp Bằng Khen</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI BREAKDOWN TABLE (ALL EMPLOYEES) */}
      <section className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 backdrop-blur-xl overflow-hidden p-6 space-y-4">
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
            Điểm trung bình toàn phòng: <strong className="text-indigo-600 dark:text-indigo-400">{avgScore}</strong> • Đạt chuẩn (≥80đ): <strong>{targetAchievedCount}</strong> nhân sự
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-600 dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-300 font-bold uppercase tracking-wider">
                <th className="py-4 px-4 min-w-[200px]">Nhân Viên</th>
                <th className="py-4 px-4 text-center min-w-[130px]">Tỷ Lệ Hoàn Thành</th>
                <th className="py-4 px-4 text-center min-w-[130px]">Tỷ Lệ Đúng Hạn</th>
                <th className="py-4 px-4 text-center min-w-[100px]">Điểm Task (40đ)</th>
                <th className="py-4 px-4 text-center min-w-[110px]">Điểm Đúng Hạn (40đ)</th>
                <th className="py-4 px-4 text-center min-w-[130px]">Điểm Thưởng (20đ)</th>
                <th className="py-4 px-4 text-center min-w-[90px] whitespace-nowrap">Tổng Điểm</th>
                <th className="py-4 px-4 text-center min-w-[90px] whitespace-nowrap">Xếp Loại Rank</th>
                <th className="py-4 px-4 text-center min-w-[110px] whitespace-nowrap">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HelpCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">
                        Chưa có dữ liệu đánh giá KPI cho kỳ này.
                      </p>
                      <p className="text-xs text-slate-400">
                        Vui lòng bấm nút "Tính Lại KPI" ở phía trên để hệ thống tự động bóc tách và xếp hạng đội ngũ.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const displayName = emp.userName || emp.name || 'Nhân sự';
                  const displayAvatar = emp.userAvatar || emp.avatar;
                  const displayEmail = emp.userEmail || '';
                  const displayDept = emp.departmentName || emp.department || 'Chưa phân bổ';

                  const isEditingBonus = editingBonusUserId === emp.userId;

                  return (
                    <tr
                      key={emp.id || emp.userId}
                      className="bg-white/40 transition hover:bg-slate-50/90 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
                    >
                      {/* 1. Nhân viên (Avatar + Tên + Email + Phòng ban) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm overflow-hidden">
                            {displayAvatar ? (
                              <img src={displayAvatar} alt={displayName} className="h-full w-full object-cover" />
                            ) : (
                              displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-slate-900 dark:text-white block truncate">
                              {displayName}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {displayEmail || displayDept}
                            </span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold inline-block">
                              {displayDept}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Tỷ lệ hoàn thành (Tasks Done / Total Tasks kèm %) */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {emp.completedTasksCount}/{emp.totalTasksCount}
                        </span>
                        <span className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          ({emp.completionRate}%)
                        </span>
                      </td>

                      {/* 3. Tỷ lệ đúng hạn (On-time Tasks kèm %) */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {emp.onTimeTasksCount}/{emp.completedTasksCount || 0}
                        </span>
                        <span className="block text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          ({emp.onTimeRate}%)
                        </span>
                      </td>

                      {/* 4. Điểm Task (40đ) */}
                      <td className="py-3.5 px-4 text-center text-indigo-600 dark:text-indigo-400 font-black text-sm">
                        {emp.taskCompletionScore}đ
                      </td>

                      {/* 5. Điểm Đúng Hạn (40đ) */}
                      <td className="py-3.5 px-4 text-center text-blue-600 dark:text-blue-400 font-black text-sm">
                        {emp.onTimeScore}đ
                      </td>

                      {/* 6. Điểm Thưởng (20đ - Cho phép Manager chỉnh sửa hoặc nhập điểm trực tiếp) */}
                      <td className="py-3.5 px-4 text-center">
                        {isEditingBonus ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.5"
                              value={bonusInputVal}
                              onChange={(e) => setBonusInputVal(Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveBonus(emp.userId);
                                if (e.key === 'Escape') setEditingBonusUserId(null);
                              }}
                              className="w-14 px-2 py-1 text-xs rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveBonus(emp.userId)}
                              disabled={isSavingBonus}
                              className="p-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition"
                              title="Lưu điểm thưởng"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBonusUserId(null)}
                              className="p-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 hover:bg-slate-300 transition"
                              title="Hủy"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 group/bonus">
                            <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                              +{emp.bonusScore}đ
                            </span>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBonusUserId(emp.userId);
                                  setBonusInputVal(emp.bonusScore);
                                }}
                                className="opacity-0 group-hover/bonus:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                                title="Chỉnh sửa điểm thưởng (0-20đ)"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. Tổng Điểm (100đ) */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {emp.totalScore}đ
                        </span>
                      </td>

                      {/* 8. Xếp Loại Rank (Badge nổi bật: S - Tím, A - Xanh lá, B - Xanh dương, C - Vàng, D - Đỏ) */}
                      <td className="py-3.5 px-4 text-center min-w-[90px] whitespace-nowrap">
                        <span
                          className={`whitespace-nowrap inline-flex items-center justify-center min-w-[76px] px-2.5 py-1 text-xs font-bold leading-none rounded-full border ${getRankBadgeClass(
                            emp.rank
                          )}`}
                        >
                          Hạng {emp.rank}
                        </span>
                      </td>

                      {/* 9. Thao tác (Nút xem chi tiết / Lịch sử đánh giá) */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleViewDetail(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
                          title="Xem phân tích chi tiết & lịch sử đánh giá"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* DETAIL & HISTORY MODAL */}
      <AnimatePresence>
        {selectedUserDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-base shadow-md overflow-hidden">
                    {selectedUserDetail.userAvatar || selectedUserDetail.avatar ? (
                      <img
                        src={(selectedUserDetail.userAvatar || selectedUserDetail.avatar)!}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (selectedUserDetail.userName || selectedUserDetail.name || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                      {selectedUserDetail.userName || selectedUserDetail.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedUserDetail.userEmail || ''} • {selectedUserDetail.departmentName || selectedUserDetail.department}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserDetail(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* KPI Period Score Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Bóc Tách Điểm Kỳ {activePeriod}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Task Hoàn Thành (40%)</span>
                    <strong className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                      {selectedUserDetail.taskCompletionScore} / 40đ
                    </strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {selectedUserDetail.completedTasksCount}/{selectedUserDetail.totalTasksCount} tasks ({selectedUserDetail.completionRate}%)
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Đúng Hạn (40%)</span>
                    <strong className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                      {selectedUserDetail.onTimeScore} / 40đ
                    </strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {selectedUserDetail.onTimeTasksCount} on-time ({selectedUserDetail.onTimeRate}%)
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Thưởng Manager (20%)</span>
                    <strong className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                      +{selectedUserDetail.bonusScore} / 20đ
                    </strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Điểm cộng chuyên cần</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Tổng Điểm & Hạng</span>
                    <strong className="text-base font-black text-purple-600 dark:text-purple-400">
                      {selectedUserDetail.totalScore}đ
                    </strong>
                    <span className={`whitespace-nowrap inline-flex items-center justify-center min-w-[76px] mt-1 px-2.5 py-1 rounded-full text-xs font-bold leading-none border ${getRankBadgeClass(selectedUserDetail.rank)}`}>
                      Hạng {selectedUserDetail.rank}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Performance Review Section */}
              <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                      Cố Vấn & Đánh Giá Hiệu Suất AI
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Phân tích chuyên sâu điểm sáng, điểm cần cải thiện & lộ trình phát triển
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiReview}
                    disabled={isLoadingAiReview}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-md shadow-purple-500/25 active:scale-95 transition cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {isLoadingAiReview ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>AI Đang Phân Tích...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>✨ AI Nhận Xét Hiệu Suất</span>
                      </>
                    )}
                  </button>
                </div>

                {/* AI Review Content Frame with Glowing Icon & Copy Button */}
                {aiReviewText && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-3xl bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-50/40 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 border border-purple-200/80 dark:border-purple-800/60 shadow-inner space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-purple-500/40 ring-4 ring-purple-400/20 animate-pulse">
                          <Sparkles className="w-4 h-4 text-amber-300" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            Bản Nhận Xét Chuẩn Nhân Sự (HR AI)
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              Gemini AI
                            </span>
                          </h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Đánh giá dựa trên chỉ số thực tế kỳ {activePeriod} của {selectedUserDetail.userName || selectedUserDetail.name}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyAiReview}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-95 transition cursor-pointer shrink-0"
                      >
                        {isCopiedReview ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Sao chép nhận xét</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-purple-100 dark:border-purple-900/50 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-medium shadow-xs">
                      {aiReviewText}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* History Table */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-500" />
                  Lịch Sử Đánh Giá Các Kỳ Gần Nhất
                </h4>

                {isLoadingHistory ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : userHistoryLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 border border-dashed rounded-2xl border-slate-200 dark:border-slate-800">
                    Chưa có lịch sử các kỳ trước đó cho nhân sự này.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Kỳ Đánh Giá</th>
                          <th className="py-2.5 px-3 text-center">Hoàn Thành</th>
                          <th className="py-2.5 px-3 text-center">Đúng Hạn</th>
                          <th className="py-2.5 px-3 text-center">Tổng Điểm</th>
                          <th className="py-2.5 px-3 text-center min-w-[90px] whitespace-nowrap">Xếp Loại</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {userHistoryLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{log.period}</td>
                            <td className="py-2 px-3 text-center">{log.tasksCompleted}</td>
                            <td className="py-2 px-3 text-center">{log.tasksOnTime}</td>
                            <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{log.totalScore}đ</td>
                            <td className="py-2 px-3 text-center min-w-[90px] whitespace-nowrap">
                              <span className={`whitespace-nowrap inline-flex items-center justify-center min-w-[76px] px-2 py-0.5 rounded-full text-xs font-bold leading-none border ${getRankBadgeClass(log.rank)}`}>
                                Hạng {log.rank}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserDetail(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* MODAL CẤP BẰNG KHEN VINH DANH ĐIỆN TỬ */}
      <KpiCertificateModal
        isOpen={Boolean(selectedCertificate)}
        onClose={() => setSelectedCertificate(null)}
        data={selectedCertificate}
      />
    </div>
  );
};

export default KpiPage;

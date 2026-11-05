import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale,
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Loader2,
  Check,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Zap,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';
import projectService, {
  type WorkloadMemberData,
  type ProjectWorkloadResponse,
  type AiRebalanceRecommendation,
} from '@/services/projectService';

export interface WorkloadBalancingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  onRebalanceApplied?: () => void;
}

export const WorkloadBalancingModal: React.FC<WorkloadBalancingModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  onRebalanceApplied,
}) => {
  // Trạng thái dữ liệu tải
  const [loading, setLoading] = useState(false);
  const [workloadData, setWorkloadData] = useState<ProjectWorkloadResponse | null>(null);
  const [standardCapacity, setStandardCapacity] = useState<number>(40);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  // Trạng thái AI Rebalance
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AiRebalanceRecommendation[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  // Tải dữ liệu tải nhân sự từ API backend
  const fetchWorkloadData = async (capacity: number = standardCapacity) => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await projectService.getProjectWorkload(projectId, capacity);
      setWorkloadData(data);
    } catch (error: any) {
      console.error('Lỗi khi tải dữ liệu phân bổ nhân sự:', error);
      toast.error(error?.response?.data?.message || 'Không thể tải bản đồ tải nhân sự.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && projectId) {
      fetchWorkloadData(standardCapacity);
      // Reset trạng thái AI
      setAiRecommendations(null);
      setAiSummary('');
      setSelectedTaskIds(new Set());
    }
  }, [isOpen, projectId]);

  // Xử lý đổi định mức giờ
  const handleCapacityChange = (newCap: number) => {
    setStandardCapacity(newCap);
    fetchWorkloadData(newCap);
    setAiRecommendations(null);
  };

  // Kích hoạt thuật toán Gemini AI Rebalance
  const handleRunAiRebalance = async () => {
    if (!projectId) return;
    setAnalyzingAi(true);
    try {
      const result = await projectService.getAiRebalanceRecommendations(projectId, standardCapacity);
      setAiRecommendations(result.recommendations || []);
      setAiSummary(result.summary || '');

      // Mặc định chọn tất cả các đề xuất của AI
      const allIds = new Set((result.recommendations || []).map((r) => r.taskId));
      setSelectedTaskIds(allIds);

      if ((result.recommendations || []).length === 0) {
        toast.info(result.summary || 'Tất cả nhân sự đang ở mức tải cân bằng, chưa cần điều chuyển việc!');
      } else {
        toast.success(`✨ Gemini AI đã tạo phương án: Đề xuất điều chuyển ${result.recommendations.length} công việc!`);
      }
    } catch (error: any) {
      console.error('Lỗi khi chạy AI Rebalance:', error);
      toast.error(error?.response?.data?.message || 'Không thể tạo đề xuất cân bằng tải.');
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Toggle chọn một task
  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Toggle chọn tất cả
  const toggleSelectAll = () => {
    if (!aiRecommendations || aiRecommendations.length === 0) return;
    if (selectedTaskIds.size === aiRecommendations.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(aiRecommendations.map((r) => r.taskId)));
    }
  };

  // Xác nhận & Áp dụng điều chuyển vào cơ sở dữ liệu
  const handleApplyRebalance = async () => {
    if (!aiRecommendations || selectedTaskIds.size === 0) {
      toast.error('Vui lòng chọn ít nhất một đề xuất điều chuyển để áp dụng.');
      return;
    }

    const reallocationsToApply = aiRecommendations
      .filter((r) => selectedTaskIds.has(r.taskId))
      .map((r) => ({
        taskId: r.taskId,
        toUserId: r.toUserId,
      }));

    setIsApplying(true);
    try {
      const res = await projectService.applyWorkloadRebalance(projectId, reallocationsToApply);
      
      // Bắn pháo hoa ăn mừng điều chuyển thành công
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // bỏ qua nếu lỗi canvas
      }

      toast.success(`🎉 Đã áp dụng điều phối cân bằng tải thành công cho ${res.appliedCount} công việc!`);

      // Tự động reload Kanban page
      if (onRebalanceApplied) {
        onRebalanceApplied();
      }

      onClose();
    } catch (error: any) {
      console.error('Lỗi khi áp dụng điều chuyển:', error);
      toast.error(error?.response?.data?.message || 'Không thể áp dụng điều chuyển tải.');
    } finally {
      setIsApplying(false);
    }
  };

  // Thống kê nhanh từ workloadData
  const members = workloadData?.members || [];
  const summary = workloadData?.summary || {
    totalMembers: members.length,
    overloadedCount: members.filter((m) => m.status === 'OVERLOADED').length,
    balancedCount: members.filter((m) => m.status === 'BALANCED').length,
    underloadedCount: members.filter((m) => m.status === 'UNDERLOADED').length,
    totalAssignedHours: members.reduce((sum, m) => sum + m.assignedHours, 0),
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-amber-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Cân Bằng Tải Nhân Sự & Tối Ưu Nguồn Lực
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    AI Workload Balancing
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {projectName ? `Dự án: ${projectName}` : 'Phân tích định mức và tự động điều phối khối lượng công việc'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Chọn định mức Standard Capacity */}
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                <span className="px-2 text-slate-500 dark:text-slate-400 font-medium">Định mức:</span>
                <button
                  type="button"
                  onClick={() => handleCapacityChange(40)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    standardCapacity === 40
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  40h (Sprint)
                </button>
                <button
                  type="button"
                  onClick={() => handleCapacityChange(160)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    standardCapacity === 160
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  160h (Tháng)
                </button>
              </div>

              {/* Nút Refresh */}
              <button
                type="button"
                onClick={() => fetchWorkloadData(standardCapacity)}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                title="Làm mới dữ liệu tải"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Nút Đóng */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body: Cuộn được */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Thanh tóm tắt trạng thái phân bổ */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng Nhân Sự</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.totalMembers}</div>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-300">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">🚨 Quá tải (&gt;100%)</div>
                  <div className="text-lg font-bold text-rose-700 dark:text-rose-300">{summary.overloadedCount}</div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Ổn định (60-100%)</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{summary.balancedCount}</div>
                </div>
              </div>

              <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/60 flex items-center justify-center text-sky-600 dark:text-sky-300">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-sky-600 dark:text-sky-400 font-medium">⏳ Dư công suất (&lt;60%)</div>
                  <div className="text-lg font-bold text-sky-700 dark:text-sky-300">{summary.underloadedCount}</div>
                </div>
              </div>

              <div className="p-3.5 col-span-2 sm:col-span-1 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Tổng Giờ Đang Ôm</div>
                  <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{summary.totalAssignedHours}h</div>
                </div>
              </div>
            </div>

            {/* KHỐI 1: BẢN ĐỒ TẢI NHÂN SỰ HIỆN TẠI (Current Workload Distribution) */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Khối 1: Bản Đồ Tải Nhân Sự Hiện Tại (Current Workload Distribution)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Định mức tiêu chuẩn: <strong>{standardCapacity}h</strong> / nhân sự. Màu thanh tiến độ trực quan theo % tải.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  {members.length} thành viên
                </span>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-xs font-medium text-slate-500">Đang phân tích dữ liệu tải nhân sự...</p>
                </div>
              ) : members.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  Không tìm thấy thành viên hoặc công việc nào trong dự án này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {members.map((member) => {
                    const isOverloaded = member.status === 'OVERLOADED';
                    const isBalanced = member.status === 'BALANCED';
                    const isUnderloaded = member.status === 'UNDERLOADED';

                    // Progress bar colors
                    let progressBg = 'from-emerald-500 to-teal-500';
                    let badgeBg = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
                    let badgeLabel = '✓ Ổn định';

                    if (isOverloaded) {
                      progressBg = 'from-rose-500 to-red-600';
                      badgeBg = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse';
                      badgeLabel = '🚨 Quá tải';
                    } else if (isUnderloaded) {
                      progressBg = 'from-sky-400 to-amber-500';
                      badgeBg = 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800';
                      badgeLabel = '⏳ Dư công suất';
                    }

                    const isExpanded = expandedMemberId === member.userId;
                    const visualPercent = Math.min(member.workloadPercent, 100);

                    return (
                      <div
                        key={member.userId}
                        className={`p-4 rounded-2xl border transition-all duration-200 ${
                          isOverloaded
                            ? 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/60 shadow-sm'
                            : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300'
                        }`}
                      >
                        {/* Member Card Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              src={member.avatar}
                              name={member.name}
                              size="md"
                              className="border-2 border-white dark:border-slate-800 shadow-sm"
                            />
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                                {member.name}
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                {member.departmentName || member.role || 'Thành viên'}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs whitespace-nowrap ${badgeBg}`}
                          >
                            {badgeLabel}
                          </span>
                        </div>

                        {/* Workload Metric Details */}
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-500 dark:text-slate-400">
                            Công việc: <strong>{member.tasks.length} task</strong> ({member.reallocatableTasks.length} TODO)
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {member.assignedHours}h / {member.standardCapacity}h ({member.workloadPercent}%)
                          </span>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${visualPercent}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className={`h-full rounded-full bg-gradient-to-r ${progressBg}`}
                          />
                        </div>

                        {/* Collapsible Task List */}
                        {member.tasks.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/60">
                            <button
                              type="button"
                              onClick={() => setExpandedMemberId(isExpanded ? null : member.userId)}
                              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition"
                            >
                              <span>
                                {isExpanded ? 'Ẩn danh sách việc' : `Xem chi tiết ${member.tasks.length} việc`}
                              </span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-2 space-y-1.5 overflow-hidden"
                                >
                                  {member.tasks.map((t) => (
                                    <div
                                      key={t.id}
                                      className="flex items-center justify-between p-1.5 px-2 bg-white dark:bg-slate-800 rounded-lg text-[11px] border border-slate-200/60 dark:border-slate-700/40"
                                    >
                                      <div className="flex items-center gap-1.5 truncate pr-2">
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                            t.status === 'TODO' ? 'bg-amber-500' : 'bg-indigo-500'
                                          }`}
                                        />
                                        <span className="truncate text-slate-800 dark:text-slate-200">{t.title}</span>
                                      </div>
                                      <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                                        {t.estimatedHours}h
                                      </span>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* KHỐI 2: TRỢ LÝ AI PHÂN BỔ LẠI (AI Rebalancing Engine) */}
            <div className="bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-white dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-900/80 rounded-3xl p-5 sm:p-6 shadow-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping"></span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      Khối 2: Trợ Lý AI Phân Bổ Lại (AI Rebalancing Engine)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Google Gemini AI tự động tìm ra kế hoạch điều chuyển tối ưu từ người quá tải sang người rảnh rỗi.
                  </p>
                </div>

                {/* NÚT BẤM NỔI BẬT: CHẠY THUẬT TOÁN CÂN BẰNG TẢI AI */}
                <button
                  type="button"
                  onClick={handleRunAiRebalance}
                  disabled={analyzingAi || loading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {analyzingAi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang Phân Tích Ma Trận Tải...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300 animate-bounce" />
                      <span>🤖 Chạy Thuật Toán Cân Bằng Tải AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Hiệu ứng loading phân tích */}
              {analyzingAi && (
                <div className="p-8 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-indigo-100 dark:border-indigo-900 flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 animate-spin" />
                    <Sparkles className="w-5 h-5 text-amber-500 absolute inset-0 m-auto" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                      Gemini AI đang phân tích ma trận kỹ năng & tải nhân sự...
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Đang tìm kiếm phương án điều chuyển để đưa toàn bộ đội ngũ về khoảng an toàn (60% - 100%).
                    </p>
                  </div>
                </div>
              )}

              {/* Kết quả đề xuất AI */}
              {!analyzingAi && aiRecommendations && (
                <div className="space-y-4">
                  {/* Summary Box */}
                  {aiSummary && (
                    <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <h5 className="font-bold text-indigo-950 dark:text-indigo-200">Đánh giá từ Trợ Lý AI:</h5>
                        <p className="text-indigo-800 dark:text-indigo-300 mt-0.5 leading-relaxed">{aiSummary}</p>
                      </div>
                    </div>
                  )}

                  {aiRecommendations.length === 0 ? (
                    <div className="py-8 text-center bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Khối lượng công việc của dự án hiện đang rất tối ưu.
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Không phát hiện nhân sự quá tải hoặc các công việc cần điều chuyển gấp.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Bảng Đề xuất điều chuyển thông minh */}
                      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-sm">
                        <div className="p-3 px-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition cursor-pointer"
                          >
                            {selectedTaskIds.size === aiRecommendations.length ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                            <span>Chọn tất cả ({selectedTaskIds.size}/{aiRecommendations.length})</span>
                          </button>
                          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            Đã tick {selectedTaskIds.size} đề xuất
                          </span>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-700/60 overflow-x-auto">
                          {aiRecommendations.map((rec) => {
                            const isSelected = selectedTaskIds.has(rec.taskId);

                            return (
                              <div
                                key={rec.taskId}
                                onClick={() => toggleSelectTask(rec.taskId)}
                                className={`p-4 flex items-center gap-4 transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                                    : 'hover:bg-slate-50/60 dark:hover:bg-slate-700/40 opacity-70'
                                }`}
                              >
                                {/* Checkbox */}
                                <div className="shrink-0">
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-400" />
                                  )}
                                </div>

                                {/* Task Details */}
                                <div className="flex-1 min-w-[200px]">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                                      {rec.taskTitle}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                                      {rec.hours}h
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-1 font-medium flex items-center gap-1.5">
                                    <Info className="w-3 h-3 shrink-0" />
                                    <span>{rec.reason}</span>
                                  </p>
                                </div>

                                {/* From -> To Visual Flow */}
                                <div className="flex items-center gap-2.5 shrink-0 bg-slate-50 dark:bg-slate-900/60 p-2 px-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                  <div className="text-right">
                                    <div className="text-[10px] text-rose-500 font-semibold">Chuyển từ</div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                      {rec.fromUserName}
                                    </div>
                                  </div>

                                  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </div>

                                  <div>
                                    <div className="text-[10px] text-emerald-600 font-semibold">Sang</div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                      {rec.toUserName}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Button: Phê duyệt & Áp dụng điều chuyển ngay */}
                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setAiRecommendations(null)}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                        >
                          Hủy phương án này
                        </button>

                        <button
                          type="button"
                          onClick={handleApplyRebalance}
                          disabled={isApplying || selectedTaskIds.size === 0}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {isApplying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Đang Áp Dụng Điều Chuyển...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>✓ Phê duyệt & Áp Dụng Điều Chuyển Ngay ({selectedTaskIds.size} việc)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Công nghệ AI điều phối tài nguyên theo thời gian thực (Realtime WebSocket Sync).
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Đóng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default WorkloadBalancingModal;

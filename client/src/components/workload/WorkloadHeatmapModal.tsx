import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale,
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle2,
  Users,
  Flame,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  ShieldAlert,
  Loader2,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/api/apiClient';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';

export interface WorkloadMember {
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
  departmentName?: string;
  activeTasks: Array<{
    id: string;
    title: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
    dueDate?: string | null;
    isOverdue?: boolean;
    projectName?: string;
  }>;
}

export interface RebalanceSuggestion {
  taskId: string;
  taskTitle: string;
  priority: string;
  fromUser: { id: string; name: string };
  toUser: { id: string; name: string };
}

export interface WorkloadHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks?: any[];
  users?: any[];
  projectId?: string;
  onRebalanceSuccess?: () => void;
}

export const WorkloadHeatmapModal: React.FC<WorkloadHeatmapModalProps> = ({
  isOpen,
  onClose,
  tasks = [],
  users = [],
  projectId,
  onRebalanceSuccess,
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<RebalanceSuggestion[] | null>(null);

  // Phân tích danh sách thành viên và phân bổ task
  const memberWorkloads = useMemo(() => {
    const userMap = new Map<string, WorkloadMember>();

    // 1. Khởi tạo danh sách người dùng
    users.forEach((u) => {
      userMap.set(u.id, {
        userId: u.id,
        name: u.name || u.fullName || 'Thành viên',
        email: u.email || '',
        avatar: u.avatar || u.avatarUrl || null,
        role: u.role || 'EMPLOYEE',
        departmentName: u.department?.name || u.departmentName || '',
        activeTasks: [],
      });
    });

    const now = new Date();

    // 2. Gán các task active vào từng thành viên
    tasks.forEach((t) => {
      if (t.status === 'DONE') return; // Bỏ qua task đã xong

      const assigneeId = t.assigneeId || t.assignee?.id;
      if (!assigneeId) return;

      const isOverdue = t.dueDate ? new Date(t.dueDate) < now : false;

      const taskItem = {
        id: t.id,
        title: t.title,
        priority: t.priority || 'MEDIUM',
        status: t.status,
        dueDate: t.dueDate,
        isOverdue,
        projectName: t.project?.name || t.projectName || '',
      };

      if (userMap.has(assigneeId)) {
        userMap.get(assigneeId)!.activeTasks.push(taskItem);
      } else {
        // Nếu user chưa có trong list users ban đầu
        const memberName = t.assignee?.name || t.assignee || 'Thành viên';
        userMap.set(assigneeId, {
          userId: assigneeId,
          name: memberName,
          email: t.assignee?.email || '',
          avatar: t.assignee?.avatar || null,
          activeTasks: [taskItem],
        });
      }
    });

    // 3. Tính toán trạng thái tải: Rảnh rỗi (0-2), Tối ưu (3-4), Quá tải (>=5)
    return Array.from(userMap.values()).map((m) => {
      const activeCount = m.activeTasks.length;
      const overdueOrUrgentCount = m.activeTasks.filter(
        (t) => t.isOverdue || t.priority === 'URGENT'
      ).length;

      let status: 'IDLE' | 'OPTIMAL' | 'OVERLOAD' = 'OPTIMAL';
      let statusLabel = 'Đang Tối Ưu (3-4 việc)';
      let statusColor = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800';
      let progressColor = 'from-amber-400 to-amber-500';

      if (activeCount <= 2) {
        status = 'IDLE';
        statusLabel = 'Rảnh Rỗi (0-2 việc)';
        statusColor = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800';
        progressColor = 'from-emerald-400 to-emerald-500';
      } else if (activeCount >= 5 || overdueOrUrgentCount >= 2) {
        status = 'OVERLOAD';
        statusLabel = 'Quá Tải (≥ 5 việc)';
        statusColor = 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 animate-pulse';
        progressColor = 'from-rose-500 to-red-600';
      }

      const percent = Math.min(Math.round((activeCount / 6) * 100), 100);

      return {
        ...m,
        activeCount,
        overdueOrUrgentCount,
        status,
        statusLabel,
        statusColor,
        progressColor,
        percent,
      };
    }).sort((a, b) => b.activeCount - a.activeCount);
  }, [tasks, users]);

  // Thống kê tổng quan
  const stats = useMemo(() => {
    const total = memberWorkloads.length;
    const idle = memberWorkloads.filter((m) => m.status === 'IDLE').length;
    const optimal = memberWorkloads.filter((m) => m.status === 'OPTIMAL').length;
    const overload = memberWorkloads.filter((m) => m.status === 'OVERLOAD').length;
    return { total, idle, optimal, overload };
  }, [memberWorkloads]);

  // Thuật toán AI Tự Động Phân Bổ & Cân Bằng Tải
  const handleGenerateAiPlan = () => {
    const overloadedMembers = memberWorkloads.filter((m) => m.status === 'OVERLOAD');
    const idleMembers = memberWorkloads
      .filter((m) => m.status === 'IDLE')
      .sort((a, b) => a.activeCount - b.activeCount);

    if (overloadedMembers.length === 0) {
      toast.success('Hiện tại không có nhân sự nào bị quá tải! Khối lượng công việc đang rất tối ưu.');
      setPreviewPlan([]);
      return;
    }

    if (idleMembers.length === 0) {
      toast.error('Không tìm thấy nhân sự đang rảnh rỗi để điều chuyển công việc.');
      return;
    }

    const suggestions: RebalanceSuggestion[] = [];
    const simulatedIdleCounts = idleMembers.map((m) => ({ ...m, count: m.activeCount }));

    overloadedMembers.forEach((overUser) => {
      // Chỉ chuyển những task đang ở trạng thái 'TODO'
      const movableTasks = overUser.activeTasks.filter((t) => t.status === 'TODO');

      for (const t of movableTasks) {
        // Tìm người rảnh rỗi nhất hiện tại có số task < 3
        simulatedIdleCounts.sort((a, b) => a.count - b.count);
        const bestTarget = simulatedIdleCounts[0];

        if (bestTarget && bestTarget.count < 3) {
          suggestions.push({
            taskId: t.id,
            taskTitle: t.title,
            priority: t.priority,
            fromUser: { id: overUser.userId, name: overUser.name },
            toUser: { id: bestTarget.userId, name: bestTarget.name },
          });

          bestTarget.count += 1;
        }
      }
    });

    if (suggestions.length === 0) {
      toast.error('Các task của nhân sự quá tải đang trong trạng thái Đang làm (In Progress/Review) nên AI không thể tự động dời.');
      setPreviewPlan([]);
      return;
    }

    setPreviewPlan(suggestions);
    toast.success(`AI đã lập phương án cân bằng: Đề xuất điều chuyển ${suggestions.length} công việc.`);
  };

  // Xác nhận thực thi tái cân bằng
  const handleApplyRebalance = async () => {
    if (!previewPlan || previewPlan.length === 0) return;

    setIsApplying(true);
    try {
      // Gọi API cập nhật assignee cho từng task được đề xuất
      await Promise.all(
        previewPlan.map((item) =>
          apiClient.put(`/tasks/${item.taskId}`, { assigneeId: item.toUser.id })
        )
      );

      toast.success(`✨ Đã tái cân bằng thành công ${previewPlan.length} công việc sang nhân sự rảnh rỗi!`);
      setPreviewPlan(null);
      if (onRebalanceSuccess) {
        onRebalanceSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('Lỗi rebalance:', err);
      toast.error(err?.response?.data?.message || 'Không thể thực thi cân bằng tải.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md shadow-amber-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Bản Đồ Nhiệt Tải Công Việc & AI Tự Động Cân Bằng</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 uppercase">
                  Workload Heatmap
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Phân tích tình trạng quá tải nhân sự và phân bổ lại task tự động bằng thuật toán AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Tổng Thành Viên</span>
              <p className="text-lg font-black text-slate-800 dark:text-white">{stats.total}</p>
            </div>
            <Users className="w-5 h-5 text-indigo-500 opacity-60" />
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">🟢 Rảnh Rỗi (0-2)</span>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{stats.idle}</p>
            </div>
            <TrendingDown className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">🟡 Đang Tối Ưu (3-4)</span>
              <p className="text-lg font-black text-amber-700 dark:text-amber-300">{stats.optimal}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-amber-500" />
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">🔴 Quá Tải (≥ 5)</span>
              <p className="text-lg font-black text-rose-700 dark:text-rose-300">{stats.overload}</p>
            </div>
            <Flame className="w-5 h-5 text-rose-500 animate-pulse" />
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Rebalance Preview Notice if generated */}
          {previewPlan && previewPlan.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border-2 border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600 animate-spin" />
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    Phương Án Cân Bằng Đề Xuất Bởi AI ({previewPlan.length} công việc):
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPlan(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Bỏ qua
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {previewPlan.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/80 text-xs shadow-2xs"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                        {item.taskTitle}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Ưu tiên: <strong className="text-rose-600">{item.priority}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <span className="font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
                        {item.fromUser.name}
                      </span>
                      <ArrowRight className="w-4 h-4 text-indigo-500" />
                      <span className="font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                        {item.toUser.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/60">
                <button
                  type="button"
                  onClick={() => setPreviewPlan(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white/80"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleApplyRebalance}
                  disabled={isApplying}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Xác Nhận Áp Dụng Cân Bằng Ngay</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Danh sách thành viên kèm thanh nhiệt */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Danh Sách Tải Công Việc Thành Viên ({memberWorkloads.length}):
            </h4>

            {memberWorkloads.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Không tìm thấy dữ liệu nhân sự để tính toán tải công việc.
              </div>
            ) : (
              memberWorkloads.map((member) => (
                <div
                  key={member.userId}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-4 transition hover:border-indigo-300 shadow-2xs space-y-3"
                >
                  {/* Row Top: Avatar + Tên + Badge trạng thái */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={member.avatar} name={member.name} size="md" status="online" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {member.name}
                          </h4>
                          {member.role === 'MANAGER' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                              Quản lý
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {member.email} {member.departmentName ? `• ${member.departmentName}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${member.statusColor}`}>
                        {member.statusLabel}
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 min-w-[50px] text-right">
                        {member.activeCount} task active
                      </span>
                    </div>
                  </div>

                  {/* Thanh Heatmap Progress Bar */}
                  <div className="space-y-1">
                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${member.percent}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${member.progressColor}`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>Mức tải: {member.percent}%</span>
                      {member.overdueOrUrgentCount > 0 && (
                        <span className="text-rose-500 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {member.overdueOrUrgentCount} việc khẩn cấp / quá hạn
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Task Pills preview */}
                  {member.activeTasks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {member.activeTasks.slice(0, 4).map((t) => (
                        <span
                          key={t.id}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium truncate max-w-[200px] ${
                            t.isOverdue
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                              : t.status === 'TODO'
                              ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                          }`}
                          title={t.title}
                        >
                          {t.status === 'TODO' ? '📋 ' : '⚡ '}
                          {t.title}
                        </span>
                      ))}
                      {member.activeTasks.length > 4 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 font-semibold">
                          +{member.activeTasks.length - 4} việc khác
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleGenerateAiPlan}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:from-amber-600 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>✨ AI Tự Động Cân Bằng Tải (Auto-Rebalance)</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default WorkloadHeatmapModal;


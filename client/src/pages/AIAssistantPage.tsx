import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  GitFork,
  FileText,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  Copy,
  PlusCircle,
  Clock,
  CheckSquare,
  Zap,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  FolderKanban,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks/useAuth';

interface GeneratedSubtask {
  id: string;
  title: string;
  estimatedHours: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
  checked: boolean;
}

interface RiskItem {
  id: string;
  projectName: string;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  factors: string[];
  recommendation: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

export const AIAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const canManageTasks = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [activeTab, setActiveTab] = useState<'breakdown' | 'summary' | 'risk'>('breakdown');
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // ======================
  // Tab 1: Task Breakdown State
  // ======================
  const [largeTaskDescription, setLargeTaskDescription] = useState('');
  const [breakdownProjectId, setBreakdownProjectId] = useState('');
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [generatedSubtasks, setGeneratedSubtasks] = useState<GeneratedSubtask[]>([]);

  // ======================
  // Tab 2: Progress Summary State
  // ======================
  const [summaryProjectId, setSummaryProjectId] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryReport, setSummaryReport] = useState<string | null>(null);

  // ======================
  // Tab 3: Risk Warning State
  // ======================
  const [isScanningRisk, setIsScanningRisk] = useState(false);
  const [riskList, setRiskList] = useState<RiskItem[]>([]);

  useEffect(() => {
    apiClient.get('/projects')
      .then((response) => {
        const projectList = (Array.isArray(response.data) ? response.data : []) as ProjectOption[];
        setProjects(projectList);
        if (projectList.length > 0) {
          setBreakdownProjectId((current) => current || projectList[0].id);
          setSummaryProjectId((current) => current || projectList[0].id);
        }
      })
      .catch(() => toast.error('Không thể tải danh sách dự án từ máy chủ.'));
  }, []);

  // Tab 1: Handle Trigger Breakdown
  const handleBreakdownTask = async () => {
    if (!largeTaskDescription.trim()) {
      toast.error('Vui lòng nhập mô tả công việc cần phân tách!');
      return;
    }
    if (!breakdownProjectId) {
      toast.error('Tài khoản hiện chưa có dự án để phân rã công việc.');
      return;
    }

    setIsBreakingDown(true);
    try {
      const response = await apiClient.post<GeneratedSubtask[]>('/ai/breakdown', {
        title: largeTaskDescription.slice(0, 120),
        description: largeTaskDescription,
      });

      const suggestions = response.data;
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error('AI không trả về danh sách công việc hợp lệ.');
      }
      setGeneratedSubtasks(suggestions.map((task: Omit<GeneratedSubtask, 'id' | 'checked'>, index: number) => ({
        ...task,
        id: `ai-sub-${Date.now()}-${index}`,
        checked: true,
      })));
      toast.success('AI đã phân rã công việc thành công! ✨');
    } catch {
      toast.error('Không thể phân rã công việc. Vui lòng kiểm tra cấu hình AI và thử lại.');
    } finally {
      setIsBreakingDown(false);
    }
  };

  const toggleSubtaskCheck = (id: string) => {
    setGeneratedSubtasks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleAddSubtasksToProject = async () => {
    const selected = generatedSubtasks.filter((s) => s.checked);
    if (selected.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 sub-task để thêm vào dự án');
      return;
    }
    if (!breakdownProjectId) {
      toast.error('Vui lòng chọn một dự án trước khi thêm công việc.');
      return;
    }

    let createdCount = 0;
    try {
      for (const task of selected) {
        await apiClient.post('/tasks', {
          projectId: breakdownProjectId,
          title: task.title,
          description: task.description,
          estimatedHours: task.estimatedHours,
          priority: task.priority,
        });
        createdCount += 1;
      }
      toast.success(`Đã thêm thành công ${selected.length} tasks vào bảng Kanban! 🎉`);
    } catch {
      toast.error(
        createdCount > 0
          ? `Đã thêm ${createdCount}/${selected.length} công việc; phần còn lại thất bại. Vui lòng kiểm tra backlog.`
          : 'Không thể thêm công việc. Vui lòng kiểm tra quyền truy cập và thử lại.'
      );
    }
  };

  // Tab 2: Handle Summarize
  const handleSummarizeProgress = async () => {
    if (!summaryProjectId) {
      toast.error('Tài khoản hiện chưa có dự án để phân tích tiến độ.');
      return;
    }
    setIsSummarizing(true);
    try {
      const response = await apiClient.post<{ summaryMarkdown: string }>('/ai/summary', {
        projectId: summaryProjectId,
      });
      const report = response.data?.summaryMarkdown;
      if (typeof report !== 'string' || report.length === 0) {
        throw new Error('Máy chủ không trả về báo cáo tiến độ.');
      }
      setSummaryReport(report);
      toast.success('Đã cập nhật bản tóm tắt tiến độ mới nhất!');
    } catch {
      toast.error('Không thể tạo báo cáo. Vui lòng kiểm tra cấu hình AI và thử lại.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCopyReport = () => {
    if (summaryReport) {
      navigator.clipboard.writeText(summaryReport);
      toast.success('Đã sao chép nội dung báo cáo vào clipboard! 📋');
    }
  };

  // Tab 3: Handle Scan Risk
  const handleScanRisk = async () => {
    setIsScanningRisk(true);
    try {
      const response = await apiClient.post<Array<{
        projectId: string;
        projectName: string;
        riskLevel: RiskItem['level'] | 'CRITICAL';
        overallScore: number;
        riskFactors: string[];
        recommendations: string[];
      }>>('/ai/risks');
      const risks = response.data;
      if (!Array.isArray(risks)) {
        throw new Error('Máy chủ không trả về kết quả phân tích rủi ro.');
      }
      setRiskList(risks.map((risk: {
        projectId: string;
        projectName: string;
        riskLevel: RiskItem['level'] | 'CRITICAL';
        overallScore: number;
        riskFactors: string[];
        recommendations: string[];
      }) => ({
        id: risk.projectId,
        projectName: risk.projectName,
        level: risk.riskLevel === 'CRITICAL' ? 'HIGH' : risk.riskLevel,
        score: 100 - risk.overallScore,
        factors: risk.riskFactors,
        recommendation: risk.recommendations.join(' '),
      })));
      toast.success('Đã phân tích rủi ro dựa trên dữ liệu dự án hiện tại.');
    } catch {
      toast.error('Không thể quét rủi ro. Vui lòng kiểm tra cấu hình AI và thử lại.');
    } finally {
      setIsScanningRisk(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-pink-300 border border-pink-500/30 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              Gemini Powered AI
            </span>
            <span className="text-xs text-slate-400">Trợ Lý Thông Minh Cho Sprint</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300">
            AI Assistant Trợ Lý Quản Trị
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Tự động hóa phân tách công việc phức tạp, tóm tắt tiến độ điều hành và phát hiện sớm các rủi ro sprint.
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex p-1 rounded-2xl bg-slate-900 border border-slate-800 max-w-xl">
        <button
          onClick={() => setActiveTab('breakdown')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'breakdown'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <GitFork className="w-4 h-4" />
          <span>1. Phân Tách Công Việc</span>
        </button>

        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'summary'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>2. Tóm Tắt Tiến Độ</span>
        </button>

        <button
          onClick={() => setActiveTab('risk')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'risk'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>3. Cảnh Báo Rủi Ro</span>
        </button>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {/* ============================================================== */}
        {/* TAB 1: TASK BREAKDOWN */}
        {/* ============================================================== */}
        {activeTab === 'breakdown' && (
          <motion.div
            key="tab-breakdown"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Input Box (5 cols) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-indigo-400" />
                  Mô Tả Yêu Cầu / User Story Lớn
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nhập mô tả tính năng cần phân rã thành các nhiệm vụ cụ thể
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Chọn Dự Án Mục Tiêu
                </label>
                <select
                  value={breakdownProjectId}
                  onChange={(e) => setBreakdownProjectId(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-800 border border-slate-700 text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">Chọn dự án</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nội dung chi tiết yêu cầu
                </label>
                <textarea
                  rows={6}
                  value={largeTaskDescription}
                  onChange={(e) => setLargeTaskDescription(e.target.value)}
                  placeholder="Nhập mô tả công việc cần phân tách..."
                  className="w-full p-3.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              <button
                onClick={handleBreakdownTask}
                disabled={isBreakingDown}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:to-pink-700 active:scale-[0.98] shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isBreakingDown ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI Đang Phân Tích & Phân Rã...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Phân Tách Ngay Bằng AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Results Box (7 cols) */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Kết Quả Gợi Ý Danh Sách Tasks ({generatedSubtasks.length})
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chọn các tasks phù hợp để đưa vào backlog Kanban của dự án
                    </p>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                    {generatedSubtasks.filter((s) => s.checked).length} đã chọn
                  </span>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {generatedSubtasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => toggleSubtaskCheck(task.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        task.checked
                          ? 'bg-indigo-950/30 border-indigo-500/50 shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.checked}
                          onChange={() => {}}
                          className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />

                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="text-xs font-bold text-white">
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  task.priority === 'HIGH'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                }`}
                              >
                                {task.priority}
                              </span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {task.estimatedHours}h
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {task.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {canManageTasks && (
                <div className="pt-5 border-t border-slate-800 flex justify-end gap-3 mt-4">
                  <button
                    onClick={handleAddSubtasksToProject}
                    disabled={!breakdownProjectId || generatedSubtasks.length === 0}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Thêm Vào Dự Án (Kanban)</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: PROGRESS SUMMARY */}
        {/* ============================================================== */}
        {activeTab === 'summary' && (
          <motion.div
            key="tab-summary"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Control Bar */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs text-slate-300 font-medium">Dự án:</span>
                  <select
                    value={summaryProjectId}
                    onChange={(e) => setSummaryProjectId(e.target.value)}
                    className="text-xs rounded-xl bg-slate-800 border border-slate-700 text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Chọn dự án</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSummarizeProgress}
                  disabled={isSummarizing}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl hover:from-indigo-600 hover:to-purple-700 shadow-md flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isSummarizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang Phân Tích Dữ Liệu...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Cập Nhật Phân Tích Tiến Độ</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopyReport}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sao Chép Báo Cáo</span>
                </button>
              </div>
            </div>

            {/* Markdown Report View */}
            <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl">
              {isSummarizing ? (
                <div className="space-y-4 py-8">
                  <div className="h-6 bg-slate-800 rounded-lg w-1/3 animate-pulse" />
                  <div className="h-4 bg-slate-800/60 rounded w-full animate-pulse" />
                  <div className="h-4 bg-slate-800/60 rounded w-5/6 animate-pulse" />
                  <div className="h-4 bg-slate-800/60 rounded w-4/6 animate-pulse" />
                  <div className="h-6 bg-slate-800 rounded-lg w-1/4 mt-6 animate-pulse" />
                  <div className="h-4 bg-slate-800/60 rounded w-full animate-pulse" />
                </div>
              ) : (
                <div className="prose prose-invert max-w-none text-slate-200 text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {summaryReport || 'Chưa có báo cáo. Chọn dự án và tạo phân tích để xem tiến độ từ dữ liệu thực.'}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: RISK WARNING */}
        {/* ============================================================== */}
        {activeTab === 'risk' && (
          <motion.div
            key="tab-risk"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Top Alert Action */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Bộ Quét Rủi Ro Dự Án Thông Minh (AI Early Warning)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Phân tích tốc độ hoàn thành, quá hạn tasks, và tải công việc thành viên để cảnh báo trước rủi ro trễ hạn sprint.
                  </p>
                </div>
              </div>

              <button
                onClick={handleScanRisk}
                disabled={isScanningRisk}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all shrink-0"
              >
                {isScanningRisk ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang Quét Rủi Ro...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>Quét Rủi Ro Toàn Bộ Dự Án</span>
                  </>
                )}
              </button>
            </div>

            {/* Risk Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {riskList.map((item) => {
                const isHigh = item.level === 'HIGH';
                const isMed = item.level === 'MEDIUM';

                const cardBorder = isHigh
                  ? 'border-rose-500/40 bg-rose-950/10'
                  : isMed
                  ? 'border-amber-500/40 bg-amber-950/10'
                  : 'border-emerald-500/40 bg-emerald-950/10';

                const badgeClass = isHigh
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : isMed
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                return (
                  <div
                    key={item.id}
                    className={`p-6 rounded-2xl border ${cardBorder} shadow-xl backdrop-blur-xl flex flex-col justify-between`}
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}`}
                        >
                          RỦI RO: {item.level} ({item.score}/100)
                        </span>

                        <div className="flex items-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isHigh
                                ? 'bg-rose-500 animate-ping'
                                : isMed
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                          />
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white mb-4 line-clamp-1">
                        {item.projectName}
                      </h4>

                      {/* Factors */}
                      <div className="space-y-2 mb-4">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Yếu tố cảnh báo:
                        </span>
                        {item.factors.map((factor, fIdx) => (
                          <div
                            key={fIdx}
                            className="flex items-start gap-2 text-xs text-slate-300"
                          >
                            <span className="text-rose-400 text-sm leading-none">•</span>
                            <span className="leading-snug">{factor}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="pt-4 border-t border-slate-800/80">
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                        <strong className="text-indigo-300 block mb-1">
                          💡 Khuyến nghị từ AI:
                        </strong>
                        <p className="text-slate-300 leading-relaxed">
                          {item.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {riskList.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                Chưa có kết quả quét. Chạy phân tích để xem rủi ro từ dữ liệu dự án hiện tại.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIAssistantPage;

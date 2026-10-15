import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  ListTree,
  FileSpreadsheet,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Clock,
  ShieldAlert,
  Bot,
  Copy,
  Check,
} from 'lucide-react';
import {
  aiService,
  SubTaskSuggestion,
  RiskWarning,
} from '../services/aiService';
import api from '../services/api';
import Badge from './ui/Badge';

export interface AIAssistantModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onApplySubTasks?: (subTasks: SubTaskSuggestion[]) => void;
  initialProjectId?: string;
}

type AITab = 'breakdown' | 'summary' | 'risk';

interface ProjectOption {
  id: string;
  name: string;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen: controlledIsOpen,
  onClose,
  onApplySubTasks,
  initialProjectId,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const [activeTab, setActiveTab] = useState<AITab>('breakdown');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // Tab 1: Breakdown task
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [subTaskResults, setSubTaskResults] = useState<SubTaskSuggestion[]>([]);

  // Tab 2: Summary
  const [projectId, setProjectId] = useState(initialProjectId || '');
  const [summaryResult, setSummaryResult] = useState('');
  const [streamingText, setStreamingText] = useState('');

  // Tab 3: Risk Warning
  const [riskResults, setRiskResults] = useState<RiskWarning[]>([]);

  useEffect(() => {
    if (initialProjectId) setProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    api.get<ProjectOption[]>('/projects')
      .then((response) => {
        setProjects(response.data);
        if (response.data.length > 0) {
          setProjectId((current) => current || response.data[0].id);
        }
      })
      .catch(() => setErrorMessage('Không thể tải danh sách dự án từ máy chủ.'));
  }, []);

  // Typewriter streaming effect helper
  const streamText = (fullText: string) => {
    setStreamingText('');
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setStreamingText((prev) => prev + fullText.charAt(currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 15);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  // Handle Tab 1: Breakdown
  const handleBreakdownTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setIsLoading(true);
    setSubTaskResults([]);
    setErrorMessage('');
    try {
      const suggestions = await aiService.breakdownTask(
        taskTitle,
        taskDescription,
        projectId
      );
      setSubTaskResults(suggestions);
    } catch {
      setErrorMessage('Không thể phân rã công việc. Vui lòng kiểm tra cấu hình AI và thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Tab 2: Summary
  const handleGenerateSummary = async () => {
    setIsLoading(true);
    setSummaryResult('');
    setStreamingText('');
    setErrorMessage('');

    try {
      if (!projectId) throw new Error('Vui lòng chọn dự án để tạo báo cáo.');
      const summary = await aiService.generateSummary(projectId);
      setSummaryResult(summary);
      streamText(summary);
    } catch {
      setErrorMessage('Không thể tạo báo cáo. Vui lòng kiểm tra cấu hình AI và thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Tab 3: Risk
  const handleDetectRisks = async () => {
    setIsLoading(true);
    setRiskResults([]);
    setErrorMessage('');

    try {
      const risks = await aiService.detectRisks();
      setRiskResults(risks);
    } catch {
      setErrorMessage('Không thể quét rủi ro. Vui lòng kiểm tra cấu hình AI và thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Floating Action Button */}
      {controlledIsOpen === undefined && (
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setInternalIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3.5 text-white font-semibold shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all focus:outline-none ring-4 ring-white/20"
          aria-label="Mở AI Assistant"
        >
          <Sparkles className="w-5 h-5 animate-spin-slow text-amber-300" />
          <span className="text-sm">AI Assistant</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider">
            Pro
          </span>
        </motion.button>
      )}

      {/* Main Modal */}
      <AnimatePresence>
        {isVisible && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Dialog Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
              className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-indigo-200/50 dark:border-indigo-900/40 overflow-hidden z-10"
            >
              {/* Header Gradient */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        TaskFlow AI Assistant
                      </h2>
                      <span className="rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 px-2 py-0.5 text-[10px] font-extrabold text-white uppercase tracking-wider">
                        AI Model v4
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tối ưu hóa quản lý công việc và đánh giá rủi ro dự án bằng trí tuệ nhân tạo
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40">
                <button
                  onClick={() => setActiveTab('breakdown')}
                  className={`flex items-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === 'breakdown'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  <ListTree className="w-4 h-4" />
                  <span>Phân rã Sub-tasks</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('summary');
                    if (!summaryResult) handleGenerateSummary();
                  }}
                  className={`flex items-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === 'summary'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Tổng kết & Báo cáo</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('risk');
                    if (riskResults.length === 0) handleDetectRisks();
                  }}
                  className={`flex items-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === 'risk'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Phát hiện Rủi ro</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {errorMessage && (
                  <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                    {errorMessage}
                  </p>
                )}

                {/* TAB 1: TASK BREAKDOWN */}
                {activeTab === 'breakdown' && (
                  <div className="space-y-6">
                    <form onSubmit={handleBreakdownTask} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                          Tên công việc chính
                        </label>
                        <input
                          type="text"
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          placeholder="Ví dụ: Xây dựng hệ thống thanh toán qua cổng VNPay & MoMo..."
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                          Mô tả chi tiết (Tùy chọn)
                        </label>
                        <textarea
                          rows={3}
                          value={taskDescription}
                          onChange={(e) => setTaskDescription(e.target.value)}
                          placeholder="Nhập thêm yêu cầu kỹ thuật, tài liệu API, hoặc mong muốn đầu ra..."
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isLoading || !taskTitle.trim()}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-50 transition"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          <span>Phân rã bằng AI</span>
                        </button>
                      </div>
                    </form>

                    {/* Loading Indicator */}
                    {isLoading && (
                      <div className="flex flex-col items-center justify-center py-10 space-y-3">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm">
                          <Bot className="w-5 h-5 animate-bounce" />
                          <span>AI đang phân tích và tối ưu hóa các bước công việc...</span>
                        </div>
                        {/* 3 Dots Bouncing */}
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-bounce" />
                        </div>
                      </div>
                    )}

                    {/* Breakdown Results */}
                    {!isLoading && subTaskResults.length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Đề xuất {subTaskResults.length} Sub-tasks:
                          </h4>
                          {onApplySubTasks && (
                            <button
                              onClick={() => onApplySubTasks(subTaskResults)}
                              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              <span>Áp dụng toàn bộ</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {subTaskResults.map((sub, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 flex items-start justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold shrink-0">
                                    {idx + 1}
                                  </span>
                                  <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                                    {sub.title}
                                  </p>
                                </div>
                                {sub.description && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 pl-7">
                                    {sub.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <Clock className="w-3 h-3" />
                                  {sub.estimatedHours}h
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: SUMMARY & REPORT */}
                {activeTab === 'summary' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Báo cáo được sinh dựa trên các công việc thực tế của dự án
                      </span>
                      <div className="flex items-center gap-2">
                        {summaryResult && (
                          <button
                            onClick={() => handleCopyText(summaryResult)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                          </button>
                        )}
                        <button
                          onClick={handleGenerateSummary}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Sinh lại báo cáo</span>
                        </button>
                      </div>
                    </div>
                    <select
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <option value="">Chọn dự án</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>

                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                        <p className="text-xs font-medium text-slate-500">
                          Đang tổng hợp dữ liệu toàn bộ dự án...
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 p-5 font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                        {streamingText || summaryResult || 'Chưa có báo cáo nào được tạo.'}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: RISK WARNING */}
                {activeTab === 'risk' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Phân tích rủi ro dựa trên tiến độ, deadline và phân bổ nhân sự
                      </span>
                      <button
                        onClick={handleDetectRisks}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Quét lại rủi ro</span>
                      </button>
                    </div>

                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                        <p className="text-xs font-medium text-slate-500">
                          Đang phân tích các điểm nghẽn và quá tải nhân sự...
                        </p>
                      </div>
                    ) : riskResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Không có rủi ro được AI phát hiện trong các dự án hiện có.
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Kết quả được tạo từ dữ liệu dự án hiện tại.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {riskResults.map((risk) => (
                          <div
                            key={risk.id}
                            className={`rounded-2xl border p-4 transition ${
                              risk.riskLevel === 'CRITICAL'
                                ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20'
                                : risk.riskLevel === 'HIGH'
                                ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
                                : 'border-sky-200 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      risk.riskLevel === 'CRITICAL'
                                        ? 'danger'
                                        : risk.riskLevel === 'HIGH'
                                        ? 'warning'
                                        : 'info'
                                    }
                                    size="sm"
                                    withDot
                                  >
                                    {risk.riskLevel}
                                  </Badge>
                                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {risk.title}
                                  </h4>
                                </div>
                                {risk.taskTitle && (
                                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                    Task liên quan: {risk.taskTitle}
                                  </p>
                                )}
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1">
                                  {risk.description}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-slate-200/60 dark:border-slate-800 text-xs">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                💡 Đề xuất khắc phục từ AI:{' '}
                              </span>
                              <span className="text-slate-600 dark:text-slate-300">
                                {risk.recommendation}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40 flex items-center justify-between text-xs text-slate-400">
                <span>TaskFlow AI Agent • Powered by Deep Learning & LLM</span>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIAssistantModal;

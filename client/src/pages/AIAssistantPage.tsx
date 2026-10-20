import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  GitFork,
  FileText,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  Copy,
  PlusCircle,
  Clock,
  CheckSquare,
  Zap,
  ArrowRight,
  FolderKanban,
  Check,
  Bot,
  User as UserIcon,
  Search,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks/useAuth';
import taskService from '@/services/taskService';

interface GeneratedSubtask {
  id: string;
  title: string;
  estimatedHours: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
  checked: boolean;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AIAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const canManageTasks = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [activeTab, setActiveTab] = useState<'breakdown' | 'summary' | 'chat'>('breakdown');
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // ======================
  // Tab 1: Task Breakdown State
  // ======================
  const [largeTaskDescription, setLargeTaskDescription] = useState('');
  const [breakdownProjectId, setBreakdownProjectId] = useState('');
  const [generatedSubtasks, setGeneratedSubtasks] = useState<GeneratedSubtask[]>([]);
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [isPushedToKanban, setIsPushedToKanban] = useState(false);

  // ======================
  // Tab 2: Executive Summary State
  // ======================
  const [summaryProjectId, setSummaryProjectId] = useState('');
  const [summaryReport, setSummaryReport] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isCopiedSummary, setIsCopiedSummary] = useState(false);

  // ======================
  // Tab 3: Chatbot Data Assistant State
  // ======================
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Xin chào! Tôi là Trợ Lý Dữ Liệu AI. Bạn có thể hỏi tôi về tiến độ dự án, các công việc trễ hạn, danh sách nhiệm vụ cần làm hoặc tìm kiếm bất kỳ tác vụ nào trong hệ thống!',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load Projects for dropdowns
  useEffect(() => {
    let active = true;
    const fetchProjects = async () => {
      try {
        const response = await apiClient.get<Array<{ id: string; name: string }>>('/projects');
        const list = Array.isArray(response.data) ? response.data : [];
        if (active) {
          setProjects(list);
          if (list.length > 0) {
            setBreakdownProjectId(list[0].id);
            setSummaryProjectId(list[0].id);
          }
        }
      } catch (error) {
        console.error('Không thể tải danh sách dự án:', error);
      }
    };
    void fetchProjects();
    return () => {
      active = false;
    };
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Tab 1: Handle Breakdown
  const handleBreakdownTask = async () => {
    if (!largeTaskDescription.trim()) {
      toast.error('Vui lòng nhập mô tả hoặc User Story công việc.');
      return;
    }
    setIsBreakingDown(true);
    setIsPushedToKanban(false);
    try {
      const response = await apiClient.post<
        Array<{
          title: string;
          estimatedHours: number;
          priority: GeneratedSubtask['priority'];
          description: string;
        }>
      >('/ai/breakdown', {
        title: largeTaskDescription.slice(0, 100),
        description: largeTaskDescription,
        projectId: breakdownProjectId,
      });

      const suggestions = Array.isArray(response.data)
        ? response.data
        : Array.isArray((response.data as any)?.data)
        ? (response.data as any).data
        : [];

      if (suggestions.length === 0) {
        throw new Error('Không nhận được danh sách tasks gợi ý từ AI.');
      }

      setGeneratedSubtasks(
        suggestions.map((item, index) => ({
          id: `ai-task-${Date.now()}-${index}`,
          title: item.title,
          estimatedHours: item.estimatedHours || 2,
          priority: item.priority || 'MEDIUM',
          description: item.description || '',
          checked: true,
        }))
      );
      toast.success(`AI đã phân rã thành công ${suggestions.length} công việc cụ thể! ✨`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể phân rã công việc. Vui lòng thử lại.');
    } finally {
      setIsBreakingDown(false);
    }
  };

  const toggleSubtaskCheck = (id: string) => {
    setGeneratedSubtasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, checked: !task.checked } : task))
    );
  };

  // Push Selected Subtasks Directly into DB / Kanban
  const handlePushToKanban = async () => {
    if (!breakdownProjectId) {
      toast.error('Vui lòng chọn dự án đích để thêm công việc.');
      return;
    }
    const selected = generatedSubtasks.filter((s) => s.checked);
    if (selected.length === 0) {
      toast.error('Vui lòng tích chọn ít nhất 1 task.');
      return;
    }

    try {
      let createdCount = 0;
      for (const task of selected) {
        await taskService.createTask({
          title: task.title,
          description: task.description,
          projectId: breakdownProjectId,
          estimatedHours: task.estimatedHours,
          priority: task.priority,
        });
        createdCount += 1;
      }
      setIsPushedToKanban(true);
      toast.success(`Đã thêm thành công ${createdCount} tasks vào bảng Kanban dự án! 🎉`);
    } catch {
      toast.error('Có lỗi xảy ra khi lưu tasks vào bảng Kanban.');
    }
  };

  // Tab 2: Handle Summarize
  const handleSummarizeProgress = async () => {
    if (!summaryProjectId) {
      toast.error('Vui lòng chọn dự án cần phân tích tiến độ.');
      return;
    }
    setIsSummarizing(true);
    setIsCopiedSummary(false);
    try {
      const response = await apiClient.post<{ summaryMarkdown: string }>('/ai/summary', {
        projectId: summaryProjectId,
      });
      const report = response.data?.summaryMarkdown || (response.data as any)?.data?.summaryMarkdown;
      if (typeof report !== 'string' || !report.trim()) {
        throw new Error('Máy chủ không trả về báo cáo tiến độ.');
      }
      setSummaryReport(report);
      toast.success('Đã cập nhật bản tóm tắt tiến độ điều hành mới nhất! 📊');
    } catch {
      toast.error('Không thể tạo báo cáo. Vui lòng thử lại.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCopySummary = () => {
    if (summaryReport) {
      navigator.clipboard.writeText(summaryReport);
      setIsCopiedSummary(true);
      toast.success('Đã sao chép nội dung báo cáo vào Clipboard! 📋');
      setTimeout(() => setIsCopiedSummary(false), 2000);
    }
  };

  // Tab 3: Handle Chatbot Send
  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = chatInput.trim();
    if (!query || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await apiClient.post<any>('/ai/search', {
        query,
      });

      const matchedTasks = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
        ? response.data
        : [];

      let answerText = '';
      if (matchedTasks.length > 0) {
        answerText = `Tôi đã tìm thấy **${matchedTasks.length} công việc** liên quan đến yêu cầu của bạn:\n\n` +
          matchedTasks
            .slice(0, 5)
            .map(
              (t: any, i: number) =>
                `${i + 1}. **${t.title}** (${t.status}) - Phụ trách: *${t.assignee?.name || 'Chưa gán'}*`
            )
            .join('\n') +
          (matchedTasks.length > 5 ? `\n\n*...và ${matchedTasks.length - 5} công việc khác.*` : '');
      } else {
        answerText = `Dựa trên dữ liệu hiện tại, tôi không tìm thấy tác vụ nào khớp trực tiếp với câu hỏi: *"${query}"*. Bạn có thể thử tìm theo tên thành viên, trạng thái (ví dụ: "việc trễ hạn", "việc cần làm") hoặc từ khóa chức năng cụ thể!`;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: answerText,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, botMsg]);
    } catch {
      const botErrorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        text: 'Xin lỗi, hiện tại tôi đang gặp chút gián đoạn khi kết nối cơ sở dữ liệu. Bạn vui lòng thử lại sau giây lát nhé!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, botErrorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 transition-colors duration-200 dark:bg-slate-950 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-pink-500/10 text-purple-600 border border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30 inline-flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Gemini AI Workspace 3 trong 1
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Enterprise Artificial Intelligence Assistant
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            AI Assistant Trợ Lý Quản Trị & Điều Hành
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Bóc tách User Story thành tasks, tổng hợp báo cáo điều hành nhanh và chatbot hỏi đáp dữ liệu dự án thời gian thực.
          </p>
        </div>
      </header>

      {/* Tabs Navigation (3 in 1 Workspace) */}
      <nav className="flex p-1.5 rounded-3xl bg-slate-200/70 border border-slate-300/80 dark:bg-slate-900/90 dark:border-slate-800 max-w-2xl backdrop-blur-xl shadow-inner gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('breakdown')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
            activeTab === 'breakdown'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <GitFork className="w-4 h-4" />
          <span>Bóc Tách Sub-tasks</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
            activeTab === 'summary'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Báo Cáo Điều Hành</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chatbot Dữ Liệu Live</span>
        </button>
      </nav>

      {/* Main Tab Panels */}
      <AnimatePresence mode="wait">
        {/* TAB 1: SUB-TASK BREAKDOWN */}
        {activeTab === 'breakdown' && (
          <motion.div
            key="tab-breakdown"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Input Panel (5 cols) */}
            <div className="lg:col-span-5 p-6 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <GitFork className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Bóc Tách User Story & Yêu Cầu Lớn
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tự động phân rã thành danh sách tasks con khả thi
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chọn dự án đích
                  </label>
                  <select
                    value={breakdownProjectId}
                    onChange={(e) => setBreakdownProjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nội dung User Story / Yêu cầu phức tạp *
                  </label>
                  <textarea
                    rows={6}
                    value={largeTaskDescription}
                    onChange={(e) => setLargeTaskDescription(e.target.value)}
                    placeholder="VD: Xây dựng hệ thống thông báo realtime cho người dùng qua WebSockets, hỗ trợ đánh dấu đã đọc và âm thanh chuông báo..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleBreakdownTask}
                disabled={isBreakingDown}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-500/20 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isBreakingDown ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI Đang Phân Tích & Bóc Tách...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Phân Tách Công Việc Ngay</span>
                  </>
                )}
              </button>
            </div>

            {/* Results Panel (7 cols) */}
            <div className="lg:col-span-7 p-6 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Danh Sách Tasks Gợi Ý ({generatedSubtasks.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tích chọn các công việc phù hợp để đẩy trực tiếp vào bảng Kanban
                    </p>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-500/20">
                    {generatedSubtasks.filter((s) => s.checked).length} đã chọn
                  </span>
                </div>

                {generatedSubtasks.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <Lightbulb className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs">Nhập yêu cầu bên trái và nhấn nút "Phân Tách Công Việc Ngay".</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {generatedSubtasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => toggleSubtaskCheck(task.id)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                          task.checked
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-500/40 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={task.checked}
                            onChange={() => {}}
                            className="mt-0.5 w-4 h-4 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {task.title}
                              </h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 shrink-0">
                                {task.estimatedHours}h • {task.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                              {task.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {generatedSubtasks.length > 0 && canManageTasks && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handlePushToKanban}
                    disabled={isPushedToKanban}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer disabled:opacity-60"
                  >
                    {isPushedToKanban ? <Check className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                    <span>{isPushedToKanban ? 'Đã Đẩy Vào Kanban' : 'Đẩy Trực Tiếp Vào Dự Án (Kanban)'}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 2: EXECUTIVE SUMMARY */}
        {activeTab === 'summary' && (
          <motion.div
            key="tab-summary"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Báo Cáo Tóm Tắt Tiến Độ Điều Hành (AI Executive Summary)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Phân tích toàn diện điểm mạnh, điểm nghẽn và khuyến nghị hành động nhanh cho Manager.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={summaryProjectId}
                  onChange={(e) => setSummaryProjectId(e.target.value)}
                  className="text-xs px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer max-w-[220px] truncate"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleSummarizeProgress}
                  disabled={isSummarizing}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-60"
                >
                  {isSummarizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang Phân Tích...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Sinh Báo Cáo</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Markdown Report Display */}
            <div className="p-8 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nội Dung Báo Cáo Điều Hành
                </span>
                {summaryReport && (
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                  >
                    {isCopiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedSummary ? 'Đã Copy' : 'Copy Nội Dung'}</span>
                  </button>
                )}
              </div>

              {!summaryReport && !isSummarizing && (
                <div className="py-20 text-center text-slate-400 space-y-2">
                  <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Chưa có báo cáo nào được sinh.
                  </p>
                  <p className="text-xs text-slate-400">
                    Chọn một dự án ở trên và bấm "Sinh Báo Cáo" để nhận bản phân tích điều hành chuyên sâu.
                  </p>
                </div>
              )}

              {isSummarizing && (
                <div className="py-20 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">
                    AI đang phân tích các chỉ số tasks, tỷ lệ đúng hạn và rà soát các rủi ro...
                  </p>
                </div>
              )}

              {summaryReport && (
                <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-2 text-slate-700 dark:text-slate-300">
                  {summaryReport.split(/\r?\n/).map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={idx} className="h-2" />;
                    if (trimmed.startsWith('#')) {
                      return (
                        <h4 key={idx} className="text-sm font-extrabold text-slate-900 dark:text-white pt-2">
                          {trimmed.replace(/^#+\s*/, '')}
                        </h4>
                      );
                    }
                    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                      return (
                        <p key={idx} className="flex items-start gap-2 pl-2">
                          <span className="text-indigo-500 mt-0.5">•</span>
                          <span>{trimmed.replace(/^[-*]\s*/, '')}</span>
                        </p>
                      );
                    }
                    return <p key={idx}>{trimmed}</p>;
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 3: CHATBOT DATA ASSISTANT */}
        {activeTab === 'chat' && (
          <motion.div
            key="tab-chat"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col h-[650px] overflow-hidden"
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Trợ Lý Dữ Liệu Dự Án AI</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Truy vấn dữ liệu tasks, tiến độ và nhân sự thời gian thực bằng tiếng Việt
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setChatMessages([
                    {
                      id: 'welcome',
                      sender: 'assistant',
                      text: 'Khung chat đã được làm mới! Bạn có thể đặt câu hỏi về dự án ngay bây giờ.',
                      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    },
                  ])
                }
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                title="Làm mới cuộc trò chuyện"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm ${
                        isUser
                          ? 'bg-gradient-to-br from-indigo-600 to-purple-600'
                          : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      }`}
                    >
                      {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div
                      className={`max-w-[75%] rounded-3xl p-4 text-xs leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-tl-none whitespace-pre-line'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <span
                        className={`text-[9px] mt-1.5 block text-right font-mono ${
                          isUser ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}

              {isChatLoading && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="rounded-3xl rounded-tl-none bg-slate-100 dark:bg-slate-800/80 p-3.5 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>AI đang tra cứu dữ liệu thời gian thực...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px]">
              <span className="text-slate-400 font-semibold shrink-0">Gợi ý câu hỏi:</span>
              <button
                type="button"
                onClick={() => {
                  setChatInput('Tìm các công việc đang quá hạn cần xử lý gấp');
                }}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 shrink-0 cursor-pointer"
              >
                ⚠️ Việc quá hạn
              </button>
              <button
                type="button"
                onClick={() => {
                  setChatInput('Những công việc đang ở trạng thái Cần làm (TODO)?');
                }}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 shrink-0 cursor-pointer"
              >
                📋 Việc cần làm (TODO)
              </button>
              <button
                type="button"
                onClick={() => {
                  setChatInput('Các task có độ ưu tiên cao nhất (URGENT)?');
                }}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 shrink-0 cursor-pointer"
              >
                🔥 Việc khẩn cấp (URGENT)
              </button>
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendChat} className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Đặt câu hỏi hoặc tìm kiếm dữ liệu (VD: 'Tìm việc trễ hạn của Nguyễn Văn A')..."
                className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIAssistantPage;

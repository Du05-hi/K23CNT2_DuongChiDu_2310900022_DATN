import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  ExternalLink,
  Flame,
  AlertTriangle,
  RotateCcw,
  Mic,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks/useAuth';
import taskService, { type UserSummary } from '@/services/taskService';
import aiService from '@/services/aiService';
import TaskDetailsModal from '@/components/TaskDetailsModal';
import VoiceCommandModal, { type ParsedVoiceCommand } from '@/components/voice/VoiceCommandModal';

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

// Helper render text with bold formatting
const renderBoldText = (text: string) => {
  const boldRegex = /\*\*(.*?)\*\*/g;
  if (!boldRegex.test(text)) return text;
  boldRegex.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} className="font-extrabold text-slate-900 dark:text-white">
        {match[1]}
      </strong>
    );
    lastIndex = boldRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts;
};

// Helper render formatted markdown line with interactive [TASK: id | title] Badges (Phần 2)
const renderFormattedLine = (line: string, onTaskClick: (taskId: string) => void) => {
  const taskRegex = /\[TASK:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
  if (!taskRegex.test(line)) {
    return renderBoldText(line);
  }

  taskRegex.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = taskRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderBoldText(line.substring(lastIndex, match.index)));
    }
    const taskId = match[1].trim();
    const taskTitle = match[2].trim();

    parts.push(
      <button
        key={`task-badge-${taskId}-${match.index}`}
        type="button"
        onClick={() => onTaskClick(taskId)}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-1 rounded-xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition hover:shadow-xs active:scale-95 cursor-pointer align-baseline group/btn"
        title="Nhấn để xem chi tiết công việc hoặc mở bảng Kanban"
      >
        <span>📌</span>
        <span className="underline decoration-indigo-400 underline-offset-2">{taskTitle}</span>
        <ExternalLink className="w-3 h-3 text-indigo-500 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
      </button>
    );
    lastIndex = taskRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(renderBoldText(line.substring(lastIndex)));
  }

  return parts;
};

export const AIAssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageTasks = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [activeTab, setActiveTab] = useState<'breakdown' | 'summary' | 'chat'>('chat');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [usersList, setUsersList] = useState<UserSummary[]>([]);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // ======================
  // Tab 1: Task Breakdown State
  // ======================
  const [largeTaskDescription, setLargeTaskDescription] = useState('');
  const [breakdownProjectId, setBreakdownProjectId] = useState('');
  const [generatedSubtasks, setGeneratedSubtasks] = useState<GeneratedSubtask[]>([]);
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [isPushedToKanban, setIsPushedToKanban] = useState(false);
  const [isCopiedBreakdown, setIsCopiedBreakdown] = useState(false);

  // ======================
  // Tab 2: Executive Summary State
  // ======================
  const [summaryProjectId, setSummaryProjectId] = useState('');
  const [summaryReport, setSummaryReport] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isCopiedSummary, setIsCopiedSummary] = useState(false);

  // ======================
  // Tab 3: Chatbot Data Assistant State (AI Live Data-Aware)
  // ======================
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Xin chào! Tôi là Trợ Lý Dữ Liệu Live AI của TaskFlow. Tôi đã nạp toàn bộ dữ liệu dự án và công việc thời gian thực từ cơ sở dữ liệu. Bạn có thể hỏi tôi về tiến độ, các công việc trễ hạn, danh sách nhiệm vụ cần làm hoặc bất kỳ thông tin nào trong hệ thống!',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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

  // Load Users list for TaskDetailsModal
  useEffect(() => {
    let active = true;
    apiClient
      .get<any[]>('/users', { params: { limit: 1000, isActive: true } })
      .then(({ data }) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setUsersList(
          list.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            avatar: u.avatar || undefined,
          }))
        );
      })
      .catch((err) => {
        console.warn('Không thể tải users:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, isChatLoading]);

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
        suggestions.map((s: any, index: number) => ({
          id: `suggested-${Date.now()}-${index}`,
          title: s.title,
          estimatedHours: s.estimatedHours || 2,
          priority: s.priority || 'MEDIUM',
          description: s.description || '',
          checked: true,
        }))
      );
      toast.success('Bóc tách sub-tasks thành công!');
    } catch (error: any) {
      console.error('Lỗi khi phân tách task:', error);
      toast.error('Không thể phân tách task. Vui lòng thử lại sau.');
    } finally {
      setIsBreakingDown(false);
    }
  };

  // Push Subtasks to Kanban
  const handlePushToKanban = async () => {
    const selected = generatedSubtasks.filter((s) => s.checked);
    if (selected.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 task con để đưa vào bảng Kanban.');
      return;
    }

    try {
      await Promise.all(
        selected.map((item) =>
          taskService.createTask({
            title: item.title,
            description: item.description,
            priority: item.priority,
            estimatedHours: item.estimatedHours,
            projectId: breakdownProjectId,
            status: 'TODO',
          })
        )
      );

      setIsPushedToKanban(true);
      toast.success(`Đã thêm thành công ${selected.length} công việc vào bảng Kanban!`);
    } catch (error) {
      console.error('Lỗi khi đẩy task vào Kanban:', error);
      toast.error('Có lỗi xảy ra khi tạo task trên Kanban.');
    }
  };

  // Tab 2: Handle Executive Summary
  const handleGenerateSummary = async () => {
    if (!summaryProjectId) {
      toast.error('Vui lòng chọn dự án cần tổng hợp báo cáo.');
      return;
    }
    setIsSummarizing(true);
    try {
      const response = await apiClient.post<any>('/ai/summary', {
        projectId: summaryProjectId,
      });

      const text =
        response.data?.data?.summaryMarkdown ||
        response.data?.summaryMarkdown ||
        response.data?.data ||
        response.data;

      if (!text || typeof text !== 'string') {
        throw new Error('Không nhận được nội dung báo cáo.');
      }

      setSummaryReport(text);
      toast.success('Đã sinh báo cáo tiến độ điều hành thành công!');
    } catch (error) {
      console.error('Lỗi khi sinh báo cáo:', error);
      toast.error('Không thể sinh báo cáo. Vui lòng thử lại sau.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCopyBreakdown = () => {
    if (generatedSubtasks.length === 0) return;
    const text = generatedSubtasks
      .map(
        (t, i) => `${i + 1}. [${t.priority}] ${t.title} (${t.estimatedHours}h)\n   ${t.description}`
      )
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setIsCopiedBreakdown(true);
    toast.success('Đã sao chép danh sách tasks con vào Clipboard! 📋');
    setTimeout(() => setIsCopiedBreakdown(false), 2000);
  };

  const handleCopySummary = () => {
    if (summaryReport) {
      navigator.clipboard.writeText(summaryReport);
      setIsCopiedSummary(true);
      toast.success('Đã sao chép nội dung báo cáo vào Clipboard! 📋');
      setTimeout(() => setIsCopiedSummary(false), 2000);
    }
  };

  const handleCopyChatMsg = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép câu trả lời vào Clipboard! 📋');
  };

  // ======================
  // Tab 3: Handle Chatbot Send (Live Data-Aware Chat - Phần 1 & 2)
  // ======================
  const handleSendChat = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const query = (overrideText || chatInput).trim();
    if (!query || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!overrideText) {
      setChatInput('');
    }
    setIsChatLoading(true);

    try {
      const result = await aiService.chatWithLiveData(query);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: result.answer,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, botMsg]);
    } catch (error: any) {
      console.error('Lỗi khi gửi câu hỏi tới AI Live:', error);
      const botErrorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        text: 'Xin lỗi, hiện tại hệ thống AI đang tạm thời gián đoạn kết nối. Bạn vui lòng bấm nút "Làm mới dữ liệu" hoặc thử lại sau giây lát!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, botErrorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleVoiceCommand = (cmd: ParsedVoiceCommand) => {
    setActiveTab('chat');
    const query = cmd.rawText.trim();
    setChatInput(query);
    if (query) {
      handleSendChat(undefined, query);
      toast.success(`🎙️ Đã tự động gửi câu hỏi tới Trợ lý AI: "${query}"`);
    }
  };

  // Nút "Làm mới dữ liệu" (Phần 2)
  const handleRefreshChat = () => {
    setIsRefreshing(true);
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: 'Khung chat đã được làm mới! Toàn bộ dữ liệu dự án và công việc thời gian thực đã được đồng bộ từ cơ sở dữ liệu. Bạn có thể tiếp tục đặt câu hỏi.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Đã nạp lại dữ liệu dự án thời gian thực thành công! 🔄');
    }, 600);
  };

  // Khi click vào thẻ [TASK: id | title] (Phần 2)
  const handleTaskClick = async (taskId: string) => {
    try {
      const task = await taskService.getTaskById(taskId);
      if (task) {
        setSelectedTaskId(taskId);
      } else {
        toast.error('Không tìm thấy thông tin công việc chỉ định.');
      }
    } catch {
      setSelectedTaskId(taskId);
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
              AI Live Data-Aware Workspace
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              TaskFlow Enterprise AI System
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Trợ Lý Dữ Liệu Dự Án AI Thời Gian Thực
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Hỏi đáp trực tiếp với cơ sở dữ liệu dự án thời gian thực, bóc tách User Story và tổng hợp báo cáo điều hành.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40 hover:scale-[1.02] active:scale-95 transition cursor-pointer"
          >
            <Mic className="w-4 h-4 animate-pulse text-white" />
            <span>🎙️ Ra Lệnh Giọng Nói AI (vi-VN)</span>
          </button>
        </div>
      </header>

      {/* Tabs Navigation (3 in 1 Workspace) */}
      <nav className="flex p-1.5 rounded-3xl bg-slate-200/70 border border-slate-300/80 dark:bg-slate-900/90 dark:border-slate-800 max-w-2xl backdrop-blur-xl shadow-inner gap-1">
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
      </nav>

      {/* Main Tab Panels */}
      <AnimatePresence mode="wait">
        {/* ========================================================
            TAB 3: CHATBOT DATA ASSISTANT (AI LIVE DATA-AWARE)
            ======================================================== */}
        {activeTab === 'chat' && (
          <motion.div
            key="tab-chat"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col h-[700px] overflow-hidden"
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>TaskFlow AI Live Assistant</span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Prisma Data
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tra cứu và phân tích số liệu công việc, tiến độ và hạn chót theo thời gian thực
                  </p>
                </div>
              </div>

              {/* Nút Làm mới dữ liệu (Phần 2) */}
              <button
                type="button"
                onClick={handleRefreshChat}
                disabled={isRefreshing || isChatLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition shadow-sm cursor-pointer disabled:opacity-50"
                title="Làm mới bộ nhớ tạm và nạp lại dữ liệu thời gian thực từ DB"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
                <span>Làm mới dữ liệu</span>
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
                          : 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-indigo-700'
                      }`}
                    >
                      {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div
                      className={`group/msg relative max-w-[85%] rounded-3xl p-4 text-xs leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white rounded-tr-none'
                          : 'bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 rounded-tl-none'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-line">{msg.text}</p>
                      ) : (
                        <div className="space-y-1.5 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                          {msg.text.split(/\r?\n/).map((line, lineIdx) => {
                            const trimmed = line.trim();
                            if (!trimmed) return <div key={lineIdx} className="h-1.5" />;

                            if (trimmed.startsWith('#')) {
                              const headerText = trimmed.replace(/^#+\s*/, '');
                              return (
                                <h4
                                  key={lineIdx}
                                  className="text-xs font-black text-slate-900 dark:text-white pt-1"
                                >
                                  {renderFormattedLine(headerText, handleTaskClick)}
                                </h4>
                              );
                            }

                            if (
                              trimmed.startsWith('- ') ||
                              trimmed.startsWith('* ') ||
                              trimmed.startsWith('• ')
                            ) {
                              const content = trimmed.replace(/^[-*•]\s*/, '');
                              return (
                                <div key={lineIdx} className="flex items-start gap-2 pl-2">
                                  <span className="text-indigo-500 font-bold shrink-0 mt-0.5">•</span>
                                  <span className="flex-1">
                                    {renderFormattedLine(content, handleTaskClick)}
                                  </span>
                                </div>
                              );
                            }

                            if (/^\d+\.\s/.test(trimmed)) {
                              return (
                                <div key={lineIdx} className="pl-2 font-medium">
                                  {renderFormattedLine(trimmed, handleTaskClick)}
                                </div>
                              );
                            }

                            return (
                              <p key={lineIdx}>
                                {renderFormattedLine(trimmed, handleTaskClick)}
                              </p>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => handleCopyChatMsg(msg.text)}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition cursor-pointer"
                            title="Sao chép câu trả lời"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Sao chép</span>
                          </button>
                        )}
                        <span
                          className={`text-[9px] font-mono ${
                            isUser ? 'text-indigo-200 ml-auto' : 'text-slate-400'
                          }`}
                        >
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing Animation / Live Analysis Loading State (Phần 2) */}
              {isChatLoading && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="rounded-3xl rounded-tl-none bg-white dark:bg-slate-800/90 p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-sm flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200 animate-pulse">
                      Trợ lý AI đang truy vấn dữ liệu dự án thời gian thực...
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Suggestion Chips (Phần 2: 1-chạm gửi ngay) */}
            <div className="px-6 py-2.5 bg-slate-50/70 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px]">
              <span className="text-slate-400 font-semibold shrink-0">Gợi ý câu hỏi:</span>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, 'Tìm các công việc đang quá hạn cần xử lý gấp')}
                disabled={isChatLoading}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 transition shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
              >
                <span>⚠️</span>
                <span>Việc quá hạn</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, 'Những công việc đang ở trạng thái Cần làm (TODO)?')}
                disabled={isChatLoading}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 transition shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
              >
                <span>📋</span>
                <span>Việc cần làm (TODO)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, 'Các task có độ ưu tiên cao nhất (URGENT)?')}
                disabled={isChatLoading}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 transition shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
              >
                <span>🔥</span>
                <span>Việc khẩn cấp (URGENT)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, 'Báo cáo tổng quan tiến độ các dự án')}
                disabled={isChatLoading}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 transition shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
              >
                <span>📊</span>
                <span>Tiến độ dự án</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, 'Tổng hợp công việc được giao cho tôi')}
                disabled={isChatLoading}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 transition shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
              >
                <span>👤</span>
                <span>Việc của tôi</span>
              </button>
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => handleSendChat(e)}
              className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white dark:bg-slate-900"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Đặt câu hỏi hoặc tra cứu dữ liệu (VD: 'Tìm việc trễ hạn của Dương Chí Du', 'Tỷ lệ hoàn thành dự án AI')..."
                className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                title="Ra lệnh giọng nói AI tiếng Việt (vi-VN)"
                className="p-2.5 rounded-2xl bg-gradient-to-tr from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white shadow-md shadow-rose-500/20 transition cursor-pointer active:scale-95"
              >
                <Mic className="w-4 h-4 animate-pulse" />
              </button>
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

        {/* ========================================================
            TAB 1: SUB-TASK BREAKDOWN
            ======================================================== */}
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
                disabled={isBreakingDown || !largeTaskDescription.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/25 transition disabled:opacity-50 cursor-pointer"
              >
                {isBreakingDown ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini AI đang phân tích và bóc tách...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Bóc Tách Tác Vụ Bằng AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Results Panel (7 cols) */}
            <div className="lg:col-span-7 p-6 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Danh Sách Sub-tasks Đề Xuất
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {generatedSubtasks.length > 0
                        ? `${generatedSubtasks.filter((s) => s.checked).length}/${generatedSubtasks.length} task được chọn`
                        : 'Chưa có dữ liệu phân tách'}
                    </p>
                  </div>

                  {generatedSubtasks.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyBreakdown}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                        title="Sao chép danh sách tasks"
                      >
                        {isCopiedBreakdown ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>

                {generatedSubtasks.length === 0 ? (
                  <div className="py-20 text-center space-y-3">
                    <GitFork className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                      Nhập yêu cầu ở cột bên trái và bấm "Bóc Tách Tác Vụ Bằng AI" để sinh danh sách công việc tự động.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {generatedSubtasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3 hover:border-indigo-300 transition"
                      >
                        <input
                          type="checkbox"
                          checked={task.checked}
                          onChange={(e) => {
                            const updated = [...generatedSubtasks];
                            updated[idx].checked = e.target.checked;
                            setGeneratedSubtasks(updated);
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {task.title}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                              {task.priority}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                            <Clock className="w-3 h-3" />
                            Ước tính: {task.estimatedHours} giờ
                          </span>
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
                    className="flex items-center gap-2 py-2.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isPushedToKanban ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Đã thêm vào Kanban!</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        <span>Đưa Vào Bảng Kanban</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ========================================================
            TAB 2: EXECUTIVE SUMMARY
            ======================================================== */}
        {activeTab === 'summary' && (
          <motion.div
            key="tab-summary"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Control Panel (4 cols) */}
            <div className="lg:col-span-4 p-6 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Báo Cáo Điều Hành
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tổng hợp phân tích tiến độ và rủi ro
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chọn dự án cần đánh giá
                  </label>
                  <select
                    value={summaryProjectId}
                    onChange={(e) => setSummaryProjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                  <span className="font-bold text-purple-700 dark:text-purple-300 block">
                    Nội dung báo cáo tự động:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500">
                    <li>1. Tổng quan tình trạng dự án</li>
                    <li>2. Tiến độ chi tiết theo cột Kanban</li>
                    <li>3. Điểm mạnh và tiến độ đột phá</li>
                    <li>4. Cần cải thiện và cảnh báo việc trễ hạn</li>
                    <li>5. Khuyến nghị hành động tiếp theo</li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={isSummarizing || !summaryProjectId}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md shadow-purple-600/25 transition disabled:opacity-50 cursor-pointer"
              >
                {isSummarizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini AI đang rà soát dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Sinh Báo Cáo Tiến Độ Ngay</span>
                  </>
                )}
              </button>
            </div>

            {/* Markdown Report View (8 cols) */}
            <div className="lg:col-span-8 p-6 rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between min-h-[480px]">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Kết Quả Báo Cáo Phân Tích
                  </h3>
                  {summaryReport && (
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      title="Sao chép nội dung báo cáo"
                    >
                      {isCopiedSummary ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {!summaryReport && !isSummarizing && (
                  <div className="py-24 text-center space-y-3">
                    <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                      Chọn dự án và bấm "Sinh Báo Cáo Tiến Độ Ngay" để AI tổng hợp phân tích.
                    </p>
                  </div>
                )}

                {isSummarizing && (
                  <div className="py-24 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CHI TIẾT TASK (Khi người dùng click vào thẻ [TASK: id | title]) */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          canEditSubtasks={true}
          canAssignTask={canManageTasks}
          usersList={usersList}
          onTaskUpdated={() => {
            toast.success('Đã cập nhật công việc!');
          }}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* MODAL AI VOICE COMMAND */}
      <VoiceCommandModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onExecuteCommand={handleVoiceCommand}
      />
    </div>
  );
};

export default AIAssistantPage;

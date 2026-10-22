import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Flame,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface ParsedVoiceCommand {
  rawText: string;
  actionType: 'CREATE_TASK' | 'SEARCH' | 'AI_PROMPT' | 'UNKNOWN';
  filterTarget?: 'PENDING' | 'ALL' | 'PROJECTS' | 'TASKS';
  taskData?: {
    title: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueDate?: string;
  };
}

export interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand: (command: ParsedVoiceCommand) => void;
  title?: string;
  placeholder?: string;
}

// Helper phân tích lệnh tiếng Việt tự nhiên
export const parseVietnameseVoiceCommand = (text: string): ParsedVoiceCommand => {
  const lower = text.toLowerCase().trim();
  const rawText = text.trim();

  // 1. Nhận diện các lệnh lọc / chuyển tab trên lịch
  if (
    lower.includes('quá hạn') ||
    lower.includes('cần xử lý') ||
    lower.includes('trễ hạn') ||
    lower.includes('chưa xong')
  ) {
    return {
      rawText,
      actionType: 'SEARCH',
      filterTarget: 'PENDING',
    };
  }

  if (
    lower === 'tất cả' ||
    lower === 'toàn bộ' ||
    lower.includes('xem tất cả') ||
    lower.includes('hiển thị tất cả')
  ) {
    return {
      rawText,
      actionType: 'SEARCH',
      filterTarget: 'ALL',
    };
  }

  if (lower === 'dự án' || lower.includes('xem dự án') || lower.includes('danh sách dự án')) {
    return {
      rawText,
      actionType: 'SEARCH',
      filterTarget: 'PROJECTS',
    };
  }

  if (lower === 'công việc' || lower.includes('xem công việc') || lower.includes('danh sách công việc')) {
    return {
      rawText,
      actionType: 'SEARCH',
      filterTarget: 'TASKS',
    };
  }

  // 2. Nhận diện lệnh tạo việc
  const isCreate =
    lower.startsWith('tạo việc') ||
    lower.startsWith('tạo task') ||
    lower.startsWith('thêm việc') ||
    lower.startsWith('thêm task') ||
    lower.includes('tạo công việc') ||
    lower.includes('lập việc');

  if (isCreate) {
    let cleanTitle = text
      .replace(/^(tạo việc|tạo task|thêm việc|thêm task|tạo công việc|lập việc)\s+/i, '')
      .trim();

    // Phân tích độ ưu tiên
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM';
    if (lower.includes('khẩn cấp') || lower.includes('gấp') || lower.includes('urgent')) {
      priority = 'URGENT';
      cleanTitle = cleanTitle.replace(/(mức\s+)?(khẩn cấp|gấp|urgent)/gi, '').trim();
    } else if (lower.includes('ưu tiên cao') || lower.includes('mức cao') || lower.includes('high')) {
      priority = 'HIGH';
      cleanTitle = cleanTitle.replace(/(mức\s+)?(ưu tiên cao|mức cao|high)/gi, '').trim();
    } else if (lower.includes('ưu tiên thấp') || lower.includes('mức thấp') || lower.includes('low')) {
      priority = 'LOW';
      cleanTitle = cleanTitle.replace(/(mức\s+)?(ưu tiên thấp|mức thấp|low)/gi, '').trim();
    }

    // Phân tích hạn chót
    let dueDateIso: string | undefined = undefined;
    const now = new Date();

    if (lower.includes('hôm nay')) {
      const d = new Date(now);
      d.setHours(18, 0, 0, 0);
      dueDateIso = d.toISOString();
      cleanTitle = cleanTitle.replace(/(hạn chót|hạn|deadline)?\s*(hôm nay)/gi, '').trim();
    } else if (lower.includes('ngày mai')) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
      dueDateIso = d.toISOString();
      cleanTitle = cleanTitle.replace(/(hạn chót|hạn|deadline)?\s*(ngày mai)/gi, '').trim();
    } else if (lower.includes('ngày kia') || lower.includes('ngày mốt')) {
      const d = new Date(now);
      d.setDate(d.getDate() + 2);
      d.setHours(18, 0, 0, 0);
      dueDateIso = d.toISOString();
      cleanTitle = cleanTitle.replace(/(hạn chót|hạn|deadline)?\s*(ngày kia|ngày mốt)/gi, '').trim();
    } else if (lower.includes('tuần tới') || lower.includes('tuần sau')) {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      d.setHours(18, 0, 0, 0);
      dueDateIso = d.toISOString();
      cleanTitle = cleanTitle.replace(/(hạn chót|hạn|deadline)?\s*(tuần tới|tuần sau)/gi, '').trim();
    }

    // Làm sạch từ khóa dư thừa
    cleanTitle = cleanTitle
      .replace(/^(là|rằng|về)\s+/i, '')
      .replace(/\s+(hạn chót|hạn|deadline)$/i, '')
      .trim();

    if (!cleanTitle) {
      cleanTitle = 'Công việc tạo bằng giọng nói';
    }

    return {
      rawText,
      actionType: 'CREATE_TASK',
      taskData: {
        title: cleanTitle,
        priority,
        dueDate: dueDateIso,
      },
    };
  }

  // 3. Nhận diện lệnh tra cứu / tìm kiếm
  const isSearch =
    lower.startsWith('tìm') ||
    lower.startsWith('lọc') ||
    lower.startsWith('tra cứu') ||
    lower.startsWith('xem') ||
    lower.includes('danh sách');

  if (isSearch) {
    return {
      rawText,
      actionType: 'SEARCH',
    };
  }

  // 4. Mặc định gửi cho AI Trợ lý
  return {
    rawText,
    actionType: 'AI_PROMPT',
  };
};

export const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
  title = 'AI Voice Command - Trợ Lý Giọng Nói Tiếng Việt',
  placeholder = 'Đang lắng nghe giọng nói tiếng Việt của bạn...',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const autoExecuteTimeoutRef = useRef<any>(null);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      let hasFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          hasFinal = true;
        }
      }
      if (currentTranscript.trim()) {
        const text = currentTranscript.trim();
        setTranscript(text);
        transcriptRef.current = text;

        if (autoExecuteTimeoutRef.current) {
          clearTimeout(autoExecuteTimeoutRef.current);
        }

        // Tự động kích hoạt hành động ngay lập tức sau khi nói xong
        const delay = hasFinal ? 700 : 1200;
        autoExecuteTimeoutRef.current = setTimeout(() => {
          handleApplyCommand(text);
        }, delay);
      }
    };

    recognition.onspeechend = () => {
      const text = transcriptRef.current?.trim();
      if (text) {
        if (autoExecuteTimeoutRef.current) {
          clearTimeout(autoExecuteTimeoutRef.current);
        }
        autoExecuteTimeoutRef.current = setTimeout(() => {
          handleApplyCommand(text);
        }, 500);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Vui lòng cấp quyền truy cập Micro trên trình duyệt để sử dụng tính năng này.');
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      const text = transcriptRef.current?.trim();
      if (text) {
        if (autoExecuteTimeoutRef.current) {
          clearTimeout(autoExecuteTimeoutRef.current);
        }
        autoExecuteTimeoutRef.current = setTimeout(() => {
          handleApplyCommand(text);
        }, 300);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (autoExecuteTimeoutRef.current) {
        clearTimeout(autoExecuteTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Tự động bật nghe khi mở modal
  useEffect(() => {
    if (isOpen && isSupported && recognitionRef.current) {
      setTranscript('');
      transcriptRef.current = '';
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Lỗi khởi động speech recognition:', err);
      }
    } else if (!isOpen) {
      if (autoExecuteTimeoutRef.current) {
        clearTimeout(autoExecuteTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        setIsListening(false);
      }
    }
  }, [isOpen, isSupported]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      if (autoExecuteTimeoutRef.current) {
        clearTimeout(autoExecuteTimeoutRef.current);
      }
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      transcriptRef.current = '';
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn('Lỗi bật micro:', e);
      }
    }
  };

  const handleApplyCommand = (textToUse?: string) => {
    if (autoExecuteTimeoutRef.current) {
      clearTimeout(autoExecuteTimeoutRef.current);
      autoExecuteTimeoutRef.current = null;
    }

    const finalTxt = (textToUse || transcriptRef.current || transcript).trim();
    if (!finalTxt) {
      toast.error('Chưa có nội dung giọng nói. Vui lòng nói vào micro.');
      return;
    }

    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    const parsed = parseVietnameseVoiceCommand(finalTxt);
    onExecuteCommand(parsed);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>{title}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 uppercase">
                  vi-VN Live
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Ra lệnh bằng giọng nói tiếng Việt tự nhiên để tạo việc, tra cứu & điều khiển AI
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

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {!isSupported ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>
                Trình duyệt của bạn chưa hỗ trợ Web Speech API. Vui lòng sử dụng Google Chrome, Edge hoặc Brave để trải nghiệm ra lệnh giọng nói tiếng Việt.
              </span>
            </div>
          ) : (
            <>
              {/* Visualizer & Microphone Center */}
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative mb-6">
                  {/* Pulsing Rings when listening */}
                  {isListening && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                      <div className="absolute -inset-3 rounded-full bg-purple-500/15 animate-pulse" />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 ${
                      isListening
                        ? 'bg-gradient-to-tr from-rose-500 via-rose-600 to-purple-600 shadow-rose-500/30 scale-105 ring-4 ring-rose-400/30'
                        : 'bg-gradient-to-tr from-indigo-600 to-purple-600 hover:scale-105 shadow-indigo-600/30'
                    }`}
                    title={isListening ? 'Bấm để tạm dừng' : 'Bấm để bật Micro'}
                  >
                    {isListening ? (
                      <Mic className="w-8 h-8 animate-pulse text-white" />
                    ) : (
                      <MicOff className="w-8 h-8 text-white/80" />
                    )}
                  </button>
                </div>

                {/* Animated Audio Waveform */}
                <div className="flex items-center gap-1.5 h-7 mb-2">
                  {[0.4, 0.8, 1.2, 0.9, 0.5, 1.1, 0.7].map((heightScale, idx) => (
                    <motion.span
                      key={idx}
                      animate={
                        isListening
                          ? {
                              scaleY: [0.3, heightScale * 1.4, 0.3],
                              opacity: [0.5, 1, 0.5],
                            }
                          : { scaleY: 0.2, opacity: 0.3 }
                      }
                      transition={{
                        repeat: Infinity,
                        duration: 0.6 + idx * 0.1,
                        ease: 'easeInOut',
                      }}
                      className="w-1.5 h-6 bg-gradient-to-t from-indigo-600 to-purple-500 rounded-full origin-bottom"
                    />
                  ))}
                </div>

                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isListening ? '🎙️ Đang lắng nghe giọng nói tiếng Việt...' : '⏸️ Micro đang tạm dừng. Bấm nút để tiếp tục nói.'}
                </p>
              </div>

              {/* Transcript Display Box */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 min-h-[90px] flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nội dung nhận diện trực tiếp:
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {transcript ? (
                    `"${transcript}"`
                  ) : (
                    <span className="text-slate-400 italic text-xs">{placeholder}</span>
                  )}
                </p>
                {transcript && (
                  <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/60 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>⚡ Tự động thực thi hành động ngay khi nói xong...</span>
                  </div>
                )}
              </div>

              {/* Quick Sample Voice Command Pills */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Mẫu lệnh thử nhanh (Click để thử ngay):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Tạo việc kiểm tra báo cáo hạn chót ngày mai mức khẩn cấp',
                    'Tìm các công việc quá hạn',
                    'Tạo task thiết kế giao diện landing page hạn chót tuần tới mức cao',
                    'Phân tích tiến độ dự án hiện tại',
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTranscript(sample);
                        handleApplyCommand(sample);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-950/60 dark:text-slate-300 transition text-left cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
                    >
                      🗣️ {sample}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={() => handleApplyCommand()}
            disabled={!transcript.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Thực Thi Lệnh AI Ngay</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VoiceCommandModal;


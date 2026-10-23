import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Volume2,
  VolumeX,
  CalendarCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Flame,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckSquare,
} from 'lucide-react';

export interface ScheduleSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate?: string | Date | null;
  tasks: any[];
  projects?: any[];
  onSelectTask?: (taskId: string) => void;
}

/**
 * Helper trích xuất chuỗi ngày YYYY-MM-DD chuẩn hóa theo local timezone
 */
export const extractDateStr = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return '';
};

/**
 * Helper trích xuất giờ phút HH:mm theo local timezone
 */
export const extractTimeStr = (val: any): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  } catch {}
  if (typeof val === 'string' && /^\d{2}:\d{2}/.test(val)) {
    return val.substring(0, 5);
  }
  return '';
};

export const ScheduleSummaryModal: React.FC<ScheduleSummaryModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  tasks = [],
  projects = [],
  onSelectTask,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 1. Khắc phục dứt điểm lỗi hiển thị toàn số 0:
  // Chuẩn hóa targetKey theo đúng ngày mục tiêu
  const targetKey = targetDate ? extractDateStr(targetDate) : extractDateStr(new Date());

  // Lọc các task thuộc ngày targetKey
  const targetTasks = tasks.filter(
    (t) => extractDateStr(t.deadline || t.dueDate) === targetKey
  );

  // Thống kê chính xác theo ngày mục tiêu
  const totalTasksCount = targetTasks.length;
  const urgentTasksCount = targetTasks.filter(
    (t) => t.priority === 'URGENT' || t.priority === 'HIGH'
  ).length;
  const doneTasksCount = targetTasks.filter((t) => t.status === 'DONE').length;
  const overdueTasksCount = targetTasks.filter((t) => {
    if (t.status === 'DONE') return false;
    const dueTime = new Date(t.deadline || t.dueDate).getTime();
    return t.isOverdue || (!isNaN(dueTime) && dueTime < new Date().getTime());
  }).length;

  const completionPercent =
    totalTasksCount > 0 ? Math.round((doneTasksCount / totalTasksCount) * 100) : 0;
  const onTimePercent =
    totalTasksCount > 0
      ? Math.max(0, Math.round(((totalTasksCount - overdueTasksCount) / totalTasksCount) * 100))
      : 100;

  // Format ngày hiển thị linh hoạt: "29/10/2026"
  const dateParts = targetKey ? targetKey.split('-') : [];
  const yearStr = dateParts[0] || '2026';
  const monthStr = dateParts[1] || '10';
  const dayStr = dateParts[2] || '29';
  const formattedDisplayDate = `${dayStr}/${monthStr}/${yearStr}`;

  // Sắp xếp công việc theo thời gian tăng dần
  const sortedTasks = [...targetTasks].sort((a, b) => {
    const timeA = extractTimeStr(a.deadline || a.dueDate) || '00:00';
    const timeB = extractTimeStr(b.deadline || b.dueDate) || '00:00';
    return timeA.localeCompare(timeB);
  });

  // Tìm khung giờ tập trung nhiều công việc nhất (peak time)
  const timeFrequency: Record<string, number> = {};
  targetTasks.forEach((t) => {
    const time = extractTimeStr(t.deadline || t.dueDate);
    if (time) {
      timeFrequency[time] = (timeFrequency[time] || 0) + 1;
    }
  });

  let peakTime = '';
  let peakTimeCount = 0;
  for (const [time, count] of Object.entries(timeFrequency)) {
    if (count > peakTimeCount) {
      peakTimeCount = count;
      peakTime = time;
    }
  }

  // Nhận định thông minh của AI (AI Insight)
  let aiInsightText = '';
  if (totalTasksCount === 0) {
    aiInsightText = `Ngày ${formattedDisplayDate} bạn không có công việc nào cần xử lý. Hãy tận dụng thời gian để nạp năng lượng hoặc lên kế hoạch cho các dự án tiếp theo!`;
  } else if (peakTime && peakTimeCount >= 2) {
    aiInsightText = `Ngày ${dayStr}/${monthStr} bạn có khối lượng công việc tập trung vào khung giờ tối ${peakTime}. Khuyến nghị chuẩn bị trước tài liệu để nộp bài đúng hạn.`;
  } else if (urgentTasksCount > 0) {
    aiInsightText = `Ngày ${dayStr}/${monthStr} bạn có ${urgentTasksCount} công việc ưu tiên cao/khẩn cấp. Khuyến nghị ưu tiên xử lý dứt điểm các đầu việc này trước.`;
  } else {
    aiInsightText = `Lịch trình ngày ${dayStr}/${monthStr} được phân bổ hợp lý với ${totalTasksCount} công việc. Chúc bạn làm việc hiệu quả và hoàn thành đúng hạn!`;
  }

  // Cấu hình Kịch bản Giọng đọc AI (TTS) chuẩn Tiếng Việt
  const buildSpeechScript = (): string => {
    const dateSpeech = `ngày ${parseInt(dayStr, 10)} tháng ${parseInt(monthStr, 10)} năm ${yearStr}`;

    if (totalTasksCount === 0) {
      return `Báo cáo lịch trình ${dateSpeech}. Bạn hiện tại không có công việc nào cần thực hiện trong ngày này. Chúc bạn một ngày làm việc tuyệt vời!`;
    }

    // Lấy thông tin công việc đầu tiên và giờ
    const firstTask = sortedTasks[0];
    const firstTaskTime = extractTimeStr(firstTask.deadline || firstTask.dueDate) || '09:00';
    const [h, m] = firstTaskTime.split(':').map((n) => parseInt(n, 10) || 0);
    const timeSpeech = `${h} giờ${m > 0 ? ` ${m} phút` : ''}`;

    const overdueSpeech =
      overdueTasksCount > 0
        ? `Cảnh báo có ${overdueTasksCount} công việc bị quá hạn cần xử lý gấp.`
        : `Hiện tại chưa có công việc nào bị quá hạn.`;

    return `Báo cáo lịch trình ${dateSpeech}. Bạn có tổng cộng ${totalTasksCount} công việc cần xử lý. Lúc ${timeSpeech}, có công việc ${firstTask.title}. ${overdueSpeech} Chúc bạn làm việc hiệu quả và hoàn thành đúng tiến độ!`;
  };

  const fullSpeechText = buildSpeechScript();

  // Trình phát Text to Speech (TTS) tối ưu tiếng Việt
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const assignBestVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const viVoice =
          voices.find(
            (v) =>
              v.lang === 'vi-VN' &&
              (v.name.includes('Google') ||
                v.name.includes('HoaiMy') ||
                v.name.includes('NamMinh') ||
                v.name.includes('An'))
          ) ||
          voices.find((v) => v.lang.startsWith('vi') || v.lang.includes('VN') || v.name.toLowerCase().includes('vietnam'));

        if (viVoice) {
          utterance.voice = viVoice;
        }
      };

      assignBestVoice();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = assignBestVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Lỗi Web Speech Synthesis:', err);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsSpeaking(false);
  };

  // Tự động phát âm thanh khi modal mở và dọn dẹp khi đóng
  useEffect(() => {
    if (isOpen) {
      // Đợi modal mount animation hoàn thành rồi mới đọc
      const timer = setTimeout(() => {
        speakText(fullSpeechText);
      }, 350);

      return () => {
        clearTimeout(timer);
        stopSpeaking();
      };
    } else {
      stopSpeaking();
    }
  }, [isOpen, targetKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-200/60 dark:border-purple-900/50 overflow-hidden"
      >
        {/* Header Modal Hiển Thị Linh Hoạt */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-50/80 via-indigo-50/40 to-white dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-500 text-white shadow-md shadow-purple-500/25">
              <Sparkles className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>✨ AI Báo Cáo & Tóm Tắt Lịch Trình - Ngày {formattedDisplayDate}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 uppercase tracking-wide">
                  TTS vi-VN
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Phân tích dữ liệu công việc và mốc hạn chót thực tế theo ngày
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopSpeaking();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* 4 Mini Stat Badges Khắc Phục Dứt Điểm Lỗi Hiển Thị 0 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-center shadow-xs">
              <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider block">
                Tổng công việc
              </span>
              <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                {totalTasksCount}
              </span>
              <span className="text-[10px] text-indigo-400 block">việc trong ngày</span>
            </div>

            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-center shadow-xs">
              <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider block">
                Khẩn cấp / Cao
              </span>
              <span className="text-xl font-black text-rose-700 dark:text-rose-300">
                {urgentTasksCount}
              </span>
              <span className="text-[10px] text-rose-400 block">việc ưu tiên</span>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-center shadow-xs">
              <span className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider block">
                Đã hoàn thành
              </span>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                {doneTasksCount}/{totalTasksCount}
              </span>
              <span className="text-[10px] text-emerald-500 font-bold block">
                {completionPercent}%
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 text-center shadow-xs">
              <span className="text-[10px] font-extrabold text-purple-500 uppercase tracking-wider block">
                Đúng tiến độ
              </span>
              <span className="text-xl font-black text-purple-700 dark:text-purple-300">
                {onTimePercent}%
              </span>
              <span className="text-[10px] text-purple-400 block">
                {overdueTasksCount === 0 ? '0 việc trễ' : `${overdueTasksCount} trễ`}
              </span>
            </div>
          </div>

          {/* Điểm Tin Tiến Độ Cốt Lõi: Danh Sách Gạch Đầu Dòng Chi Tiết */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-950/70 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                Điểm tin tiến độ cốt lõi (Chi tiết công việc):
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {totalTasksCount} công việc
              </span>
            </div>

            {totalTasksCount === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 italic">
                Không có công việc nào trong ngày {formattedDisplayDate}.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTasks.map((task, idx) => {
                  const taskTime = extractTimeStr(task.deadline || task.dueDate) || '09:00';
                  const isDone = task.status === 'DONE';
                  const isUrgent = task.priority === 'URGENT';
                  const isHigh = task.priority === 'HIGH';

                  const statusText = isDone ? 'Hoàn thành' : 'Đang làm';
                  const priorityText = isUrgent
                    ? 'Khẩn cấp'
                    : isHigh
                    ? 'Ưu tiên cao'
                    : 'Bình thường';

                  return (
                    <div
                      key={task.id || idx}
                      onClick={() => onSelectTask && onSelectTask(task.id)}
                      className={`flex items-start justify-between gap-3 p-2.5 rounded-xl text-xs border transition cursor-pointer ${
                        isDone
                          ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-slate-600 dark:text-slate-300'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 text-slate-800 dark:text-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-[10px] font-black mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold flex items-center gap-1.5 flex-wrap">
                            <span className="text-purple-600 dark:text-purple-400 font-mono text-[11px]">
                              Lúc {taskTime}:
                            </span>
                            <span className={`truncate ${isDone ? 'line-through opacity-70' : ''}`}>
                              {task.title}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>
                              Trạng thái:{' '}
                              <strong className={isDone ? 'text-emerald-600' : 'text-amber-600'}>
                                {statusText}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Mức:{' '}
                              <strong
                                className={
                                  isUrgent
                                    ? 'text-rose-600'
                                    : isHigh
                                    ? 'text-amber-600'
                                    : 'text-indigo-600'
                                }
                              >
                                {priorityText}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isDone
                              ? 'bg-emerald-500'
                              : isUrgent
                              ? 'bg-rose-500 animate-pulse'
                              : 'bg-amber-500'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nhận Định Thông Minh Của AI */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-200/80 dark:border-purple-800/50 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                Nhận định thông minh của AI
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              {aiInsightText}
            </p>
          </div>

          {/* Sóng Âm Động Visualizer Khi Đang Phát Giọng Đọc TTS */}
          {isSpeaking && (
            <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-300">
              <Volume2 className="w-4 h-4 animate-bounce shrink-0" />
              <span>Đang đọc báo cáo lịch trình bằng giọng nói tiếng Việt...</span>
              <div className="flex items-center gap-1 h-4 ml-2">
                {[0.4, 1.2, 0.7, 1.4, 0.5, 1.1, 0.6].map((h, i) => (
                  <motion.span
                    key={i}
                    animate={{
                      scaleY: [0.3, h * 1.5, 0.3],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.45 + i * 0.08,
                      ease: 'easeInOut',
                    }}
                    className="w-1 h-3.5 bg-gradient-to-t from-purple-600 to-rose-500 rounded-full origin-bottom"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            {isSpeaking ? (
              <button
                type="button"
                onClick={stopSpeaking}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 transition cursor-pointer"
              >
                <VolumeX className="w-4 h-4" />
                <span>Dừng Đọc</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => speakText(fullSpeechText)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 transition cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>Nghe Lại Giọng Nói</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onClose();
            }}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 transition cursor-pointer"
          >
            Đã Hiểu
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ScheduleSummaryModal;


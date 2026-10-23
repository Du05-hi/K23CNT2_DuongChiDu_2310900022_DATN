import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Send,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Flame,
  ArrowRight,
  Filter,
  FileText,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/api/apiClient';

export interface ParsedVoiceCommand {
  rawText: string;
  actionType: 'CREATE_TASK' | 'SUMMARY' | 'SUMMARY_DATE' | 'SEARCH' | 'AI_PROMPT' | 'UNKNOWN';
  targetDate?: string; // YYYY-MM-DD
  dateRange?: { start: string; end: string };
  filterTarget?: 'PENDING' | 'ALL' | 'PROJECTS' | 'TASKS';
  taskData?: {
    title: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    deadline?: string; // ISO 8601 string
    dueDate?: string; // ISO 8601 string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  };
  searchQuery?: string;
  confidence?: number;
}

export interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand: (command: ParsedVoiceCommand) => void;
  title?: string;
  placeholder?: string;
}

/**
 * Âm thanh hoàn thành Web Audio API (Ding Chime) không phụ thuộc file mạng
 */
export const playSuccessSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.1); // B5
    gain2.gain.setValueAtTime(0.18, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.45);
  } catch (err) {
    // Ignore audio permission/context errors
  }
};

/**
 * Helper format date to YYYY-MM-DD
 */
export const formatDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export interface ExtractedDateInfo {
  dateStr: string; // 'YYYY-MM-DD'
  dateObj: Date;
  hasExplicitDate: boolean;
  isWeekScope?: boolean;
  weekRange?: { start: string; end: string };
  matchedPhrase?: string;
}

/**
 * HÀM BÓC TÁCH NGÀY ĐA DẠNG TỪ CÂU NÓI TIẾNG VIỆT (Target Date Resolution)
 * - "ngày 29", "ngày 29 tháng 10", "29/10", "ngày 29/10/2026" -> '2026-10-29'
 * - "hôm nay" -> Ngày hiện tại (local YYYY-MM-DD)
 * - "ngày mai", "mai" -> Ngày hiện tại + 1
 * - "ngày mốt", "ngày kia" -> Ngày hiện tại + 2
 * - "tuần này", "tuần tới / tuần sau" -> Phạm vi tuần (startOfWeek, endOfWeek)
 */
export const extractDateFromVoiceText = (text: string, baseDate = new Date()): ExtractedDateInfo => {
  const lower = text.toLowerCase();
  const currentYear = 2026;
  const baseYear = baseDate.getFullYear() >= 2026 ? baseDate.getFullYear() : currentYear;
  const currentMonth = baseDate.getMonth() + 1; // 1-indexed

  // 1. Phạm vi tuần: "tuần này", "tuần tới", "tuần sau"
  if (lower.includes('tuần này')) {
    const monday = new Date(baseDate);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      dateStr: formatDateKey(monday),
      dateObj: monday,
      hasExplicitDate: true,
      isWeekScope: true,
      weekRange: {
        start: formatDateKey(monday),
        end: formatDateKey(sunday),
      },
      matchedPhrase: 'tuần này',
    };
  }

  if (lower.includes('tuần sau') || lower.includes('tuần tới')) {
    const monday = new Date(baseDate);
    const day = monday.getDay();
    const diff = (day === 0 ? -6 : 1 - day) + 7;
    monday.setDate(monday.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      dateStr: formatDateKey(monday),
      dateObj: monday,
      hasExplicitDate: true,
      isWeekScope: true,
      weekRange: {
        start: formatDateKey(monday),
        end: formatDateKey(sunday),
      },
      matchedPhrase: lower.includes('tuần sau') ? 'tuần sau' : 'tuần tới',
    };
  }

  // 2. Ngày tương đối: "hôm nay", "ngày mai", "ngày mốt", "ngày kia"
  if (lower.includes('hôm nay')) {
    const d = new Date(baseDate);
    d.setFullYear(baseYear);
    return {
      dateStr: formatDateKey(d),
      dateObj: d,
      hasExplicitDate: true,
      matchedPhrase: 'hôm nay',
    };
  }

  if (lower.includes('ngày mai') || /\bmai\b/i.test(lower) || lower.includes('hôm sau')) {
    const d = new Date(baseDate);
    d.setFullYear(baseYear);
    d.setDate(d.getDate() + 1);
    return {
      dateStr: formatDateKey(d),
      dateObj: d,
      hasExplicitDate: true,
      matchedPhrase: 'ngày mai',
    };
  }

  if (lower.includes('ngày mốt') || lower.includes('ngày kia') || lower.includes('hôm kia')) {
    const d = new Date(baseDate);
    d.setFullYear(baseYear);
    d.setDate(d.getDate() + 2);
    return {
      dateStr: formatDateKey(d),
      dateObj: d,
      hasExplicitDate: true,
      matchedPhrase: lower.includes('ngày mốt') ? 'ngày mốt' : 'ngày kia',
    };
  }

  // 3. Ngày dạng "ngày DD/MM/YYYY" hoặc "DD/MM/YYYY" hoặc "ngày DD/MM" hoặc "DD/MM" (VD: "ngày 29/10/2026", "29/10")
  const slashRegex = /(?:vào\s+)?(?:ngày\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i;
  const slashMatch = lower.match(slashRegex);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : baseYear;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(year, month - 1, day);
      return {
        dateStr: formatDateKey(d),
        dateObj: d,
        hasExplicitDate: true,
        matchedPhrase: slashMatch[0],
      };
    }
  }

  // 4. Ngày dạng chữ: "ngày DD tháng MM năm YYYY" hoặc "ngày DD tháng MM" (VD: "ngày 29 tháng 10")
  const wordDmRegex = /(?:vào\s+)?ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/i;
  const wordDmMatch = lower.match(wordDmRegex);
  if (wordDmMatch) {
    const day = parseInt(wordDmMatch[1], 10);
    const month = parseInt(wordDmMatch[2], 10);
    const year = wordDmMatch[3] ? parseInt(wordDmMatch[3], 10) : baseYear;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(year, month - 1, day);
      return {
        dateStr: formatDateKey(d),
        dateObj: d,
        hasExplicitDate: true,
        matchedPhrase: wordDmMatch[0],
      };
    }
  }

  // 5. Ngày dạng "tháng MM ngày DD"
  const monthDayRegex = /(?:vào\s+)?tháng\s+(\d{1,2})\s+ngày\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/i;
  const monthDayMatch = lower.match(monthDayRegex);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1], 10);
    const day = parseInt(monthDayMatch[2], 10);
    const year = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : baseYear;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(year, month - 1, day);
      return {
        dateStr: formatDateKey(d),
        dateObj: d,
        hasExplicitDate: true,
        matchedPhrase: monthDayMatch[0],
      };
    }
  }

  // 6. Ngày dạng chỉ có số ngày: "ngày DD" (VD: "ngày 29", "ngày 22", "ngày 28")
  // Đảm bảo không dính dấu "/" hoặc ":" hoặc chữ "tháng" phía sau
  const dayOnlyRegex = /(?:vào\s+)?ngày\s+(\d{1,2})(?!\s*[\/:])(?!\s*tháng)/i;
  const dayOnlyMatch = lower.match(dayOnlyRegex);
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const d = new Date(baseYear, currentMonth - 1, day);
      return {
        dateStr: formatDateKey(d),
        dateObj: d,
        hasExplicitDate: true,
        matchedPhrase: dayOnlyMatch[0],
      };
    }
  }

  // 7. Thứ trong tuần: "thứ [X] tuần sau" hoặc "thứ [X]"
  const dowMatch = lower.match(/thứ\s+(2|3|4|5|6|7|hai|ba|bốn|năm|sáu|bảy|chủ nhật)(?:\s+(tuần sau|tuần tới))?/i);
  if (dowMatch) {
    const dowMap: Record<string, number> = {
      '2': 1, 'hai': 1,
      '3': 2, 'ba': 2,
      '4': 3, 'bốn': 3,
      '5': 4, 'năm': 4,
      '6': 5, 'sáu': 5,
      '7': 6, 'bảy': 6,
      'chủ nhật': 0, 'cn': 0,
    };
    const targetDow = dowMap[dowMatch[1].toLowerCase()] ?? 1;
    const isNextWeek = !!dowMatch[2];
    const currentDow = baseDate.getDay();
    let diff = targetDow - currentDow;
    if (diff <= 0 || isNextWeek) {
      diff += 7;
    }
    const d = new Date(baseDate);
    d.setFullYear(baseYear);
    d.setDate(d.getDate() + diff);
    return {
      dateStr: formatDateKey(d),
      dateObj: d,
      hasExplicitDate: true,
      matchedPhrase: dowMatch[0],
    };
  }

  // Mặc định: Ngày hôm nay
  const defaultDate = new Date(baseDate);
  defaultDate.setFullYear(baseYear);
  return {
    dateStr: formatDateKey(defaultDate),
    dateObj: defaultDate,
    hasExplicitDate: false,
  };
};

/**
 * BỘ PHÂN TÍCH NGÔN NGỮ TỰ NHIÊN (VOICE NLP PARSER) CẤP ĐỘ PRO MAX
 * Điều phối đa luồng Intent:
 * 1. CREATE_TASK (Thêm, tạo, đặt lịch, nhắc nhở)
 * 2. SUMMARY_DATE / SUMMARY (Tóm tắt, báo cáo, ngày X có việc gì)
 * 3. FILTER_SEARCH (Lọc, tìm kiếm)
 */
export const processVoiceIntent = (transcript: string): ParsedVoiceCommand => {
  const rawText = transcript.trim();
  const lower = rawText.toLowerCase();

  // Bóc tách ngày tháng theo bộ phân giải ngày tiếng Việt toàn diện
  const dateInfo = extractDateFromVoiceText(rawText);

  // Nhận diện từ khóa hành động tạo / thêm công việc
  const hasCreateKeywords =
    lower.includes('thêm') ||
    lower.includes('tạo') ||
    lower.includes('lập') ||
    lower.includes('đặt lịch') ||
    lower.includes('lên lịch') ||
    lower.includes('nhắc nhở') ||
    lower.includes('ghi chú lịch') ||
    lower.includes('thêm việc') ||
    lower.includes('tạo việc');

  // ==============================================================
  // 1. Ý ĐỊNH: TÓM TẮT & BÁO CÁO LỊCH TRÌNH (SUMMARY_DATE / SUMMARY)
  // Kích hoạt khi KHÔNG phải là câu lệnh tạo việc, và chứa các cụm:
  // "tóm tắt", "báo cáo", "có việc gì", "có gì", "làm gì", "có task gì", "tổng quan"
  // VD: "tóm tắt công việc ngày 29", "ngày 29 có việc gì", "ngày 29 làm gì"
  // ==============================================================
  const isSummaryPhrase =
    !hasCreateKeywords &&
    (lower.includes('tóm tắt') ||
      lower.includes('báo cáo') ||
      lower.includes('có việc gì') ||
      lower.includes('có task gì') ||
      lower.includes('có gì') ||
      lower.includes('làm gì') ||
      lower.includes('lịch trình') ||
      lower.includes('tổng quan') ||
      lower.includes('xem tóm tắt'));

  if (isSummaryPhrase) {
    // Nếu có ngày cụ thể (ví dụ: ngày 29, 29/10, ngày mai, hôm nay,...) -> Intent BẮT BUỘC: SUMMARY_DATE
    if (dateInfo.hasExplicitDate && !dateInfo.isWeekScope) {
      return {
        rawText,
        actionType: 'SUMMARY_DATE',
        targetDate: dateInfo.dateStr,
        confidence: 0.98,
      };
    }

    // Nếu hỏi theo tuần hoặc tổng quan
    return {
      rawText,
      actionType: 'SUMMARY',
      targetDate: dateInfo.dateStr,
      dateRange: dateInfo.weekRange,
      confidence: 0.96,
    };
  }

  // ==============================================================
  // 2. Ý ĐỊNH: TẠO CÔNG VIỆC / THÊM LỊCH HẸN (CREATE_TASK)
  // ==============================================================
  if (hasCreateKeywords) {
    // A. Ngày: Lấy từ dateInfo đã bóc tách
    const targetDate = dateInfo.dateObj;
    const dateFormatted = dateInfo.dateStr;

    // B. Giờ: Nhận diện "lúc 21:10", "21:10", "21 giờ 10", "21h10", "lúc 9 giờ tối"
    let targetTime = '09:00';
    let hasExplicitTime = false;

    const timePatterns = [
      /(?:và\s+)?(?:vào\s+lúc|lúc|hồi)\s*(\d{1,2})(?::|h|\s*giờ\s*|g)(\d{1,2})?(?:\s*(phút|sáng|chiều|tối))?/i,
      /(\d{1,2}):(\d{2})(?:\s*(phút|sáng|chiều|tối))?/i,
      /(\d{1,2})\s*h\s*(\d{1,2})?(?:\s*(sáng|chiều|tối))?/i,
      /(?:và\s+)?(?:vào\s+lúc|lúc)\s*(\d{1,2})\s*(?:giờ)?(?:\s*(sáng|chiều|tối))?/i,
      /(\d{1,2})\s*(?:giờ)(?:\s*(\d{1,2}))?(?:\s*(phút|sáng|chiều|tối))?/i,
    ];

    for (const pat of timePatterns) {
      const tMatch = lower.match(pat);
      if (tMatch) {
        let h = parseInt(tMatch[1], 10);
        let m = tMatch[2] ? parseInt(tMatch[2], 10) : 0;
        const period = (tMatch[3] || '').toLowerCase();

        if (period === 'chiều' && h < 12) h += 12;
        if (period === 'tối' && h < 12 && h !== 12) h += 12;
        if (period === 'sáng' && h === 12) h = 0;

        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          targetTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          hasExplicitTime = true;
          break;
        }
      }
    }

    // C. Mức ưu tiên (Priority)
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM';
    if (
      lower.includes('khẩn cấp') ||
      lower.includes('gấp') ||
      lower.includes('quan trọng') ||
      lower.includes('urgent')
    ) {
      priority = 'URGENT';
    } else if (lower.includes('ưu tiên cao') || lower.includes('mức cao') || lower.includes('high')) {
      priority = 'HIGH';
    } else if (lower.includes('ưu tiên thấp') || lower.includes('mức thấp') || lower.includes('low')) {
      priority = 'LOW';
    }

    // D. Trích xuất Tiêu đề (Title) sạch:
    // Loại bỏ từ chỉ ngày, chỉ giờ, từ khóa tạo và mức ưu tiên
    let cleanTitle = rawText
      // Bỏ giờ
      .replace(/(?:và\s+)?(?:vào\s+)?(?:lúc|hồi)\s*\d{1,2}(?::|h|\s*giờ\s*|g)\d{0,2}(?:\s*(?:phút|sáng|chiều|tối))?/gi, '')
      .replace(/(?:và\s+)?(?:vào\s+)?(?:lúc|hồi)\s*\d{1,2}(?:\s*giờ|\s*h)?(?:\s*\d{1,2}(?:\s*phút)?)?(?:\s*(?:sáng|chiều|tối))?/gi, '')
      .replace(/(?:và\s+)?(?:vào\s+)?lúc\s*\d{1,2}:\d{2}(?:\s*(?:sáng|chiều|tối))?/gi, '')
      .replace(/(?:và\s+)?\d{1,2}:\d{2}/gi, '')
      .replace(/(?:và\s+)?\d{1,2}\s*(?:giờ|h)(?:\s*\d{1,2}(?:\s*phút)?)?(?:\s*(?:sáng|chiều|tối))?/gi, '')
      // Bỏ ngày dạng slash (29/10/2026, 29/10)
      .replace(/(?:vào\s+)?(?:ngày\s+)?\d{1,2}\/\d{1,2}(?:\/\d{4})?/gi, '')
      // Bỏ ngày dạng chữ (ngày 29 tháng 10 năm 2026, ngày 29 tháng 10)
      .replace(/(?:vào\s+)?ngày\s+\d{1,2}\s+tháng\s+\d{1,2}(?:\s+năm\s+\d{4})?/gi, '')
      // Bỏ ngày DD (ngày 29, ngày 28)
      .replace(/(?:vào\s+)?ngày\s+\d{1,2}(?!\s*[\/:])(?!\s*tháng)/gi, '')
      // Bỏ từ chỉ ngày tương đối
      .replace(/(?:vào\s+)?(?:hôm nay|ngày mai|ngày kia|ngày mốt|hôm sau)/gi, '')
      .replace(/(?:vào\s+)?thứ\s+(?:\d+|hai|ba|bốn|năm|sáu|bảy|chủ nhật)(?:\s+(?:tuần sau|tuần tới))?/gi, '')
      // Bỏ mức ưu tiên
      .replace(/(?:mức\s+)?(?:khẩn cấp|gấp|quan trọng|urgent|ưu tiên cao|mức cao|high|ưu tiên thấp|mức thấp|low)/gi, '')
      // Bỏ tiền tố hành động
      .replace(/^(?:hãy\s+)?(?:thêm|tạo|lập|nhắc nhở|nhắc|hẹn|đặt lịch|lên lịch|ghi chú|deadline)\s+(?:cho tôi\s+|tôi\s+|mình\s+)?(?:vào|công việc|việc|task|lịch hẹn|sự kiện)?\s*/gi, '')
      // Bỏ đại từ nhân xưng hoặc từ nối thừa ở đầu/cuối
      .replace(/^(?:tôi\s+|mình\s+|hãy\s+)/gi, '')
      .replace(/^(?:vào\s+ngày\s+|vào\s+|và\s+|là\s+|rằng\s+|về\s+|cần\s+)/gi, '')
      .replace(/(?:\s+vào|\s+và|\s+lúc|\s+hạn chót|\s+deadline)+$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    cleanTitle = cleanTitle.replace(/^[,.\s-]+|[,.\s-]+$/g, '').trim();

    if (!cleanTitle) {
      cleanTitle = 'Công việc thêm bằng giọng nói';
    } else {
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    }

    const [hPart, mPart] = targetTime.split(':').map((num) => parseInt(num, 10) || 0);
    const deadlineObj = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      hPart,
      mPart,
      0
    );

    return {
      rawText,
      actionType: 'CREATE_TASK',
      confidence: dateInfo.hasExplicitDate || hasExplicitTime ? 0.98 : 0.88,
      targetDate: dateFormatted,
      taskData: {
        title: cleanTitle,
        date: dateFormatted,
        time: targetTime,
        deadline: deadlineObj.toISOString(),
        dueDate: deadlineObj.toISOString(),
        priority,
      },
    };
  }

  // ==============================================================
  // 3. Ý ĐỊNH: TÌM KIẾM & BỘ LỌC (SEARCH / FILTER_SEARCH)
  // Chỉ kích hoạt khi yêu cầu tìm kiếm, lọc task trễ hạn, việc cá nhân, dự án,...
  // ==============================================================
  let filterTarget: 'ALL' | 'PENDING' | 'PROJECTS' | 'TASKS' | undefined = undefined;

  if (
    lower.includes('quá hạn') ||
    lower.includes('cần xử lý') ||
    lower.includes('trễ hạn') ||
    lower.includes('chưa xong')
  ) {
    filterTarget = 'PENDING';
  } else if (
    lower === 'tất cả' ||
    lower === 'toàn bộ' ||
    lower.includes('xem tất cả') ||
    lower.includes('tất cả việc')
  ) {
    filterTarget = 'ALL';
  } else if (lower.includes('dự án')) {
    filterTarget = 'PROJECTS';
  } else if (lower.includes('công việc') || lower.includes('task')) {
    filterTarget = 'TASKS';
  }

  const isSearchAction =
    lower.startsWith('tìm') ||
    lower.startsWith('lọc') ||
    lower.startsWith('tra cứu') ||
    lower.startsWith('xem') ||
    !!filterTarget;

  if (isSearchAction) {
    const cleanSearch = rawText
      .replace(/^(tìm|lọc|tra cứu|xem|kiểm tra|danh sách)\s+/i, '')
      .replace(/(các|công việc|task|nhiệm vụ)?\s*(quá hạn|cần xử lý|trễ hạn|chưa xong)/gi, '')
      .trim();

    return {
      rawText,
      actionType: 'SEARCH',
      filterTarget: filterTarget || 'ALL',
      searchQuery: cleanSearch || rawText,
      confidence: 0.92,
    };
  }

  // Mặc định hỗ trợ tìm kiếm nếu không khớp lệnh đặc biệt
  return {
    rawText,
    actionType: 'SEARCH',
    searchQuery: rawText,
    confidence: 0.7,
  };
};

export const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
  title = 'AI Voice Command Thông Minh',
  placeholder = 'Đang lắng nghe giọng nói tiếng Việt của bạn...',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [previewCommand, setPreviewCommand] = useState<ParsedVoiceCommand | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const countdownIntervalRef = useRef<any>(null);
  const autoExecuteTimeoutRef = useRef<any>(null);
  const isExecutingRef = useRef(false); // Khóa chống lặp (Mutex Lock) ngăn gọi hàm 2 lần

  // Dừng mọi bộ đếm
  const clearTimers = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (autoExecuteTimeoutRef.current) {
      clearTimeout(autoExecuteTimeoutRef.current);
      autoExecuteTimeoutRef.current = null;
    }
    setCountdown(null);
  };

  // Khởi tạo Web Speech API
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

        // Phân tích ý định ngay thời gian thực (Interim NLP preview)
        const parsed = processVoiceIntent(text);
        setPreviewCommand(parsed);

        // Chuẩn bị đếm lùi 1.5 giây để thực thi tự động khi người dùng ngừng nói
        clearTimers();
        const triggerDelay = hasFinal ? 700 : 1200;

        autoExecuteTimeoutRef.current = setTimeout(() => {
          startCountdownExecution(parsed);
        }, triggerDelay);
      }
    };

    recognition.onspeechend = () => {
      if (isExecutingRef.current) return;
      const text = transcriptRef.current?.trim();
      if (text) {
        const parsed = processVoiceIntent(text);
        setPreviewCommand(parsed);
        clearTimers();
        startCountdownExecution(parsed);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Vui lòng cấp quyền Micro trên trình duyệt để sử dụng giọng nói.');
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isExecutingRef.current) return;
      const text = transcriptRef.current?.trim();
      if (text && !countdownIntervalRef.current) {
        const parsed = processVoiceIntent(text);
        setPreviewCommand(parsed);
        startCountdownExecution(parsed);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      clearTimers();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Bắt đầu đếm lùi 1.5 giây và tự động thực thi
  const startCountdownExecution = (cmdToExecute: ParsedVoiceCommand) => {
    if (isExecutingRef.current) return;
    clearTimers();
    let timeLeft = 1.5;
    setCountdown(timeLeft);

    countdownIntervalRef.current = setInterval(() => {
      timeLeft = Math.max(0, Math.round((timeLeft - 0.1) * 10) / 10);
      setCountdown(timeLeft);

      if (timeLeft <= 0) {
        clearTimers();
        executeFinal(cmdToExecute);
      }
    }, 100);
  };

  // Thực thi lệnh cuối cùng (Khóa Mutex Lock chống gọi hàm 2 lần)
  const executeFinal = async (cmd: ParsedVoiceCommand) => {
    if (isExecutingRef.current) return; // Nếu đang chạy thì chặn ngay lập tức
    isExecutingRef.current = true;

    clearTimers();

    // Dừng speech recognition ngay
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      setIsListening(false);
    }

    // Nếu là CREATE_TASK và tự tin thấp, thử gọi API Backend AI hỗ trợ
    let finalCmd = cmd;
    if (cmd.actionType === 'CREATE_TASK' && (cmd.confidence ?? 1) < 0.9) {
      try {
        const res = await apiClient.post('/calendar/voice-parse', { text: cmd.rawText });
        if (res.data?.success && res.data?.data) {
          const aiData = res.data.data;
          if (aiData.intent === 'CREATE_TASK' && aiData.data?.title) {
            finalCmd = {
              rawText: cmd.rawText,
              actionType: 'CREATE_TASK',
              confidence: aiData.confidence || 0.95,
              targetDate: aiData.data.date || cmd.taskData?.date || '2026-10-29',
              taskData: {
                title: aiData.data.title,
                date: aiData.data.date || cmd.taskData?.date || '2026-10-29',
                time: aiData.data.time || cmd.taskData?.time || '09:00',
                deadline: aiData.data.deadline || cmd.taskData?.deadline,
                dueDate: aiData.data.deadline || cmd.taskData?.deadline,
                priority: aiData.data.priority || cmd.taskData?.priority || 'MEDIUM',
              },
            };
          }
        }
      } catch (err) {
        // Fallback dùng local command
      }
    }

    // Phát âm thanh hoàn thành (Ding sound) nếu tạo việc
    if (finalCmd.actionType === 'CREATE_TASK') {
      playSuccessSound();
    }

    // Gọi hàm tạo task đúng 1 lần duy nhất
    onExecuteCommand(finalCmd);
    onClose();

    // Mở khóa sau 1.5 giây
    setTimeout(() => {
      isExecutingRef.current = false;
    }, 1500);
  };

  // Tự động bật micro khi mở modal
  useEffect(() => {
    if (isOpen && isSupported && recognitionRef.current) {
      isExecutingRef.current = false;
      setTranscript('');
      transcriptRef.current = '';
      setPreviewCommand(null);
      clearTimers();
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Lỗi bật micro:', err);
      }
    } else if (!isOpen) {
      clearTimers();
      isExecutingRef.current = false;
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
      clearTimers();
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      transcriptRef.current = '';
      setPreviewCommand(null);
      clearTimers();
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn('Lỗi micro:', e);
      }
    }
  };

  const handleManualExecute = () => {
    if (isExecutingRef.current) return;
    if (!transcript.trim()) {
      toast.error('Chưa nhận diện được giọng nói. Vui lòng nói vào micro.');
      return;
    }
    const cmd = previewCommand || processVoiceIntent(transcript);
    executeFinal(cmd);
  };

  const handleCancelCountdown = () => {
    clearTimers();
    toast('Đã dừng đếm lùi tự động. Bạn có thể nói tiếp hoặc bấm "Thực Thi Ngay".', {
      icon: '⏸️',
    });
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20">
              <Sparkles className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>{title}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 uppercase tracking-wider">
                  vi-VN NLP PRO
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Phân tích thông minh ngày (VD: ngày 29), giờ, mức ưu tiên & tóm tắt lịch trình
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {!isSupported ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>
                Trình duyệt chưa hỗ trợ Web Speech API. Vui lòng sử dụng Google Chrome hoặc Microsoft Edge để trải nghiệm giọng nói AI.
              </span>
            </div>
          ) : (
            <>
              {/* Visualizer & Microphone Center */}
              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative mb-5">
                  {isListening && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-rose-500/25 animate-ping" />
                      <div className="absolute -inset-3 rounded-full bg-purple-500/20 animate-pulse" />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 cursor-pointer ${
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
                <div className="flex items-center gap-1.5 h-6 mb-2">
                  {[0.4, 0.9, 1.3, 0.8, 0.5, 1.1, 0.6].map((scale, idx) => (
                    <motion.span
                      key={idx}
                      animate={
                        isListening
                          ? {
                              scaleY: [0.3, scale * 1.5, 0.3],
                              opacity: [0.5, 1, 0.5],
                            }
                          : { scaleY: 0.2, opacity: 0.3 }
                      }
                      transition={{
                        repeat: Infinity,
                        duration: 0.5 + idx * 0.1,
                        ease: 'easeInOut',
                      }}
                      className="w-1.5 h-5 bg-gradient-to-t from-rose-500 to-purple-600 rounded-full origin-bottom"
                    />
                  ))}
                </div>

                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isListening ? '🎙️ Đang lắng nghe giọng nói tiếng Việt...' : '⏸️ Micro đang tạm dừng. Bấm nút để tiếp tục nói.'}
                </p>
              </div>

              {/* Transcript Display Box */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 min-h-[75px] flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nội dung nhận diện thời gian thực (Interim Results):
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {transcript ? (
                    `"${transcript}"`
                  ) : (
                    <span className="text-slate-400 italic text-xs">{placeholder}</span>
                  )}
                </p>
              </div>

              {/* GIAO DIỆN PHẢN HỒI THỜI GIAN THỰC (PREVIEW CARD & COUNTDOWN) */}
              <AnimatePresence>
                {previewCommand && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    className="overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 p-4 shadow-sm"
                  >
                    {/* Thẻ xem trước: CREATE_TASK */}
                    {previewCommand.actionType === 'CREATE_TASK' && previewCommand.taskData && (
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500 text-white shadow-sm">
                              <CalendarCheck className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                              Phát hiện: Thêm lịch hẹn mới
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              previewCommand.taskData.priority === 'URGENT'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : previewCommand.taskData.priority === 'HIGH'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {previewCommand.taskData.priority === 'URGENT'
                              ? '🔥 Khẩn cấp'
                              : previewCommand.taskData.priority === 'HIGH'
                              ? '⚡ Mức cao'
                              : 'Ưu tiên thường'}
                          </span>
                        </div>

                        {/* Chi tiết việc bóc tách */}
                        <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                            👉 Việc: <span className="text-indigo-600 dark:text-indigo-400">"{previewCommand.taskData.title}"</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                            <span className="flex items-center gap-1">
                              📅 Ngày: <strong className="text-slate-900 dark:text-white">{previewCommand.taskData.date}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              ⏰ Lúc: <strong className="text-slate-900 dark:text-white">{previewCommand.taskData.time}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Countdown bar */}
                        {countdown !== null && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                              <span className="flex items-center gap-1 animate-pulse">
                                <Sparkles className="w-3.5 h-3.5" />
                                Tự động thêm công việc sau {countdown}s...
                              </span>
                              <button
                                type="button"
                                onClick={handleCancelCountdown}
                                className="text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                              >
                                Hủy đếm lùi
                              </button>
                            </div>
                            <div className="w-full bg-indigo-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-rose-500 to-indigo-600 h-full transition-all duration-100"
                                style={{ width: `${(countdown / 1.5) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Thẻ xem trước: SUMMARY_DATE hoặc SUMMARY */}
                    {(previewCommand.actionType === 'SUMMARY_DATE' || previewCommand.actionType === 'SUMMARY') && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-purple-500 text-white shadow-sm">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                            {previewCommand.actionType === 'SUMMARY_DATE'
                              ? `Phát hiện: Tóm tắt lịch trình ngày ${previewCommand.targetDate}`
                              : 'Phát hiện: Tóm tắt & Báo cáo Lịch trình AI'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {previewCommand.targetDate
                            ? `Hệ thống sẽ tổng hợp danh sách công việc ngày ${previewCommand.targetDate} và phát giọng đọc AI chi tiết.`
                            : 'Hệ thống sẽ tổng hợp danh sách việc hoàn thành, sắp đến hạn và đọc phản hồi bằng giọng nói tiếng Việt.'}
                        </p>
                        {countdown !== null && (
                          <div className="text-[11px] font-bold text-purple-600 dark:text-purple-300 flex items-center justify-between pt-1">
                            <span>Tự động kích hoạt sau {countdown}s...</span>
                            <button
                              type="button"
                              onClick={handleCancelCountdown}
                              className="text-rose-500 hover:underline cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Thẻ xem trước: SEARCH / FILTER */}
                    {previewCommand.actionType === 'SEARCH' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-500 text-white shadow-sm">
                            <Filter className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                            Phát hiện: Lọc & Tìm kiếm Lịch biểu
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Bộ lọc: <strong>{previewCommand.filterTarget || 'Tất Cả'}</strong> • Từ khóa: "
                          <strong>{previewCommand.searchQuery || previewCommand.rawText}</strong>"
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mẫu lệnh thử nhanh (Click để thử ngay) */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Mẫu lệnh thử nhanh (Bấm để test ngay):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'tóm tắt công việc ngày 29',
                    'ngày 29 có việc gì',
                    'thêm vào ngày 29 nộp bài lúc 21:10',
                    'tạo việc kiểm tra báo cáo vào ngày mai lúc 15:00',
                    'tìm các việc quá hạn',
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isExecutingRef.current) return;
                        setTranscript(sample);
                        transcriptRef.current = sample;
                        const parsed = processVoiceIntent(sample);
                        setPreviewCommand(parsed);
                        startCountdownExecution(parsed);
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2">
            {countdown !== null && (
              <button
                type="button"
                onClick={handleCancelCountdown}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Tạm dừng
              </button>
            )}

            <button
              type="button"
              onClick={handleManualExecute}
              disabled={!transcript.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-purple-500/25 transition disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Thực Thi Ngay</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VoiceCommandModal;

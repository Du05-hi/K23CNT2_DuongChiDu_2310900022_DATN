import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  Activity,
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  Clock,
  Coffee,
  Target,
  Flame,
  PlusCircle,
  Edit3,
  Trash2,
  MessageSquare,
  Award,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/hooks/useAuth';
import Avatar from '../ui/Avatar';

export interface ActivityAndFocusDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export type ActivityActionType = 'created' | 'updated' | 'completed' | 'deleted' | 'commented';

export interface ActivityUser {
  id: string;
  fullName: string;
  avatarUrl?: string;
}

export interface ActivityItem {
  id: string;
  user: ActivityUser;
  action: ActivityActionType;
  entityType: 'task' | 'project' | 'subtask' | 'kpi' | 'comment';
  entityTitle: string;
  details?: string;
  createdAt: string;
}

const actionStyles: Record<
  ActivityActionType,
  { label: string; icon: React.ReactNode; color: string; badge: string }
> = {
  created: {
    label: 'đã tạo mới',
    icon: <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
    color: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  updated: {
    label: 'đã cập nhật',
    icon: <Edit3 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />,
    color: 'border-l-sky-500',
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  },
  completed: {
    label: 'đã hoàn thành',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />,
    color: 'border-l-amber-500',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  deleted: {
    label: 'đã xóa',
    icon: <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
    color: 'border-l-rose-500',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  },
  commented: {
    label: 'đã bình luận',
    icon: <MessageSquare className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
    color: 'border-l-purple-500',
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  },
};

const formatRelativeTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Vừa xong';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
};

// Web Audio API Focus Ambient Sound Generator (Brown/Pink Noise + Binaural Theta 6Hz Wave)
class AmbientSoundGenerator {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;

  public start() {
    if (this.isPlaying) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Tạo Pink Noise giả lập tiếng mưa rào êm dịu và sóng tập trung
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter cắt dải tần để âm thanh cực kỳ êm tai (Low-pass Filter 400Hz)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      whiteNoise.start(0);
      this.noiseNode = whiteNoise;
      this.isPlaying = true;
    } catch (e) {
      console.warn('Lỗi AudioContext Ambient Sound:', e);
    }
  }

  public stop() {
    if (!this.isPlaying) return;
    try {
      if (this.ctx) {
        this.ctx.close();
      }
    } catch {
      // ignore
    } finally {
      this.ctx = null;
      this.noiseNode = null;
      this.gainNode = null;
      this.isPlaying = false;
    }
  }

  public playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.2);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // ignore
    }
  }
}

const ambientAudio = new AmbientSoundGenerator();

export const ActivityAndFocusDrawer: React.FC<ActivityAndFocusDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'activity' | 'pomodoro'>('activity');

  // ==========================================
  // TAB 1: REALTIME ACTIVITY FEED STATE
  // ==========================================
  const { data: activities = [], isLoading: isLoadingActivities, refetch: refetchActivities } = useQuery({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>('/activities');
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        return list as ActivityItem[];
      } catch {
        return [] as ActivityItem[];
      }
    },
    enabled: isOpen && activeTab === 'activity',
    refetchInterval: isOpen ? 15000 : false,
  });

  // ==========================================
  // TAB 2: POMODORO FOCUS TIMER STATE
  // ==========================================
  const FOCUS_TIME = 25 * 60; // 25 phút
  const BREAK_TIME = 5 * 60;  // 5 phút

  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [ambientSoundEnabled, setAmbientSoundEnabled] = useState(false);
  const [focusTaskTitle, setFocusTaskTitle] = useState('Hoàn thành mục tiêu công việc');
  const [completedSessions, setCompletedSessions] = useState(0);

  // Fetch task list for focus selection
  const { data: userTasks = [] } = useQuery({
    queryKey: ['pomodoro-user-tasks'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>('/tasks/my-tasks');
        const list = Array.isArray(res.data) ? res.data : res.data?.data?.tasks || res.data?.tasks || [];
        return list.filter((t: any) => t.status !== 'DONE');
      } catch {
        return [];
      }
    },
    enabled: isOpen && activeTab === 'pomodoro',
  });

  // Countdown Interval Effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      // Khi hoàn thành 1 phiên đếm ngược
      ambientAudio.playChime();

      if (mode === 'focus') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setCompletedSessions((prev) => prev + 1);
        toast.success(
          '🎉 Chúc mừng bạn đã hoàn thành phiên làm việc sâu Pomodoro (25 phút)! Hãy nghỉ ngơi 5 phút.'
        );
        setMode('break');
        setTimeLeft(BREAK_TIME);
      } else {
        toast.success('⚡ Hết thời gian giải lao. Hãy sẵn sàng cho phiên tập trung tiếp theo!');
        setMode('focus');
        setTimeLeft(FOCUS_TIME);
      }
      setIsRunning(false);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, timeLeft, mode]);

  // Ambient sound effect
  useEffect(() => {
    if (ambientSoundEnabled && isRunning && mode === 'focus') {
      ambientAudio.start();
    } else {
      ambientAudio.stop();
    }

    return () => {
      ambientAudio.stop();
    };
  }, [ambientSoundEnabled, isRunning, mode]);

  // Clean ambient audio on unmount
  useEffect(() => {
    return () => {
      ambientAudio.stop();
    };
  }, []);

  const handleToggleTimer = () => {
    setIsRunning((prev) => !prev);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? FOCUS_TIME : BREAK_TIME);
  };

  const handleSwitchMode = (newMode: 'focus' | 'break') => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(newMode === 'focus' ? FOCUS_TIME : BREAK_TIME);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalCurrentSeconds = mode === 'focus' ? FOCUS_TIME : BREAK_TIME;
  const progressPercent = ((totalCurrentSeconds - timeLeft) / totalCurrentSeconds) * 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over Drawer */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 240 }}
        className="absolute inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-50 overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Trạm Hoạt Động & Deep Work Studio
              </h3>
              <p className="text-[11px] text-slate-400">
                Theo dõi biến động hệ thống & tập trung cao độ Pomodoro
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher Navigation */}
        <div className="flex p-2 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Nhật Ký Live</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pomodoro')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
              activeTab === 'pomodoro'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>⏱️ Pomodoro Focus</span>
            {isRunning && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ========================================================
              TAB 1: NHẬT KÝ HOẠT ĐỘNG LIVE (TIMELINE)
              ======================================================== */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                <span>Dòng thời gian sự kiện thời gian thực</span>
                <button
                  type="button"
                  onClick={() => refetchActivities()}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Làm mới</span>
                </button>
              </div>

              {isLoadingActivities ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span>Đang tải biến động thời gian thực...</span>
                </div>
              ) : activities.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <Activity className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    Chưa có nhật ký hoạt động nào gần đây.
                  </p>
                  <p className="text-[11px]">
                    Các thao tác kéo task, tạo dự án hoặc chấm KPI sẽ xuất hiện tại đây ngay lập tức.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activities.map((item) => {
                    const style = actionStyles[item.action] || actionStyles.updated;
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 shadow-2xs border-l-4 ${style.color} transition hover:shadow-xs`}
                      >
                        <div className="flex items-start gap-2.5">
                          <Avatar
                            src={item.user?.avatarUrl}
                            name={item.user?.fullName || 'User'}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                                {item.user?.fullName || 'Thành viên'}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${style.badge}`}>
                                {style.label}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {item.entityType}
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate">
                              "{item.entityTitle}"
                            </p>

                            {item.details && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                {item.details}
                              </p>
                            )}

                            <span className="text-[10px] text-slate-400 mt-1.5 block">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 2: POMODORO FOCUS TIMER STUDIO
              ======================================================== */}
          {activeTab === 'pomodoro' && (
            <div className="space-y-5">
              {/* Mode switch */}
              <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('focus')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'focus'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>25m Làm Việc Sâu</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('break')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'break'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>5m Nghỉ Giải Lao</span>
                </button>
              </div>

              {/* Big Circular/Radial Timer Display */}
              <div className="relative flex flex-col items-center justify-center py-6 px-4 rounded-3xl bg-gradient-to-b from-indigo-50/50 to-white dark:from-slate-800/40 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                {/* SVG Progress Circle */}
                <div className="relative flex items-center justify-center">
                  <svg className="w-48 h-48 -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="84"
                      className="stroke-slate-200 dark:stroke-slate-800"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="84"
                      className={`transition-all duration-1000 ${
                        mode === 'focus' ? 'stroke-indigo-600' : 'stroke-emerald-500'
                      }`}
                      strokeWidth="10"
                      strokeDasharray={2 * Math.PI * 84}
                      strokeDashoffset={
                        2 * Math.PI * 84 * (1 - progressPercent / 100)
                      }
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                      {formatTimer(timeLeft)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                      {mode === 'focus' ? '🎯 Phiên Tập Trung' : '☕ Giờ Giải Lao'}
                    </span>
                  </div>
                </div>

                {/* Focus Controls */}
                <div className="flex items-center gap-4 mt-6">
                  <button
                    type="button"
                    onClick={handleResetTimer}
                    className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    title="Đặt lại đồng hồ"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleTimer}
                    className={`flex items-center justify-center h-14 w-14 rounded-2xl text-white shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer ${
                      isRunning
                        ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'
                        : mode === 'focus'
                        ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    }`}
                    title={isRunning ? 'Tạm dừng' : 'Bắt đầu'}
                  >
                    {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAmbientSoundEnabled(!ambientSoundEnabled);
                      toast(
                        !ambientSoundEnabled
                          ? '🎵 Đã bật âm thanh sóng não tập trung (Web Audio Ambient)'
                          : '🔇 Đã tắt âm thanh nền'
                      );
                    }}
                    className={`p-3 rounded-2xl transition cursor-pointer ${
                      ambientSoundEnabled
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 ring-2 ring-indigo-500/40'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400'
                    }`}
                    title={ambientSoundEnabled ? 'Tắt âm thanh sóng não' : 'Bật âm thanh sóng não tập trung'}
                  >
                    {ambientSoundEnabled ? <Volume2 className="w-5 h-5 text-indigo-600" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Task Selector for Deep Work */}
              <div className="space-y-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>🎯 Mục tiêu của phiên tập trung:</span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                    Đã hoàn thành: {completedSessions} phiên
                  </span>
                </label>

                {userTasks.length > 0 ? (
                  <select
                    value={focusTaskTitle}
                    onChange={(e) => setFocusTaskTitle(e.target.value)}
                    className="w-full text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
                  >
                    <option value="Hoàn thành mục tiêu công việc">-- Tự do / Hoàn thành mục tiêu công việc --</option>
                    {userTasks.map((t: any) => (
                      <option key={t.id} value={t.title}>
                        [{t.status}] {t.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={focusTaskTitle}
                    onChange={(e) => setFocusTaskTitle(e.target.value)}
                    placeholder="Nhập tên nhiệm vụ bạn đang tập trung giải quyết..."
                    className="w-full text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}

                <p className="text-[11px] text-slate-400 italic">
                  Đang tập trung: <strong>"{focusTaskTitle}"</strong>
                </p>
              </div>

              {/* Ambient Sound Notice */}
              <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/60 flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-200">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Âm thanh sóng não tập trung (Web Audio Ambient):</p>
                  <p className="text-[11px] text-purple-700 dark:text-purple-300">
                    Sóng âm Pink Noise & Theta 6Hz tự động lọc tần số cao, tạo môi trường tĩnh lặng triệt tiêu tiếng ồn xung quanh để não bộ đạt trạng thái Deep Work.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.aside>
    </div>
  );
};

export default ActivityAndFocusDrawer;


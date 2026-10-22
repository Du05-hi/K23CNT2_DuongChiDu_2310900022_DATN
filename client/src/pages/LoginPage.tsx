import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Lightbulb,
  CheckCircle2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import authService from '@/services/authService';
import { toast } from 'sonner';
import { useAppDispatch, setCredentials } from '@/store';
import axios from 'axios';

type AuthMode = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password';

export const LoginPage: React.FC = () => {
  const { isAuthenticated, user, login, isLoading } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lamp state (default: ON - Light Mode)
  const [isLampOn, setIsLampOn] = useState(true);
  const [isChainPulled, setIsChainPulled] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (!error) return;

    toast.error(
      error === 'GoogleOAuthNotConfigured'
        ? 'Google OAuth chưa được cấu hình trên máy chủ.'
        : 'Đăng nhập Google không thành công. Vui lòng thử lại.'
    );
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  if (isAuthenticated) {
    const homePath =
      user?.role === 'ADMIN'
        ? '/admin'
        : user?.role === 'MANAGER'
        ? '/manager'
        : user?.role === 'EMPLOYEE'
        ? '/my-work'
        : '/dashboard';
    return <Navigate to={homePath} replace />;
  }

  const handleToggleLamp = () => {
    setIsChainPulled(true);
    setTimeout(() => {
      setIsLampOn((prev) => !prev);
      setIsChainPulled(false);
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        await login({ email, password });
      } else if (authMode === 'register') {
        await authService.register({ name, email, password });
        setAuthMode('verify-email');
        setOtp('');
        toast.success('Mã xác nhận đã được gửi đến email của bạn.');
      } else if (authMode === 'verify-email') {
        const response = await authService.verifyEmail(email, otp);
        const { user: authedUser, accessToken, refreshToken } = response.data;
        dispatch(setCredentials({ user: authedUser, accessToken, refreshToken }));
        toast.success('Email đã xác nhận. Tài khoản của bạn đã được kích hoạt.');
        navigate(
          authedUser.role === 'ADMIN'
            ? '/admin'
            : authedUser.role === 'MANAGER'
            ? '/manager'
            : '/my-work',
          { replace: true }
        );
      } else if (authMode === 'forgot-password') {
        const response = await authService.forgotPassword(email);
        toast.success(response.message || 'Nếu email đã đăng ký, mã khôi phục sẽ được gửi đến hộp thư.');
        setAuthMode('reset-password');
        setOtp('');
      } else {
        if (password !== confirmPassword) {
          toast.warning('Mật khẩu xác nhận không khớp.');
          return;
        }
        const response = await authService.resetPassword(email, otp, password);
        toast.success(response.message || 'Đặt lại mật khẩu thành công.');
        setPassword('');
        setConfirmPassword('');
        setOtp('');
        setAuthMode('login');
      }
    } catch (err: unknown) {
      if (authMode !== 'login') {
        const responseMessage = axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message
          : undefined;
        toast.error(responseMessage || 'Không thể hoàn tất yêu cầu. Vui lòng kiểm tra thông tin và thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiUrl = new URL(
      import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      window.location.origin
    );
    const apiPath = apiUrl.pathname.replace(/\/+$/, '');
    const apiPrefix = apiPath.endsWith('/api') ? apiPath : `${apiPath}/api`;
    apiUrl.pathname = `${apiPrefix}/auth/google`;
    apiUrl.search = '';
    apiUrl.hash = '';
    window.location.assign(apiUrl.toString());
  };

  return (
    <div
      className={`relative min-h-screen font-sans transition-all duration-700 ease-in-out flex ${
        isLampOn
          ? 'bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 text-slate-900'
          : 'bg-[#090d16] text-slate-100 dark'
      }`}
    >
      {/* ============================================================== */}
      {/* CỘT TRÁI: CHIẾC ĐÈN BÀN TƯƠNG TÁC (INTERACTIVE PULL-CHAIN LAMP) */}
      {/* ============================================================== */}
      <div
        className={`relative hidden lg:flex lg:w-1/2 flex-col justify-between p-10 xl:p-14 transition-all duration-700 overflow-hidden border-r ${
          isLampOn
            ? 'border-indigo-100/80 bg-white/40 backdrop-blur-xl'
            : 'border-slate-800/80 bg-gradient-to-br from-[#0e1424] via-[#090d16] to-[#0d1220]'
        }`}
      >
        {/* Ambient Glows */}
        <div
          className={`pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full transition-all duration-700 blur-3xl ${
            isLampOn ? 'bg-indigo-300/30' : 'bg-indigo-600/15'
          }`}
        />
        <div
          className={`pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full transition-all duration-700 blur-3xl ${
            isLampOn ? 'bg-purple-300/25' : 'bg-purple-600/10'
          }`}
        />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xl shadow-lg shadow-indigo-500/25">
              ⚡
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                TaskFlow AI
              </span>
              <p className={`text-[11px] font-medium ${isLampOn ? 'text-slate-500' : 'text-slate-400'}`}>
                Enterprise Workspace Solution
              </p>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-500 ${
              isLampOn
                ? 'bg-indigo-50/80 border-indigo-200/80 text-indigo-700 shadow-sm'
                : 'bg-white/5 border-white/10 text-indigo-300'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          </div>
        </div>

        {/* Center: The Interactive Lamp Visual */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center py-6">
          {/* Light Beam Cone (visible when Lamp is ON) */}
          <div
            className={`pointer-events-none absolute top-[90px] w-[340px] h-[280px] rounded-full transition-all duration-700 ${
              isLampOn
                ? 'opacity-100 scale-100 bg-gradient-to-b from-indigo-400/25 via-amber-200/20 to-transparent blur-2xl'
                : 'opacity-0 scale-90'
            }`}
          />

          {/* Lamp SVG Graphic */}
          <div className="relative select-none">
            <svg
              width="240"
              height="260"
              viewBox="0 0 240 260"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-xl"
            >
              {/* Lamp Base */}
              <ellipse
                cx="120"
                cy="235"
                rx="65"
                ry="14"
                fill={isLampOn ? '#64748b' : '#334155'}
                className="transition-colors duration-500"
              />
              <ellipse
                cx="120"
                cy="232"
                rx="58"
                ry="10"
                fill={isLampOn ? '#94a3b8' : '#1e293b'}
                className="transition-colors duration-500"
              />

              {/* Lamp Base Ring */}
              <ellipse
                cx="120"
                cy="231"
                rx="20"
                ry="5"
                fill={isLampOn ? '#cbd5e1' : '#475569'}
              />

              {/* Lamp Pole (Thân kim loại) */}
              <line
                x1="120"
                y1="230"
                x2="120"
                y2="90"
                stroke={isLampOn ? '#64748b' : '#334155'}
                strokeWidth="7"
                strokeLinecap="round"
                className="transition-colors duration-500"
              />
              <line
                x1="118.5"
                y1="230"
                x2="118.5"
                y2="90"
                stroke={isLampOn ? '#cbd5e1' : '#64748b'}
                strokeWidth="2"
                strokeLinecap="round"
                className="transition-colors duration-500"
              />

              {/* Curved Arm to Shade */}
              <path
                d="M 120 90 Q 120 50 145 45"
                fill="none"
                stroke={isLampOn ? '#64748b' : '#334155'}
                strokeWidth="7"
                strokeLinecap="round"
              />

              {/* Lamp Shade (Chụp đèn Studio) - Clickable to toggle */}
              <g
                onClick={handleToggleLamp}
                className="cursor-pointer group transition-transform duration-300 hover:scale-[1.02]"
                aria-label="Bấm vào chụp đèn để Bật / Tắt"
              >
                <title>Bấm vào chụp đèn để Bật / Tắt</title>
                {/* Outer Shade Cone */}
                <path
                  d="M 120 40 L 170 50 L 195 110 L 95 110 Z"
                  fill={isLampOn ? 'url(#shadeGradientOn)' : 'url(#shadeGradientOff)'}
                  stroke={isLampOn ? '#4f46e5' : '#1e293b'}
                  strokeWidth="2"
                  className="transition-all duration-500"
                />

                {/* Inner Shade Glow/Rim */}
                <ellipse
                  cx="145"
                  cy="110"
                  rx="50"
                  ry="12"
                  fill={isLampOn ? '#fef08a' : '#1e293b'}
                  stroke={isLampOn ? '#facc15' : '#0f172a'}
                  strokeWidth="2"
                  className="transition-all duration-500"
                />

                {/* Bulb Glow when ON */}
                {isLampOn && (
                  <circle
                    cx="145"
                    cy="104"
                    r="14"
                    fill="#ffffff"
                    filter="url(#bulbGlow)"
                  />
                )}
              </g>

              {/* Pull Chain (Dây kéo công tắc) */}
              <g
                onClick={handleToggleLamp}
                className="cursor-pointer group"
                style={{
                  transformOrigin: '170px 110px',
                  transform: isChainPulled ? 'translateY(12px) scaleY(1.08)' : 'translateY(0)',
                  transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                aria-label="Kéo dây để Bật / Tắt đèn"
              >
                <title>Kéo dây để Bật / Tắt đèn</title>
                {/* Chain links */}
                <line
                  x1="170"
                  y1="112"
                  x2="170"
                  y2="185"
                  stroke={isLampOn ? '#eab308' : '#94a3b8'}
                  strokeWidth="2"
                  strokeDasharray="2 3"
                  className="transition-colors duration-300"
                />
                {/* Golden / Metallic Bead at end */}
                <circle
                  cx="170"
                  cy="192"
                  r="6.5"
                  fill={isLampOn ? '#f59e0b' : '#64748b'}
                  stroke={isLampOn ? '#fef08a' : '#94a3b8'}
                  strokeWidth="2"
                  className="transition-all duration-300 group-hover:scale-125"
                />
                <circle
                  cx="168"
                  cy="190"
                  r="1.8"
                  fill="#ffffff"
                  opacity={isLampOn ? 0.9 : 0.5}
                />
              </g>

              {/* Gradients & Filters */}
              <defs>
                <linearGradient id="shadeGradientOn" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="60%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
                <linearGradient id="shadeGradientOff" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
                <filter id="bulbGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>
          </div>

          {/* Interactive Toggle Helper Pill */}
          <button
            type="button"
            onClick={handleToggleLamp}
            className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all duration-300 shadow-sm cursor-pointer active:scale-95 border ${
              isLampOn
                ? 'bg-white/90 text-indigo-700 border-indigo-200/80 hover:bg-white shadow-indigo-500/10'
                : 'bg-slate-800/80 text-amber-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Lightbulb className={`h-4 w-4 ${isLampOn ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
            <span>
              {isLampOn
                ? '✨ Kéo dây đèn hoặc click đèn để Bật / Tắt ánh sáng'
                : '🌙 Đèn đang tắt • Kéo dây để Bật ánh sáng'}
            </span>
          </button>
        </div>

        {/* Bottom Feature Badges */}
        <div className="relative z-10 space-y-4">
          <div className="space-y-1.5">
            <h1 className={`text-2xl xl:text-3xl font-extrabold leading-tight ${isLampOn ? 'text-slate-900' : 'text-white'}`}>
              Quản trị công việc & Đánh giá hiệu suất thông minh
            </h1>
            <p className={`text-xs xl:text-sm leading-relaxed ${isLampOn ? 'text-slate-600' : 'text-slate-400'}`}>
              Nền tảng đồng bộ hóa nhiệm vụ thời gian thực, bảng Kanban đa chức năng, tính điểm KPI tự động
              và trợ lý AI Google Gemini hỗ trợ phân tích hiệu suất nhân sự toàn diện.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div
              className={`p-3.5 rounded-2xl border transition-all duration-500 ${
                isLampOn
                  ? 'bg-white/80 border-slate-200/90 shadow-sm'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-indigo-600" />
                <span className={`text-lg font-bold ${isLampOn ? 'text-slate-900' : 'text-white'}`}>100%</span>
              </div>
              <p className={`text-xs ${isLampOn ? 'text-slate-600' : 'text-slate-400'}`}>
                Thời gian thực với WebSocket
              </p>
            </div>

            <div
              className={`p-3.5 rounded-2xl border transition-all duration-500 ${
                isLampOn
                  ? 'bg-white/80 border-slate-200/90 shadow-sm'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className={`text-lg font-bold ${isLampOn ? 'text-slate-900' : 'text-white'}`}>AI Gen</span>
              </div>
              <p className={`text-xs ${isLampOn ? 'text-slate-600' : 'text-slate-400'}`}>
                Google Gemini KPI Analysis
              </p>
            </div>
          </div>

          <p className={`text-[11px] pt-1 ${isLampOn ? 'text-slate-500' : 'text-slate-500'}`}>
          
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ THEO BÓNG ĐÈN (LAMP SYNC) */}
      {/* ============================================================== */}
      <div className="relative flex flex-1 items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${authMode}-${isLampOn}`}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`relative w-full max-w-md space-y-6 rounded-3xl p-8 sm:p-10 border transition-all duration-500 backdrop-blur-2xl ${
              isLampOn
                ? 'bg-white/95 border-slate-200/80 shadow-2xl shadow-indigo-500/10 text-slate-800'
                : 'bg-slate-900/80 border-slate-800 shadow-2xl shadow-black/70 text-slate-100'
            }`}
          >
            {/* Mobile Brand Logo */}
            <div className="text-center">
              <div className="lg:hidden inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xl mb-3 shadow-lg shadow-indigo-500/30">
                ⚡
              </div>

              {/* Mode Switcher Tabs */}
              {(authMode === 'login' || authMode === 'register') && (
                <div
                  className={`inline-flex p-1 rounded-2xl border mb-5 max-w-xs mx-auto w-full transition-colors duration-300 ${
                    isLampOn
                      ? 'bg-slate-100/90 border-slate-200 text-slate-600'
                      : 'bg-slate-800/90 border-slate-700 text-slate-400'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                      authMode === 'login'
                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white'
                        : 'hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                      authMode === 'register'
                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white'
                        : 'hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Đăng ký mới
                  </button>
                </div>
              )}

              <h2 className="text-2xl font-extrabold tracking-tight">
                {authMode === 'register'
                  ? 'Tạo tài khoản mới'
                  : authMode === 'verify-email'
                  ? 'Xác nhận mã OTP'
                  : authMode === 'forgot-password'
                  ? 'Khôi phục mật khẩu'
                  : authMode === 'reset-password'
                  ? 'Đặt lại mật khẩu'
                  : 'Đăng nhập hệ thống'}
              </h2>
              <p
                className={`mt-1.5 text-xs leading-relaxed ${
                  isLampOn ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {authMode === 'register'
                  ? 'Nhập thông tin nhân sự để tạo tài khoản TaskFlow AI'
                  : authMode === 'verify-email'
                  ? `Nhập mã 6 chữ số vừa được gửi tới ${email}.`
                  : authMode === 'forgot-password'
                  ? 'Nhập email tài khoản để nhận mã khôi phục.'
                  : authMode === 'reset-password'
                  ? `Nhập mã xác nhận gửi tới ${email} và mật khẩu mới.`
                  : 'Chào mừng bạn quay trở lại với không gian làm việc TaskFlow AI'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label
                    className={`block text-xs font-semibold mb-1.5 ${
                      isLampOn ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    Họ và tên
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      required
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isLampOn
                          ? 'border-slate-200 bg-slate-50/90 text-slate-800 placeholder-slate-400 focus:bg-white'
                          : 'border-slate-700 bg-slate-800/90 text-slate-100 placeholder-slate-500 focus:bg-slate-800'
                      }`}
                    />
                  </div>
                </div>
              )}

              {authMode !== 'verify-email' && authMode !== 'reset-password' && (
                <div>
                  <label
                    className={`block text-xs font-semibold mb-1.5 ${
                      isLampOn ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    Email công vụ
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@taskflow.vn hoặc user@taskflow.vn"
                      required
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isLampOn
                          ? 'border-slate-200 bg-slate-50/90 text-slate-800 placeholder-slate-400 focus:bg-white'
                          : 'border-slate-700 bg-slate-800/90 text-slate-100 placeholder-slate-500 focus:bg-slate-800'
                      }`}
                    />
                  </div>
                </div>
              )}

              {authMode === 'verify-email' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      const response = await authService.resendEmailVerification(email);
                      toast.success(
                        response.message || 'Nếu tài khoản đang chờ xác nhận, mã mới sẽ được gửi đến email.'
                      );
                    } catch (error: unknown) {
                      const message = axios.isAxiosError<{ message?: string }>(error)
                        ? error.response?.data?.message
                        : undefined;
                      toast.error(message || 'Không thể gửi lại mã xác nhận.');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="w-full text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
                >
                  Gửi lại mã xác nhận
                </button>
              )}

              {(authMode === 'verify-email' || authMode === 'reset-password') && (
                <div>
                  <label
                    htmlFor="auth-otp"
                    className={`mb-1.5 block text-xs font-semibold ${
                      isLampOn ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    Mã xác thực OTP
                  </label>
                  <input
                    id="auth-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="Nhập mã 6 chữ số"
                    required
                    className={`w-full rounded-xl border px-4 py-2.5 text-center text-lg tracking-[0.4em] font-mono transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isLampOn
                        ? 'border-slate-200 bg-slate-50/90 text-slate-800 focus:bg-white'
                        : 'border-slate-700 bg-slate-800/90 text-slate-100 focus:bg-slate-800'
                    }`}
                  />
                </div>
              )}

              {authMode === 'reset-password' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      const response = await authService.forgotPassword(email);
                      toast.success(
                        response.message || 'Nếu email đã đăng ký, mã khôi phục sẽ được gửi đến hộp thư.'
                      );
                    } catch (error: unknown) {
                      const message = axios.isAxiosError<{ message?: string }>(error)
                        ? error.response?.data?.message
                        : undefined;
                      toast.error(message || 'Không thể gửi lại mã khôi phục.');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="w-full text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
                >
                  Gửi lại mã khôi phục
                </button>
              )}

              {(authMode === 'login' || authMode === 'register' || authMode === 'reset-password') && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      className={`text-xs font-semibold ${
                        isLampOn ? 'text-slate-700' : 'text-slate-300'
                      }`}
                    >
                      {authMode === 'reset-password' ? 'Mật khẩu mới' : 'Mật khẩu'}
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setAuthMode('forgot-password')}
                        className="text-xs text-indigo-600 hover:underline dark:text-indigo-400 font-medium"
                      >
                        Quên mật khẩu?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={authMode === 'login' ? undefined : 6}
                      required
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isLampOn
                          ? 'border-slate-200 bg-slate-50/90 text-slate-800 placeholder-slate-400 focus:bg-white'
                          : 'border-slate-700 bg-slate-800/90 text-slate-100 placeholder-slate-500 focus:bg-slate-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {authMode === 'reset-password' && (
                <div>
                  <label
                    htmlFor="confirm-new-password"
                    className={`mb-1.5 block text-xs font-semibold ${
                      isLampOn ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      id="confirm-new-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      minLength={6}
                      required
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isLampOn
                          ? 'border-slate-200 bg-slate-50/90 text-slate-800 placeholder-slate-400 focus:bg-white'
                          : 'border-slate-700 bg-slate-800/90 text-slate-100 placeholder-slate-500 focus:bg-slate-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isLoading || isSubmitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {authMode === 'register'
                        ? 'Gửi mã xác nhận ->'
                        : authMode === 'verify-email'
                        ? 'Xác nhận tài khoản ->'
                        : authMode === 'forgot-password'
                        ? 'Gửi mã khôi phục ->'
                        : authMode === 'reset-password'
                        ? 'Đặt lại mật khẩu ->'
                        : 'Đăng nhập ->'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Google OAuth Section */}
            {(authMode === 'login' || authMode === 'register') && (
              <>
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div
                      className={`w-full border-t ${
                        isLampOn ? 'border-slate-200' : 'border-slate-800'
                      }`}
                    />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                    <span
                      className={`px-3 ${
                        isLampOn ? 'bg-white text-slate-400' : 'bg-slate-900 text-slate-500'
                      }`}
                    >
                      Hoặc tiếp tục với
                    </span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className={`flex items-center justify-center gap-2.5 w-full py-2.5 rounded-xl border text-xs font-semibold transition shadow-sm cursor-pointer ${
                      isLampOn
                        ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Tiếp tục với Google Workspace</span>
                  </button>
                </div>
              </>
            )}

            {/* Bottom Switch Mode Link */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setPassword('');
                  setOtp('');
                  setConfirmPassword('');
                  setAuthMode(
                    authMode === 'register' ? 'login' : authMode === 'login' ? 'register' : 'login'
                  );
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
              >
                {authMode === 'register'
                  ? 'Đã có tài khoản? Đăng nhập ngay'
                  : authMode === 'login'
                  ? 'Chưa có tài khoản? Đăng ký nhân sự mới'
                  : '← Quay lại màn hình đăng nhập'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoginPage;
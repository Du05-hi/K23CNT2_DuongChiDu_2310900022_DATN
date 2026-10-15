import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, ArrowRight } from 'lucide-react';
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

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const error = searchParams.get('error');
    if (!error) return;

    toast.error(error === 'GoogleOAuthNotConfigured'
      ? 'Google OAuth chưa được cấu hình trên máy chủ.'
      : 'Đăng nhập Google không thành công. Vui lòng thử lại.');
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  if (isAuthenticated) {
    const homePath = user?.role === 'ADMIN'
      ? '/admin'
      : user?.role === 'MANAGER'
      ? '/manager'
      : user?.role === 'EMPLOYEE'
      ? '/my-work'
      : '/dashboard';
    return <Navigate to={homePath} replace />;
  }

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
        const { user, accessToken, refreshToken } = response.data;
        dispatch(setCredentials({ user, accessToken, refreshToken }));
        toast.success('Email đã xác nhận. Tài khoản của bạn đã được kích hoạt.');
        navigate(user.role === 'ADMIN' ? '/admin' : user.role === 'MANAGER' ? '/manager' : '/my-work', { replace: true });
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
    <div className="dark flex min-h-screen bg-[#0b0f19] font-sans text-slate-100">
      {/* Cột trái giới thiệu dự án với hiệu ứng Gradient */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#111827] via-[#0b0f19] to-[#111827] p-12 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="flex items-center gap-3 z-10">
          <div className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-xl shadow-lg">
            ⚡
          </div>
          <span className="text-2xl font-bold tracking-tight">TaskFlow AI</span>
        </div>

        <div className="z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-amber-300" />
            Đồ án tốt nghiệp K23CNT2 - Đỗ & Dương
          </div>
          <h1 className="text-4xl font-extrabold leading-tight">
            Quản trị công việc & Đánh giá hiệu suất thông minh tích hợp AI
          </h1>
          <p className="text-indigo-100 text-sm leading-relaxed">
            Nền tảng đồng bộ hóa nhiệm vụ thời gian thực, bảng Kanban đa chức năng, tính điểm KPI tự động
            và trợ lý AI thông minh hỗ trợ phân tích hiệu suất nhân sự toàn diện.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <p className="text-2xl font-bold">100%</p>
              <p className="text-xs text-indigo-100">Thời gian thực với WebSocket</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <p className="text-2xl font-bold">AI Gen</p>
              <p className="text-xs text-indigo-100">Google Gemini KPI Analysis</p>
            </div>
          </div>
        </div>

        <div className="text-xs text-indigo-200 z-10">
          © 2026 TaskFlow AI. Sản phẩm hoàn thiện đầy đủ cho Đồ án Tốt Nghiệp.
        </div>
      </div>

      {/* Cột phải Form đăng nhập */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6 sm:p-12">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[100px]" />
        <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={authMode}
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.99 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-[0_24px_100px_-35px_rgba(79,70,229,0.55)] backdrop-blur-2xl sm:p-10"
        >
          <div className="text-center">
            <div className="lg:hidden inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-xl mb-4 shadow-lg shadow-indigo-500/30">
              ⚡
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {authMode === 'register'
                ? 'Tạo tài khoản mới'
                : authMode === 'verify-email'
                ? 'Xác nhận email'
                : authMode === 'forgot-password'
                ? 'Quên mật khẩu'
                : authMode === 'reset-password'
                ? 'Đặt lại mật khẩu'
                : 'Đăng nhập hệ thống'}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              {authMode === 'register'
                ? 'Nhập thông tin để tạo tài khoản TaskFlow AI'
                : authMode === 'verify-email'
                ? `Nhập mã 6 chữ số vừa được gửi tới ${email}. Mã có hiệu lực trong 5 phút.`
                : authMode === 'forgot-password'
                ? 'Nhập email tài khoản để nhận mã khôi phục.'
                : authMode === 'reset-password'
                ? `Nhập mã gửi tới ${email} và chọn mật khẩu mới.`
                : 'Chào mừng bạn quay trở lại với không gian làm việc TaskFlow AI'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

            )}

            {authMode !== 'verify-email' && authMode !== 'reset-password' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
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
                    toast.success(response.message || 'Nếu tài khoản đang chờ xác nhận, mã mới sẽ được gửi đến email.');
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
                <label htmlFor="auth-otp" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mã OTP
                </label>
                <input
                  id="auth-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Nhập mã 6 chữ số"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-lg tracking-[0.4em] dark:border-slate-700 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    toast.success(response.message || 'Nếu email đã đăng ký, mã khôi phục sẽ được gửi đến hộp thư.');
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
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {authMode === 'reset-password' ? 'Mật khẩu mới' : 'Mật khẩu'}
                </label>
                {authMode === 'login' && (
                  <button type="button" onClick={() => setAuthMode('forgot-password')} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={authMode === 'login' ? undefined : 6}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
            </div>
            )}

            {authMode === 'reset-password' && (
              <div>
                <label htmlFor="confirm-new-password" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  minLength={6}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isLoading || isSubmitting ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {authMode === 'register'
                      ? 'Gửi mã xác nhận'
                      : authMode === 'verify-email'
                      ? 'Xác nhận tài khoản'
                      : authMode === 'forgot-password'
                      ? 'Gửi mã khôi phục'
                      : authMode === 'reset-password'
                      ? 'Đặt lại mật khẩu'
                      : 'Đăng nhập'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Hoặc đăng nhập với Google */}
          {(authMode === 'login' || authMode === 'register') && (
          <>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-400">Hoặc tiếp tục với</span>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Tiếp tục với Google
            </button>
          </div>
          </>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setPassword('');
                setOtp('');
                setConfirmPassword('');
                setAuthMode(authMode === 'register' ? 'login' : authMode === 'login' ? 'register' : 'login');
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              {authMode === 'register'
                ? 'Đã có tài khoản? Đăng nhập ngay'
                : authMode === 'login'
                ? 'Chưa có tài khoản? Đăng ký nhân sự mới'
                : 'Quay lại đăng nhập'}
            </button>
          </div>
        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoginPage;

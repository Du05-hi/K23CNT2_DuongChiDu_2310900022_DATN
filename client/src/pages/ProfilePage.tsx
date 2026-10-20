import React, { useEffect, useState, useMemo } from 'react';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
  UserRound,
  Camera,
  Award,
  Zap,
  CheckCircle2,
  Smartphone,
  Briefcase,
  Sparkles,
  QrCode,
  Shield,
  Eye,
  EyeOff,
  Flame,
  Star,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import authService from '@/services/authService';
import toast from 'react-hot-toast';

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  EMPLOYEE: 'Nhân viên',
};

export const ProfilePage: React.FC = () => {
  const { user, updateProfile, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'badges'>('profile');

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('0987 654 321');
  const [title, setTitle] = useState(
    user?.role === 'ADMIN' ? 'Hệ Thống Trưởng (System Lead)' : user?.role === 'MANAGER' ? 'Trưởng Nhóm Dự Án (Project Lead)' : 'Kỹ Sư Phát Triển (Software Engineer)'
  );
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');

  // Password Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // 2FA Simulation State
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  useEffect(() => {
    setName(user?.name || '');
    setAvatarPreview(user?.avatar || '');
  }, [user]);

  // Password Strength Calculation
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: 'Chưa nhập', color: 'bg-slate-200' };
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 10) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 2) return { score: 25, label: 'Yếu', color: 'bg-rose-500' };
    if (score === 3) return { score: 50, label: 'Trung bình', color: 'bg-amber-500' };
    if (score === 4) return { score: 75, label: 'Mạnh', color: 'bg-indigo-500' };
    return { score: 100, label: 'Rất mạnh', color: 'bg-emerald-500' };
  }, [newPassword]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Vui lòng nhập họ và tên.');
      return;
    }

    try {
      await updateProfile({ name: trimmedName, avatar: avatarPreview || undefined });
      toast.success('Đã cập nhật thông tin hồ sơ cá nhân thành công!');
    } catch {
      toast.error('Không thể cập nhật hồ sơ. Vui lòng thử lại.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (oldPassword === newPassword) {
      toast.error('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    try {
      setIsChangingPass(true);
      await authService.changePassword({ oldPassword, newPassword });
      toast.success('Đổi mật khẩu tài khoản thành công!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Đổi mật khẩu thất bại.');
    } finally {
      setIsChangingPass(false);
    }
  };

  // Avatar Selectors
  const handleSelectPredefinedAvatar = (url: string) => {
    setAvatarPreview(url);
  };

  const initials = user?.name?.trim().charAt(0).toUpperCase() || 'U';
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('vi-VN', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 transition-colors duration-200 dark:bg-slate-950 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30 inline-flex items-center gap-1.5 shadow-sm">
              <UserRound className="w-4 h-4 text-indigo-500" />
              Tài Khoản & Cài Đặt Hồ Sơ
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Personal Account & Security Management
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hồ Sơ Cá Nhân Của Bạn
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý thông tin định danh, thiết lập bảo mật 2 lớp và theo dõi các mốc huy hiệu đạt được.
          </p>
        </div>
      </header>

      {/* Hero Overview Card */}
      <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-5">
          {/* Avatar Preview */}
          <div className="relative group shrink-0">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-3xl font-black text-white shadow-lg shadow-indigo-500/20">
              {avatarPreview ? (
                <img src={avatarPreview} alt={user?.name} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-white dark:bg-slate-800 text-indigo-600 border border-slate-200 dark:border-slate-700 shadow-md cursor-pointer hover:scale-110 transition"
              title="Đổi ảnh đại diện"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold text-slate-900 dark:text-white">
              {user?.name || 'Thành viên Doanh nghiệp'}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {user?.email || 'Chưa thiết lập email'}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                <BadgeCheck className="h-4 w-4" />
                {roleLabels[user?.role || ''] || user?.role || 'Thành viên'}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-400" />
                {user?.department?.name || 'Phòng ban chung'}
              </span>
              {joinedDate && (
                <>
                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    Tham gia từ {joinedDate}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="h-4 w-4" />
          <span>Tài Khoản Hoạt Động</span>
        </div>
      </section>

      {/* Tabs Navigation */}
      <nav className="flex p-1.5 rounded-3xl bg-slate-200/70 border border-slate-300/80 dark:bg-slate-900/90 dark:border-slate-800 max-w-xl backdrop-blur-xl shadow-inner gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <UserRound className="w-4 h-4" />
          <span>Thông Tin Cá Nhân</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Bảo Mật & Mật Khẩu</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('badges')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
            activeTab === 'badges'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Thành Tích & Huy Hiệu</span>
        </button>
      </nav>

      {/* Tab Panels */}
      {activeTab === 'profile' && (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl max-w-3xl space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Cập Nhật Hồ Sơ Chuyên Môn
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Thông tin này sẽ được hiển thị trên các bảng dự án và danh mục nhân sự phòng ban.
            </p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-5">
            {/* Avatar Selector Gallery */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Chọn ảnh đại diện xem trước (Avatar Preview)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {[
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
                  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
                ].map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectPredefinedAvatar(url)}
                    className={`h-11 w-11 rounded-2xl overflow-hidden border-2 transition cursor-pointer hover:scale-105 ${
                      avatarPreview === url
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Avatar option ${i}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Họ và tên *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập họ và tên..."
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chức danh chuyên môn
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Senior Frontend Engineer"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại liên lạc
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0987 654 321"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email tài khoản (Hệ thống cấp)
              </label>
              <input
                type="email"
                readOnly
                value={user?.email || ''}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'security' && (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl max-w-3xl space-y-8">
          {/* Change Password */}
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-500" />
              Đổi Mật Khẩu Đăng Nhập
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sử dụng mật khẩu mạnh kết hợp chữ hoa, chữ số và ký tự đặc biệt để bảo vệ tài khoản.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mật khẩu hiện tại *
                </label>
                <div className="relative">
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mật khẩu mới * (Tối thiểu 6 ký tự)
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="mt-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Độ mạnh mật khẩu:</span>
                      <strong className={`font-bold ${passwordStrength.score >= 75 ? 'text-emerald-500' : passwordStrength.score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {passwordStrength.label}
                      </strong>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.score}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Xác nhận lại mật khẩu mới *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition cursor-pointer disabled:opacity-60"
                >
                  {isChangingPass ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
                </button>
              </div>
            </form>
          </div>

          {/* 2FA Simulation */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  Xác Thực Hai Yếu Tố (2FA Simulation)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tăng cường bảo vệ tài khoản bằng mã bảo mật 6 số từ ứng dụng Google Authenticator.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !is2FAEnabled;
                  setIs2FAEnabled(next);
                  toast.success(next ? 'Đã kích hoạt bảo mật 2FA!' : 'Đã tắt bảo mật 2FA.');
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  is2FAEnabled
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {is2FAEnabled ? 'Đang Bật' : 'Đang Tắt'}
              </button>
            </div>

            {is2FAEnabled && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-900">
                  <QrCode className="w-16 h-16" />
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">
                    Quét mã QR bằng ứng dụng Authenticator
                  </p>
                  <p className="text-slate-500">
                    Khóa bí mật dự phòng: <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">TASKFLOW-2FA-SECURE-KEY</code>
                  </p>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block pt-1">
                    ✓ Chế độ bảo mật cấp doanh nghiệp đã sẵn sàng.
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'badges' && (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-xl max-w-4xl space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Thành Tích & Huy Hiệu Đóng Góp (Badges & Milestones)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ghi nhận các cống hiến thực tế của bạn trong quá trình thực hiện dự án và đánh giá KPI.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Chuyên Gia Đúng Hạn',
                desc: 'Hoàn thành trên 90% tasks đúng deadline liên tục 3 kỳ.',
                icon: '🎯',
                badge: 'On-time Pro',
                color: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300',
              },
              {
                title: 'Task Master',
                desc: 'Đóng góp hoàn thành số lượng lớn công việc cho bảng Kanban.',
                icon: '⚡',
                badge: 'Productive',
                color: 'border-blue-200 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300',
              },
              {
                title: 'Top KPI Performer',
                desc: 'Đạt xếp loại Hạng A/S trong các kỳ đánh giá hiệu suất nhân sự.',
                icon: '🏆',
                badge: 'Top Tier',
                color: 'border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300',
              },
              {
                title: 'AI Pioneer',
                desc: 'Tích cực ứng dụng trợ lý Gemini AI để bóc tách yêu cầu dự án.',
                icon: '🤖',
                badge: 'Tech Savvy',
                color: 'border-purple-200 dark:border-purple-500/30 bg-purple-50/40 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300',
              },
              {
                title: 'Team Champion',
                desc: 'Phối hợp nhịp nhàng, gắn kết chặt chẽ các thành viên trong nhóm.',
                icon: '🤝',
                badge: 'Collaborative',
                color: 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300',
              },
              {
                title: 'Sprint Finisher',
                desc: 'Dứt điểm toàn bộ các task quan trọng trước thời hạn bàn giao.',
                icon: '🏁',
                badge: 'Goal Driven',
                color: 'border-pink-200 dark:border-pink-500/30 bg-pink-50/40 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300',
              },
            ].map((b, i) => (
              <div
                key={i}
                className={`p-5 rounded-3xl border ${b.color} shadow-sm transition hover:-translate-y-1 hover:shadow-md flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{b.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
                      {b.badge}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                    {b.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {b.desc}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/50 mt-4 flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Đã Đạt Được</span>
                  <Check className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProfilePage;

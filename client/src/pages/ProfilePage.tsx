import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import authService from '@/services/authService';
import { toast } from 'sonner';

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  EMPLOYEE: 'Nhân viên',
};

const fieldClassName =
  'w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/10';

export const ProfilePage: React.FC = () => {
  const { user, updateProfile, isLoading } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.warning('Vui lòng nhập họ và tên.');
      return;
    }
    if (trimmedName === user?.name) {
      toast.info('Thông tin của bạn chưa có thay đổi.');
      return;
    }

    try {
      await updateProfile({ name: trimmedName });
    } catch {
      // useAuth already reports profile update errors to the user.
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.warning('Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (oldPassword === newPassword) {
      toast.warning('Mật khẩu mới cần khác mật khẩu hiện tại.');
      return;
    }

    try {
      setIsChangingPass(true);
      await authService.changePassword({ oldPassword, newPassword });
      toast.success('Đổi mật khẩu thành công!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Đổi mật khẩu thất bại.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const initials = user?.name?.trim().charAt(0).toUpperCase() || 'U';
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('vi-VN', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <main className="min-h-screen bg-[#0b0f19] p-4 text-slate-100 md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-7 pb-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-400">
          Tài khoản & cài đặt
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Hồ sơ của tôi
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Quản lý thông tin cá nhân và cách bạn đăng nhập vào TaskFlow.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-600 text-2xl font-bold text-white">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">
              {user?.name || 'Thành viên TaskFlow'}
            </h2>
            <p className="mt-1 truncate text-sm text-slate-400">
              {user?.email || 'Chưa có email'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-indigo-500" />
                {roleLabels[user?.role || ''] || user?.role || 'Thành viên'}
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" />
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {user?.department?.name || 'Chưa phân bổ'}
              </span>
              {joinedDate && (
                <>
                  <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" />
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Từ {joinedDate}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          Đang hoạt động
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-sm">
        <div className="border-b border-slate-800 px-4 sm:px-6">
          <div className="flex gap-6" role="tablist" aria-label="Cài đặt hồ sơ">
            <button
              id="profile-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === 'profile'}
              aria-controls="profile-panel"
              onClick={() => setActiveTab('profile')}
              className={`relative inline-flex items-center gap-2 py-4 text-sm font-medium transition ${
                activeTab === 'profile'
                  ? 'text-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserRound className="h-4 w-4" />
              Thông tin cá nhân
              {activeTab === 'profile' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-indigo-400" />}
            </button>
            <button
              id="security-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === 'security'}
              aria-controls="security-panel"
              onClick={() => setActiveTab('security')}
              className={`relative inline-flex items-center gap-2 py-4 text-sm font-medium transition ${
                activeTab === 'security'
                  ? 'text-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              Bảo mật
              {activeTab === 'security' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-indigo-400" />}
            </button>
          </div>
        </div>

        {activeTab === 'profile' ? (
          <div id="profile-panel" role="tabpanel" aria-labelledby="profile-tab" className="max-w-2xl p-5 sm:p-7">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-white">Thông tin cơ bản</h3>
              <p className="mt-1 text-sm text-slate-400">
                Tên của bạn sẽ được hiển thị với đồng nghiệp trong TaskFlow.
              </p>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div>
                <label htmlFor="profile-name" className="mb-2 block text-sm font-medium text-slate-300">
                  Họ và tên
                </label>
                <input
                  id="profile-name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập họ và tên"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="profile-email" className="mb-2 block text-sm font-medium text-slate-300">
                  Email đăng nhập
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  className={`${fieldClassName} cursor-not-allowed text-slate-400`}
                />
                <p className="mt-2 text-xs text-slate-400">Email được quản lý bởi hệ thống và không thể thay đổi.</p>
              </div>
              <div className="flex justify-end border-t border-slate-800 pt-5">
                <button
                  type="submit"
                  disabled={isLoading || !name.trim() || name.trim() === user?.name}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div id="security-panel" role="tabpanel" aria-labelledby="security-tab" className="max-w-2xl p-5 sm:p-7">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-white">Đổi mật khẩu</h3>
              <p className="mt-1 text-sm text-slate-400">
                Chọn mật khẩu mạnh và không sử dụng lại mật khẩu từ dịch vụ khác.
              </p>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label htmlFor="old-password" className="mb-2 block text-sm font-medium text-slate-300">
                  Mật khẩu hiện tại
                </label>
                <input
                  id="old-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-300">
                  Mật khẩu mới
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-300">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className={fieldClassName}
                />
              </div>
              <div className="flex justify-end border-t border-slate-800 pt-5">
                <button
                  type="submit"
                  disabled={isChangingPass || !oldPassword || !newPassword || !confirmPassword}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LockKeyhole className="h-4 w-4" />
                  {isChangingPass ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
      </div>
    </main>
  );
};

export default ProfilePage;

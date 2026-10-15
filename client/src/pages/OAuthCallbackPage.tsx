import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppDispatch } from '@/store';
import { setCredentials } from '@/store';
import authService from '@/services/authService';

export const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const oauthParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = oauthParams.get('accessToken');
    const refreshToken = oauthParams.get('refreshToken');

    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    if (!accessToken || !refreshToken) {
      toast.error('Đăng nhập Google không thành công.');
      navigate('/login', { replace: true });
      return;
    }

    let cancelled = false;

    const completeLogin = async () => {
      try {
        const response = await authService.getMe(accessToken);
        if (cancelled) return;

        dispatch(setCredentials({
          user: response.data,
          accessToken,
          refreshToken,
        }));
        navigate(
          response.data.role === 'ADMIN'
            ? '/admin'
            : response.data.role === 'MANAGER'
            ? '/manager'
            : '/my-work',
          { replace: true }
        );
      } catch {
        if (cancelled) return;
        toast.error('Không thể hoàn tất phiên đăng nhập Google.');
        navigate('/login', { replace: true });
      }
    };

    void completeLogin();
    return () => {
      cancelled = true;
    };
  }, [dispatch, navigate]);

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-[#0b0f19] text-sm text-slate-300">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-4 shadow-xl backdrop-blur-xl">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        Đang hoàn tất đăng nhập...
      </div>
    </main>
  );
};

export default OAuthCallbackPage;

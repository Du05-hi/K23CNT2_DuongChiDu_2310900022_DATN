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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-400" />
        Đang hoàn tất đăng nhập...
      </div>
    </main>
  );
};

export default OAuthCallbackPage;

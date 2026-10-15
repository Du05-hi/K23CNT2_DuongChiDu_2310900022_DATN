import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector, setCredentials, logout as logoutAction, setLoading, updateUser } from '@/store';
import authService, { type LoginRequest, type UpdateProfileRequest } from '@/services/authService';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const isLoading = useAppSelector((state) => state.auth.isLoading);

  /**
   * Lấy thông tin user hiện tại từ API và cập nhật Store
   */
  const fetchCurrentUser = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      const response = await authService.getMe();
      if (response && response.data) {
        dispatch(updateUser(response.data));
        return response.data;
      }
    } catch (error) {
      console.error('Lỗi khi tải thông tin người dùng:', error);
      dispatch(logoutAction());
    } finally {
      dispatch(setLoading(false));
    }
    return null;
  }, [dispatch]);

  /**
   * Đăng nhập thông qua Email & Password
   */
  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        dispatch(setLoading(true));
        const res = await authService.login(credentials);
        if (res.data) {
          const { user: loggedInUser, accessToken, refreshToken } = res.data;
          localStorage.setItem('refreshToken', refreshToken);
          dispatch(setCredentials({ user: loggedInUser, accessToken }));
          toast.success(`Chào mừng trở lại, ${loggedInUser.name}!`);
          navigate(
            loggedInUser.role === 'ADMIN'
              ? '/admin'
              : loggedInUser.role === 'MANAGER'
              ? '/manager'
              : '/my-work'
          );
          return res.data;
        }
      } catch (error: any) {
        const errorMsg = error?.response?.data?.message || 'Đăng nhập không thành công. Vui lòng thử lại!';
        toast.error(errorMsg);
        throw error;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch, navigate]
  );

  /**
   * Đăng xuất khỏi hệ thống
   */
  const logout = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      await authService.logout();
    } catch (error) {
      console.warn('Lỗi khi đăng xuất:', error);
    } finally {
      dispatch(logoutAction());
      dispatch(setLoading(false));
      toast.info('Bạn đã đăng xuất khỏi hệ thống');
      navigate('/login');
    }
  }, [dispatch, navigate]);

  /**
   * Cập nhật thông tin tài khoản
   */
  const updateProfile = useCallback(
    async (data: UpdateProfileRequest) => {
      try {
        dispatch(setLoading(true));
        const res = await authService.updateProfile(data);
        if (res.data) {
          dispatch(updateUser(res.data));
          toast.success('Cập nhật thông tin thành công!');
          return res.data;
        }
      } catch (error: any) {
        const errorMsg = error?.response?.data?.message || 'Cập nhật thông tin thất bại!';
        toast.error(errorMsg);
        throw error;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    fetchCurrentUser,
    updateProfile,
  };
};

export default useAuth;

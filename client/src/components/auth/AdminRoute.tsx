import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppSelector } from '@/store';

interface AdminRouteProps {
  children?: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'ADMIN') {
    toast.error('Bạn không có quyền truy cập vào trang Quản trị viên');
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default AdminRoute;

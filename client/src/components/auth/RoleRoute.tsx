import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store';
import type { Role } from '@/types';

const homeByRole: Record<Role, string> = {
  ADMIN: '/admin',
  MANAGER: '/manager',
  EMPLOYEE: '/my-work',
};

interface RoleRouteProps {
  role: Role;
  children?: React.ReactNode;
}

const RoleRoute: React.FC<RoleRouteProps> = ({ role, children }) => {
  const user = useAppSelector((state) => state.auth.user);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeByRole[user.role]} replace />;

  return children ? <>{children}</> : <Outlet />;
};

export default RoleRoute;

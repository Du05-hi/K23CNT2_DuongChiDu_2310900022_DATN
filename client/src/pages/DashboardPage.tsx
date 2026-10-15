import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const homePath = user?.role === 'ADMIN'
    ? '/admin'
    : user?.role === 'MANAGER'
    ? '/manager'
    : '/my-work';

  return <Navigate to={homePath} replace />;
};

export default DashboardPage;

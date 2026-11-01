import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../controllers/session';
import type { User } from '../../models/types';

interface RequireRoleProps {
  allowedRoles: NonNullable<User['role']>[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const RequireRole = ({ 
  allowedRoles, 
  children, 
  fallback 
}: RequireRoleProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="text-center">Chargement...</p>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!user.role || !allowedRoles.includes(user.role)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
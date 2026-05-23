import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  PROVIDER_DASHBOARD_PATH,
  PROVIDER_KYC_PATH,
  PROVIDER_REVIEW_PATH,
  getStoredNearMeUser,
  isProviderUnderReview,
  needsProviderKyc,
} from '@/lib/providerAccess';

const unrestrictedPaths = new Set([
  '/login',
  '/signup',
  '/provider-kyc',
  '/provider-review',
]);

export default function ProviderAccessGate({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(() => getStoredNearMeUser());

  useEffect(() => {
    const syncUser = () => setUser(getStoredNearMeUser());

    syncUser();
    window.addEventListener('storage', syncUser);
    window.addEventListener('nearme:user-updated', syncUser);

    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('nearme:user-updated', syncUser);
    };
  }, [location.pathname]);

  if (needsProviderKyc(user) && !unrestrictedPaths.has(location.pathname)) {
    return <Navigate to={PROVIDER_KYC_PATH} replace state={{ from: location.pathname }} />;
  }

  if (isProviderUnderReview(user) && !unrestrictedPaths.has(location.pathname)) {
    return <Navigate to={PROVIDER_REVIEW_PATH} replace state={{ from: location.pathname }} />;
  }

  if (isProviderUnderReview(user) && location.pathname === PROVIDER_DASHBOARD_PATH) {
    return <Navigate to={PROVIDER_REVIEW_PATH} replace />;
  }

  if (user?.role === 'provider' && location.pathname === '/') {
    if (needsProviderKyc(user)) {
      return <Navigate to={PROVIDER_KYC_PATH} replace />;
    }

    if (isProviderUnderReview(user)) {
      return <Navigate to={PROVIDER_REVIEW_PATH} replace />;
    }

    if (user.providerStatus === 'approved') {
      return <Navigate to={PROVIDER_DASHBOARD_PATH} replace />;
    }
  }

  return children;
}

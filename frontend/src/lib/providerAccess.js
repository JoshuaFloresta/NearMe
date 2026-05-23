export const PROVIDER_DASHBOARD_PATH = '/provider-dashboard';
export const PROVIDER_KYC_PATH = '/provider-kyc';
export const PROVIDER_REVIEW_PATH = '/provider-review';

export const getStoredNearMeUser = () => {
  try {
    return JSON.parse(localStorage.getItem('nearme_user'));
  } catch {
    return null;
  }
};

export const isProvider = (user) => user?.role === 'provider';

export const normalizeRole = (role = '') => role.toString().trim().toLowerCase().replace(/\s+/g, '_');

export const isAdminUser = (user) => ['admin', 'super_admin'].includes(normalizeRole(user?.role));

export const needsProviderKyc = (user) => (
  isProvider(user) && ['kyc_required', 'rejected', 'resubmission_required'].includes(user.providerStatus || 'kyc_required')
);

export const canAccessProviderDashboard = (user) => (
  isProvider(user) && user.providerStatus === 'approved'
);

export const isProviderUnderReview = (user) => (
  isProvider(user) && user.providerStatus === 'kyc_submitted'
);

export const mergeStoredNearMeUser = (patch) => {
  const current = getStoredNearMeUser();
  const next = { ...(current || {}), ...patch };
  localStorage.setItem('nearme_user', JSON.stringify(next));
  window.dispatchEvent(new Event('nearme:user-updated'));
  return next;
};

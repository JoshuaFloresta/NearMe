import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, MapPin, Bell, Settings, LogOut, ShieldCheck, LayoutDashboard, Briefcase } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PROVIDER_DASHBOARD_PATH,
  PROVIDER_KYC_PATH,
  PROVIDER_REVIEW_PATH,
  canAccessProviderDashboard,
  isProviderUnderReview,
} from '@/lib/providerAccess';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket';

const navLinks = [
  { label: 'Find Services', href: '/browse' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'About', href: '/about' },
];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('nearme_user'));
  } catch {
    return null;
  }
};

export default function NearMeNav({ user: userProp, onLogout }) {
  const [open, setOpen] = useState(false);
  const [storedUser, setStoredUser] = useState(() => userProp || getStoredUser());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const user = userProp || storedUser;
  const userId = String(user?.id || user?._id || '').trim();
  const isAdminPage = location.pathname === '/admin';
  const isProviderOrAdmin = user?.role === 'provider' || user?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    const syncUser = () => setStoredUser(getStoredUser());

    syncUser();
    window.addEventListener('storage', syncUser);
    window.addEventListener('nearme:user-updated', syncUser);

    const stored = getStoredUser();
    if (stored?.id && !userProp) {
      apiRequest(`/api/auth/users/${stored.id}`)
        .then((response) => {
          if (cancelled || !response?.user) return;
          localStorage.setItem('nearme_user', JSON.stringify(response.user));
          setStoredUser(response.user);
        })
        .catch(() => {
          // Keep the cached user if the backend is unavailable.
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('nearme:user-updated', syncUser);
    };
  }, [location.pathname, userProp]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    try {
      const key = `nearme_notifications_${userId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      setNotifications(Array.isArray(stored) ? stored : []);
    } catch {
      setNotifications([]);
    }
  }, [userId, user?.role]);

  useEffect(() => {
    if (!userId) return undefined;
    const socket = getSocket();
    socket.emit('join:user', userId);
    socket.emit('join:role', user.role || 'customer');

    const pushNotification = (notification) => {
      setNotifications((current) => {
        const next = [notification, ...current].slice(0, 30);
        const key = `nearme_notifications_${userId}`;
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    };

    const onPendingPayment = (job) => {
      if (String(job?.clientUserId || '') !== userId) return;
      pushNotification({
        id: `pending-payment-${job?._id}-${Date.now()}`,
        type: 'pending_payment',
        title: 'Payment Required',
        message: `Provider marked job ${job?.jobNumber || ''} as done. Please proceed with payment.`,
        route: job?._id ? `/pay/${job._id}` : '/messages',
        createdAt: new Date().toISOString(),
        read: false,
      });
    };
    const onJobAccepted = (job) => {
      if (![String(job?.clientUserId || ''), String(job?.providerUserId || '')].includes(userId)) return;
      pushNotification({
        id: `job-accepted-${job?._id}-${Date.now()}`,
        type: 'job_accepted',
        title: 'Job Accepted',
        message: `Job ${job?.jobNumber || ''} has been accepted.`,
        route: '/messages',
        createdAt: new Date().toISOString(),
        read: false,
      });
    };
    const onJobStarted = (job) => {
      if (![String(job?.clientUserId || ''), String(job?.providerUserId || '')].includes(userId)) return;
      pushNotification({
        id: `job-started-${job?._id}-${Date.now()}`,
        type: 'job_started',
        title: 'Job In Progress',
        message: `Job ${job?.jobNumber || ''} is now in progress.`,
        route: '/messages',
        createdAt: new Date().toISOString(),
        read: false,
      });
    };
    const onVerificationPending = (payload) => {
      const isProvider = String(payload?.providerUserId || '') === userId;
      const isAdmin = String(user.role || '').toLowerCase().includes('admin');
      if (!isProvider && !isAdmin) return;
      pushNotification({
        id: `verify-pending-${payload?.jobId}-${Date.now()}`,
        type: 'verify_pending',
        title: 'Payment Verification Needed',
        message: payload?.message || 'A payment proof needs verification.',
        route: '/provider-dashboard',
        createdAt: new Date().toISOString(),
        read: false,
      });
    };
    const onJobCompleted = (job) => {
      if (![String(job?.clientUserId || ''), String(job?.providerUserId || '')].includes(userId) && !String(user.role || '').toLowerCase().includes('admin')) return;
      pushNotification({
        id: `job-completed-${job?._id}-${Date.now()}`,
        type: 'job_completed',
        title: 'Job Completed',
        message: `Job ${job?.jobNumber || ''} has been completed.`,
        route: '/messages',
        createdAt: new Date().toISOString(),
        read: false,
      });
    };
    const onJobDisputed = (job) => {
      if (![String(job?.clientUserId || ''), String(job?.providerUserId || '')].includes(userId) && !String(user.role || '').toLowerCase().includes('admin')) return;
      pushNotification({
        id: `job-disputed-${job?._id}-${Date.now()}`,
        type: 'job_disputed',
        title: 'Job Disputed',
        message: `A dispute was opened for job ${job?.jobNumber || ''}.`,
        route: '/messages',
        createdAt: new Date().toISOString(),
        read: false,
      });
    };

    socket.on('job:pending-payment', onPendingPayment);
    socket.on('job:accepted', onJobAccepted);
    socket.on('job:started', onJobStarted);
    socket.on('job:payment-verification-pending', onVerificationPending);
    socket.on('job:completed', onJobCompleted);
    socket.on('job:disputed', onJobDisputed);
    return () => {
      socket.off('job:pending-payment', onPendingPayment);
      socket.off('job:accepted', onJobAccepted);
      socket.off('job:started', onJobStarted);
      socket.off('job:payment-verification-pending', onVerificationPending);
      socket.off('job:completed', onJobCompleted);
      socket.off('job:disputed', onJobDisputed);
    };
  }, [userId, user?.role]);

  const logout = () => {
    localStorage.removeItem('nearme_user');
    localStorage.removeItem('nearme_token');
    setStoredUser(null);
    setOpen(false);
    onLogout?.();
    window.dispatchEvent(new Event('nearme:user-updated'));
    navigate('/');
  };

  const unreadCount = notifications.filter((item) => !item.read).length;
  const markAllRead = () => {
    if (!userId) return;
    const next = notifications.map((item) => ({ ...item, read: true }));
    localStorage.setItem(`nearme_notifications_${userId}`, JSON.stringify(next));
    setNotifications(next);
  };
  const openNotification = (item) => {
    if (!userId) return;
    const next = notifications.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry));
    localStorage.setItem(`nearme_notifications_${userId}`, JSON.stringify(next));
    setNotifications(next);
    setShowNotifications(false);
    navigate(item.route || '/messages');
  };

  const initials = user?.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
  const providerHomePath = canAccessProviderDashboard(user)
    ? PROVIDER_DASHBOARD_PATH
    : isProviderUnderReview(user)
    ? PROVIDER_REVIEW_PATH
    : PROVIDER_KYC_PATH;
  const providerHomeLabel = canAccessProviderDashboard(user)
    ? 'Provider Dashboard'
    : isProviderUnderReview(user)
    ? 'Application Review'
    : 'Provider KYC';

  return (
    <nav className="bg-white border-b-4 border-bauhaus-ink sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-bauhaus-red border-2 border-bauhaus-ink flex items-center justify-center shadow-bauhaus-sm transition-all duration-200 group-hover:-translate-y-0.5">
              <MapPin className="h-4 w-4 text-white" strokeWidth={3} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-lg uppercase tracking-tighter text-bauhaus-ink">Near Me</span>
              <span className="font-bold text-[9px] uppercase tracking-widest text-bauhaus-red">Reliable Help, Made Easy</span>
            </div>
          </Link>

          {!isAdminPage && !isProviderOrAdmin && (
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`px-4 py-2 font-bold uppercase text-xs tracking-wider transition-colors duration-200 ${
                  location.pathname === link.href ? 'text-bauhaus-red' : 'text-bauhaus-ink hover:text-bauhaus-red'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          )}

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <button onClick={() => setShowNotifications((current) => !current)} className="p-2 border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors relative">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-bauhaus-red rounded-full text-white text-[9px] font-black flex items-center justify-center">{unreadCount}</span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-24 top-16 z-[60] w-80 border-2 border-bauhaus-ink bg-white shadow-bauhaus-sm">
                    <div className="flex items-center justify-between px-3 py-2 border-b-2 border-bauhaus-ink bg-bauhaus-canvas">
                      <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink">Notifications</div>
                      <button type="button" onClick={markAllRead} className="font-black text-[9px] uppercase tracking-wider text-bauhaus-blue">Mark all read</button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 && (
                        <div className="px-3 py-4 font-bold text-xs text-bauhaus-ink/50">No notifications yet</div>
                      )}
                      {notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openNotification(item)}
                          className={`w-full text-left px-3 py-3 border-b border-bauhaus-ink/20 hover:bg-bauhaus-canvas ${item.read ? 'bg-white' : 'bg-bauhaus-yellow/20'}`}
                        >
                          <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink">{item.title}</div>
                          <div className="mt-1 font-medium text-xs text-bauhaus-ink/70">{item.message}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center p-1.5 hover:bg-bauhaus-canvas transition-colors rounded-full">
                      <span className="w-8 h-8 rounded-full bg-bauhaus-yellow flex items-center justify-center overflow-hidden">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name || 'Profile'} className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-black text-[10px] text-bauhaus-ink">{initials}</span>
                        )}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 border-2 border-bauhaus-ink bg-white p-1 shadow-bauhaus-sm rounded-none">
                    {!isProviderOrAdmin && (
                      <>
                        <DropdownMenuLabel className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">
                          {user.name || 'My Account'}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-bauhaus-ink/20" />
                        <DropdownMenuItem asChild className="cursor-pointer rounded-none font-bold text-xs uppercase tracking-wider focus:bg-bauhaus-canvas">
                          <Link to="/settings" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Settings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer rounded-none font-bold text-xs uppercase tracking-wider focus:bg-bauhaus-canvas">
                          <Link to="/my-orders" className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            My Order
                          </Link>
                        </DropdownMenuItem>
                        {user.role === 'provider' && (
                          <DropdownMenuItem asChild className="cursor-pointer rounded-none font-bold text-xs uppercase tracking-wider focus:bg-bauhaus-canvas">
                            <Link to={providerHomePath} className="flex items-center gap-2">
                              {canAccessProviderDashboard(user) ? <LayoutDashboard className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                              {providerHomeLabel}
                            </Link>
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-none font-bold text-xs uppercase tracking-wider text-bauhaus-red focus:bg-bauhaus-canvas focus:text-bauhaus-red">
                      <LogOut className="h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link to="/login" className="px-5 py-2 font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-all duration-200 active:translate-x-[1px] active:translate-y-[1px]">
                  Log In
                </Link>
                <Link to="/signup" className="px-5 py-2 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 border-2 border-bauhaus-ink shadow-bauhaus-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t-4 border-bauhaus-ink bg-white">
          {!isAdminPage && !isProviderOrAdmin && navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              onClick={() => setOpen(false)}
              className="block px-6 py-4 font-bold uppercase text-sm tracking-wider text-bauhaus-ink border-b-2 border-bauhaus-ink hover:bg-bauhaus-yellow/20 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <div className="p-4 space-y-3">
              <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 px-4 py-3 font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              {user.role === 'provider' && (
                <Link to={providerHomePath} onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 px-4 py-3 font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors">
                  {canAccessProviderDashboard(user) ? <LayoutDashboard className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {providerHomeLabel}
                </Link>
              )}
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-3 p-4">
              <Link to="/login" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-3 font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors">
                Log In
              </Link>
              <Link to="/signup" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-3 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

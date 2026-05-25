import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import {
  AlertTriangle,
  Archive,
  Banknote,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  Eye,
  FileText,
  ImagePlus,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Plus,
  MessageSquareWarning,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  Server,
  ShieldCheck,
  Star,
  Tags,
  UserCog,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import { apiRequest, getStoredToken } from '../lib/api';
import { getStoredNearMeUser, isAdminUser, normalizeRole } from '../lib/providerAccess';

const adminModules = [
  { id: 'analytics', label: 'Dashboard Analytics', icon: LayoutDashboard },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'verification', label: 'Provider Verification', icon: ClipboardCheck },
  { id: 'provider-profiles', label: 'Provider Profiles', icon: UserCog },
  { id: 'archive', label: 'Archive & Recovery', icon: Archive },
  { id: 'reports', label: 'Reports Management', icon: MessageSquareWarning },
  { id: 'bookings', label: 'Booking Management', icon: CalendarClock },
  { id: 'transactions', label: 'Transaction Monitoring', icon: ReceiptText },
  { id: 'payouts', label: 'Payout Requests', icon: Banknote },
  { id: 'reviews', label: 'Review Moderation', icon: Star },
  { id: 'categories', label: 'Service Categories', icon: Tags },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'logs', label: 'System Logs', icon: Server },
  { id: 'earnings', label: 'Earnings Analytics', icon: Banknote },
  { id: 'map', label: 'Map Monitoring', icon: MapPin },
  { id: 'cms', label: 'CMS', icon: BookOpen },
];

const emptyUserForm = {
  fname: '',
  lname: '',
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'customer',
  status: 'active',
  avatar: '',
};

const roleOptions = ['customer', 'provider', 'admin', 'super_admin'];
const statusOptions = ['active', 'suspended', 'disabled'];

const cmsItems = ['FAQs', 'Privacy Policy', 'Terms of Service', 'Promotional Banners'];

const mapCenter = { lat: 14.5995, lng: 120.9842 };
const listToText = (value) => (Array.isArray(value) ? value.join(', ') : '');
const textToList = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const hasProviderCoordinates = (provider) => (
  Number.isFinite(Number(provider?.coordinates?.lat)) && Number.isFinite(Number(provider?.coordinates?.lng))
);
const emptyProviderForm = {
  name: '',
  service: '',
  serviceId: 'other',
  rate: 0,
  location: '',
  serviceArea: '',
  bio: '',
  tags: '',
  certifications: '',
  gallery: '',
  avatar: '',
};

function StatCard({ stat }) {
  return (
    <div className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-sm p-4 min-h-32">
      <div className={`w-10 h-10 ${stat.color} border-2 border-bauhaus-ink`} />
      <div className="mt-4 font-black text-2xl uppercase tracking-tight text-bauhaus-ink">{stat.value}</div>
      <div className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/45">{stat.label}</div>
      <div className="mt-2 font-black text-[10px] uppercase tracking-wider text-bauhaus-blue">{stat.change}</div>
    </div>
  );
}

function Section({ id, title, icon: Icon, children, action }) {
  return (
    <section id={id} className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-sm scroll-mt-24">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-4 border-bauhaus-ink bg-bauhaus-canvas">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-bauhaus-red shrink-0" />
          <h2 className="font-black text-sm uppercase tracking-tight text-bauhaus-ink truncate">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatusBadge({ children, tone = 'blue' }) {
  const tones = {
    blue: 'bg-bauhaus-blue text-white',
    red: 'bg-bauhaus-red text-white',
    yellow: 'bg-bauhaus-yellow text-bauhaus-ink',
    ink: 'bg-bauhaus-ink text-white',
    canvas: 'bg-bauhaus-canvas text-bauhaus-ink',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

function DataTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="bg-bauhaus-ink text-white">
            {headers.map((header) => (
              <th key={header} className="px-3 py-3 border-2 border-bauhaus-ink text-left font-black text-[10px] uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="bg-white">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-3 border-2 border-bauhaus-ink font-bold text-xs text-bauhaus-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniBars({ values }) {
  if (!values.length) {
    return (
      <div className="flex items-center justify-center h-36 border-2 border-dashed border-bauhaus-ink bg-bauhaus-canvas p-3 font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">
        No trend data yet
      </div>
    );
  }
  const max = Math.max(...values);
  return (
    <div className="flex items-end gap-2 h-36 border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
      {values.map((value, index) => (
        <div key={`${value}-${index}`} className="flex-1 flex flex-col justify-end gap-2">
          <div
            className={`${index % 3 === 0 ? 'bg-bauhaus-red' : index % 3 === 1 ? 'bg-bauhaus-blue' : 'bg-bauhaus-yellow'} border-2 border-bauhaus-ink`}
            style={{ height: `${Math.max(18, (value / max) * 100)}%` }}
          />
          <span className="font-black text-[9px] text-center text-bauhaus-ink/45">{index + 1}</span>
        </div>
      ))}
    </div>
  );
}

function AdminMap({ providers = [] }) {
  return (
    <div className="h-[430px] border-4 border-bauhaus-ink overflow-hidden bg-white">
      <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={11} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {providers.filter(hasProviderCoordinates).map((provider) => (
          <CircleMarker
            key={provider.id || provider._id}
            center={[Number(provider.coordinates.lat), Number(provider.coordinates.lng)]}
            radius={provider.available ? 10 : 8}
            pathOptions={{
              color: '#121212',
              fillColor: provider.available ? '#F0C020' : '#D02020',
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <div className="min-w-[160px]">
                <strong>{provider.name}</strong>
                <div>{provider.service}</div>
                <div>{provider.available ? 'Available' : 'Offline'}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

const adminHeaders = (user) => ({
  'X-Admin-Role': normalizeRole(user?.role),
  'X-Admin-User-Id': user?.id || '',
});

const formatRole = (role) => normalizeRole(role).replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
};

const statusTone = (status) => {
  if (status === 'suspended' || status === 'disabled') return 'red';
  if (status === 'pending' || status === 'kyc_required') return 'yellow';
  return 'blue';
};

export default function NearMeAdminDashboard() {
  const [currentUser, setCurrentUser] = useState(() => getStoredNearMeUser());
  const [authToken, setAuthToken] = useState(() => getStoredToken());
  const [activeModule, setActiveModule] = useState('analytics');
  const [kycQueue, setKycQueue] = useState([]);
  const [kycLoading, setKycLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState('');
  const [selectedKyc, setSelectedKyc] = useState(null);
  const [search, setSearch] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [adminProviders, setAdminProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState(null);
  const [providerForm, setProviderForm] = useState(emptyProviderForm);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [caseProvider, setCaseProvider] = useState(null);
  const [archivedProviders, setArchivedProviders] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [adminBookings, setAdminBookings] = useState([]);
  const [adminTransactions, setAdminTransactions] = useState([]);
  const [adminPayouts, setAdminPayouts] = useState([]);
  const [payoutReviewingId, setPayoutReviewingId] = useState('');
  const [payoutReviewForm, setPayoutReviewForm] = useState({});
  const [adminReviews, setAdminReviews] = useState([]);
  const [adminServices, setAdminServices] = useState([]);
  const [archivedServices, setArchivedServices] = useState([]);
  const [adminReports, setAdminReports] = useState([]);
  const [updatingReportId, setUpdatingReportId] = useState('');
  const [reportNotes, setReportNotes] = useState({});
  const [adminLogs, setAdminLogs] = useState([]);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmingAction, setConfirmingAction] = useState(false);

  useEffect(() => {
    const syncUser = () => {
      setCurrentUser(getStoredNearMeUser());
      setAuthToken(getStoredToken());
    };

    syncUser();
    window.addEventListener('storage', syncUser);
    window.addEventListener('nearme:user-updated', syncUser);

    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('nearme:user-updated', syncUser);
    };
  }, []);

  useEffect(() => {
    if (!isAdminUser(currentUser) || !authToken) return;

    apiRequest('/api/admin/provider-kyc?status=pending')
      .then((data) => {
        const pending = Array.isArray(data) ? data.filter((item) => item.status === 'pending') : [];
        setKycQueue(pending);
        setSelectedKyc((current) => current || pending[0] || null);
      })
      .catch(() => setKycQueue([]))
      .finally(() => setKycLoading(false));
  }, [currentUser, authToken]);

  const loadUsers = async () => {
    if (!isAdminUser(currentUser) || !authToken) return;

    setUsersLoading(true);
    try {
      const data = await apiRequest('/api/auth/admin/users', {
        headers: adminHeaders(currentUser),
      });
      setAdminUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.message || 'Could not load users');
      setAdminUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentUser, authToken]);

  const loadProviders = async () => {
    if (!isAdminUser(currentUser) || !authToken) return;

    setProvidersLoading(true);
    try {
      const data = await apiRequest('/api/admin/providers');
      setAdminProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.message || 'Could not load provider profiles');
      setAdminProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, [currentUser, authToken]);

  const loadArchive = async () => {
    if (!isAdminUser(currentUser) || !authToken) return;
    try {
      const [userData, providerData, serviceData] = await Promise.all([
        apiRequest('/api/auth/admin/users/archived', { headers: adminHeaders(currentUser) }).catch(() => []),
        apiRequest('/api/admin/providers-archive').catch(() => []),
        apiRequest('/api/admin/services-archive').catch(() => []),
      ]);
      setArchivedUsers(Array.isArray(userData) ? userData : []);
      setArchivedProviders(Array.isArray(providerData) ? providerData : []);
      setArchivedServices(Array.isArray(serviceData) ? serviceData : []);
    } catch (error) {
      toast.error(error.message || 'Could not load archived records');
    }
  };

  useEffect(() => {
    loadArchive();
  }, [currentUser, authToken]);

  const loadAdminOperations = async () => {
    if (!isAdminUser(currentUser) || !authToken) return;

    try {
      const [stats, bookingData, transactionData, payoutData, reviewData, serviceData, reportData, logData] = await Promise.all([
        apiRequest('/api/admin/stats').catch(() => null),
        apiRequest('/api/admin/bookings').catch(() => []),
        apiRequest('/api/admin/transactions').catch(() => []),
        apiRequest('/api/admin/payouts').catch(() => []),
        apiRequest('/api/admin/reviews').catch(() => []),
        apiRequest('/api/admin/services').catch(() => []),
        apiRequest('/api/admin/reports').catch(() => []),
        apiRequest('/api/admin/logs').catch(() => []),
      ]);

      setAdminStats(stats);
      setAdminBookings(Array.isArray(bookingData) ? bookingData : []);
      setAdminTransactions(Array.isArray(transactionData) ? transactionData : []);
      setAdminPayouts(Array.isArray(payoutData) ? payoutData : []);
      setAdminReviews(Array.isArray(reviewData) ? reviewData : []);
      setAdminServices(Array.isArray(serviceData) ? serviceData : []);
      setAdminReports(Array.isArray(reportData) ? reportData : []);
      setAdminLogs(Array.isArray(logData) ? logData : []);
    } catch (error) {
      toast.error(error.message || 'Could not load admin operations data');
    }
  };

  useEffect(() => {
    loadAdminOperations();
  }, [currentUser, authToken]);

  const filteredUsers = useMemo(() => adminUsers.filter((user) => (
    [user.name, user.email, user.role, user.status, user.phone].join(' ').toLowerCase().includes(search.toLowerCase())
  )), [adminUsers, search]);

  const filteredProviders = useMemo(() => adminProviders.filter((provider) => (
    [provider.name, provider.service, provider.location, provider.serviceArea, provider.tags?.join(' ')].join(' ').toLowerCase().includes(search.toLowerCase())
  )), [adminProviders, search]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!authToken) return <Navigate to="/login" replace />;
  if (!isAdminUser(currentUser)) return <Navigate to="/" replace />;

  const requestConfirmation = ({ title, message, confirmLabel, onConfirm }) => {
    setConfirmDialog({ title, message, confirmLabel, onConfirm });
  };

  const runConfirmedAction = async () => {
    if (!confirmDialog?.onConfirm) return;
    setConfirmingAction(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmingAction(false);
    }
  };

  const reviewKyc = async (submission, status) => {
    setReviewingId(submission._id);
    try {
      await apiRequest(`/api/admin/provider-kyc/${submission._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewedBy: 'admin', reviewNote: status === 'approved' ? 'Credentials approved' : 'Needs clearer documents' }),
      });

      setKycQueue((current) => {
        const nextQueue = current.filter((item) => item._id !== submission._id);
        setSelectedKyc((currentSelected) => (
          currentSelected?._id === submission._id ? nextQueue[0] || null : currentSelected
        ));
        return nextQueue;
      });
      toast.success(`KYC ${status}`);
    } catch (error) {
      toast.error(error.message || 'Could not review KYC');
    } finally {
      setReviewingId('');
    }
  };

  const startCreateUser = () => {
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setUserModalOpen(true);
  };

  const startEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      fname: user.fname || '',
      lname: user.lname || '',
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role: normalizeRole(user.role || 'customer'),
      status: user.status || 'active',
      avatar: user.avatar || '',
    });
    setUserModalOpen(true);
  };

  const handleUserFormChange = (field, value) => {
    setUserForm((current) => ({ ...current, [field]: value }));
  };

  const handleAdminAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }

    if (file.size > 1024 * 1024) {
      toast.error('Please choose an image under 1 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => handleUserFormChange('avatar', reader.result);
    reader.onerror = () => toast.error('Could not read image');
    reader.readAsDataURL(file);
  };

  const saveUser = async (e, statusChangeConfirmed = false) => {
    e?.preventDefault();

    if (!userForm.name.trim() || !userForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    if (!editingUser && !userForm.password) {
      toast.error('Password is required for new accounts');
      return;
    }

    if (
      editingUser
      && editingUser.status === 'active'
      && ['suspended', 'disabled'].includes(userForm.status)
      && !statusChangeConfirmed
    ) {
      requestConfirmation({
        title: 'Disable User Access?',
        message: `${editingUser.name || 'This user'} will be unable to log in while the selected status is ${userForm.status}.`,
        confirmLabel: 'Save Status Change',
        onConfirm: () => saveUser(null, true),
      });
      return;
    }

    setSavingUser(true);

    try {
      const payload = {
        ...userForm,
        fname: userForm.fname || userForm.name.split(' ')[0] || '',
        lname: userForm.lname || userForm.name.split(' ').slice(1).join(' '),
      };

      if (editingUser && !payload.password) {
        delete payload.password;
      }

      const path = editingUser ? `/api/auth/admin/users/${editingUser.id}` : '/api/auth/admin/users';
      const method = editingUser ? 'PATCH' : 'POST';
      const response = await apiRequest(path, {
        method,
        headers: adminHeaders(currentUser),
        body: JSON.stringify(payload),
      });

      if (editingUser) {
        setAdminUsers((current) => current.map((user) => (user.id === editingUser.id ? response.user : user)));
        toast.success('Account updated');
      } else {
        setAdminUsers((current) => [response.user, ...current]);
        toast.success('Account created');
      }

      setEditingUser(null);
      setUserForm(emptyUserForm);
      setUserModalOpen(false);
    } catch (error) {
      toast.error(error.message || 'Could not save account');
    } finally {
      setSavingUser(false);
    }
  };

  const toggleUserStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';

    try {
      const response = await apiRequest(`/api/auth/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: adminHeaders(currentUser),
        body: JSON.stringify({ status: nextStatus }),
      });
      setAdminUsers((current) => current.map((item) => (item.id === user.id ? response.user : item)));
      toast.success(`Account ${nextStatus}`);
    } catch (error) {
      toast.error(error.message || 'Could not update status');
    }
  };

  const archiveUser = async (user) => {
    if (user.id === currentUser.id) {
      toast.error('You cannot archive your own admin account');
      return;
    }

    try {
      await apiRequest(`/api/auth/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: adminHeaders(currentUser),
      });
      setAdminUsers((current) => current.filter((item) => item.id !== user.id));
      await Promise.all([loadArchive(), loadProviders()]);
      toast.success('Account archived. It can be restored from Archive & Recovery.');
    } catch (error) {
      toast.error(error.message || 'Could not archive account');
    }
  };

  const restoreUser = async (user) => {
    try {
      const response = await apiRequest(`/api/auth/admin/users/${user.id}/restore`, {
        method: 'PATCH',
        headers: adminHeaders(currentUser),
      });
      setAdminUsers((current) => [response.user, ...current.filter((item) => item.id !== response.user.id)]);
      await Promise.all([loadArchive(), loadProviders()]);
      toast.success('Account restored');
    } catch (error) {
      toast.error(error.message || 'Could not restore account');
    }
  };

  const startEditProvider = (provider) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name || '',
      service: provider.service || '',
      serviceId: provider.serviceId || 'other',
      rate: Number(provider.rate || 0),
      location: provider.location || '',
      serviceArea: provider.serviceArea || '',
      bio: provider.bio || '',
      tags: listToText(provider.tags),
      certifications: listToText(provider.certifications),
      gallery: listToText(provider.gallery),
      avatar: provider.avatar || '',
    });
    setProviderModalOpen(true);
  };

  const handleProviderFormChange = (field, value) => {
    setProviderForm((current) => ({ ...current, [field]: value }));
  };

  const saveProviderProfile = async (e) => {
    e.preventDefault();
    if (!editingProvider) {
      toast.error('Select a provider profile first');
      return;
    }

    setSavingProvider(true);
    try {
      const providerId = editingProvider.id || editingProvider._id;
      const updated = await apiRequest(`/api/admin/providers/${providerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...providerForm,
          rate: Number(providerForm.rate || 0),
          tags: textToList(providerForm.tags),
          certifications: textToList(providerForm.certifications),
          gallery: textToList(providerForm.gallery),
        }),
      });

      setAdminProviders((current) => current.map((provider) => (
        (provider.id || provider._id) === (updated.id || updated._id) ? updated : provider
      )));
      setEditingProvider(updated);
      setCaseProvider((current) => (
        current && String(current.id || current._id) === String(updated.id || updated._id) ? updated : current
      ));
      setProviderModalOpen(false);
      toast.success('Provider profile updated');
    } catch (error) {
      toast.error(error.message || 'Could not save provider profile');
    } finally {
      setSavingProvider(false);
    }
  };

  const archiveProvider = async (provider) => {
    try {
      const providerId = provider.id || provider._id;
      await apiRequest(`/api/admin/providers/${providerId}`, { method: 'DELETE' });
      setAdminProviders((current) => current.filter((item) => String(item.id || item._id) !== String(providerId)));
      setCaseProvider((current) => (String(current?.id || current?._id) === String(providerId) ? null : current));
      await loadArchive();
      toast.success('Provider profile archived');
    } catch (error) {
      toast.error(error.message || 'Could not archive provider profile');
    }
  };

  const restoreProvider = async (provider) => {
    try {
      const restored = await apiRequest(`/api/admin/providers/${provider.id || provider._id}/restore`, { method: 'PATCH' });
      setAdminProviders((current) => [restored, ...current.filter((item) => String(item.id || item._id) !== String(restored.id || restored._id))]);
      await loadArchive();
      toast.success('Provider profile restored');
    } catch (error) {
      toast.error(error.message || 'Could not restore provider profile');
    }
  };

  const formatBookingId = (booking) => `BK-${String(booking._id || booking.id || '').slice(-6).toUpperCase() || 'NEW'}`;
  const providerNameById = (providerId) => adminProviders.find((provider) => String(provider.id || provider._id) === String(providerId))?.name || 'Provider';
  const displayKpis = adminStats?.cards || [];
  const displayHealth = adminStats?.health?.length ? adminStats.health : [
    ['API uptime', 'Online', 'yellow'],
    ['Active sockets', 'Live', 'blue'],
    ['Admin API', 'Protected', 'red'],
  ];
  const displayBookings = adminBookings;
  const displayTransactions = adminTransactions;
  const displayPayouts = adminPayouts;
  const displayReviews = adminReviews;
  const displayServices = adminServices;
  const displayReports = adminReports;
  const displayLogs = adminLogs;
  const earnings = adminStats?.earnings || {};
  const reportBelongsToProvider = (report, provider) => {
    if (!provider) return false;
    const providerIds = [provider.id, provider._id, provider.userId].map((value) => String(value || '').trim()).filter(Boolean);
    const reportIds = [report.providerId, report.providerObjectId, report.providerUserId].map((value) => String(value || '').trim()).filter(Boolean);
    return providerIds.some((value) => reportIds.includes(value));
  };
  const reportsForProvider = (provider) => adminReports.filter((report) => reportBelongsToProvider(report, provider));

  const updateReportStatus = async (report, status) => {
    setUpdatingReportId(String(report._id || ''));
    try {
      const updated = await apiRequest(`/api/admin/reports/${report._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          resolutionNote: String(reportNotes[String(report._id)] || '').trim(),
        }),
      });
      setAdminReports((current) => current.map((item) => (String(item._id) === String(updated._id) ? updated : item)));
      toast.success(`Report marked ${status}`);
    } catch (error) {
      toast.error(error.message || 'Could not update report');
    } finally {
      setUpdatingReportId('');
    }
  };

  const updateBookingStatus = async (booking, status) => {
    try {
      const updated = await apiRequest(`/api/admin/bookings/${booking._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setAdminBookings((current) => current.map((item) => (item._id === updated._id ? updated : item)));
      toast.success('Booking status updated');
    } catch (error) {
      toast.error(error.message || 'Could not update booking');
    }
  };

  const reviewPayout = async (payout, decision) => {
    const fields = payoutReviewForm[String(payout._id)] || {};
    if (decision === 'approve' && !String(fields.reference || '').trim()) {
      toast.error('Enter a payment reference before approving a payout.');
      return;
    }
    setPayoutReviewingId(String(payout._id));
    try {
      const updated = await apiRequest(`/api/admin/payouts/${payout._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          payoutReference: String(fields.reference || '').trim(),
          reviewNote: String(fields.note || '').trim(),
        }),
      });
      setAdminPayouts((current) => current.map((item) => (String(item._id) === String(updated._id) ? updated : item)));
      toast.success(`Payout ${updated.status}`);
    } catch (error) {
      toast.error(error.message || 'Could not review payout');
    } finally {
      setPayoutReviewingId('');
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!categoryLabel.trim()) return;

    setSavingCategory(true);
    try {
      const created = await apiRequest('/api/admin/services', {
        method: 'POST',
        body: JSON.stringify({ label: categoryLabel.trim() }),
      });
      setAdminServices((current) => [...current, created].sort((a, b) => a.label.localeCompare(b.label)));
      setCategoryLabel('');
      toast.success('Service category added');
    } catch (error) {
      toast.error(error.message || 'Could not add service category');
    } finally {
      setSavingCategory(false);
    }
  };

  const archiveCategory = async (service) => {
    try {
      await apiRequest(`/api/admin/services/${service.id}`, { method: 'DELETE' });
      setAdminServices((current) => current.filter((item) => item.id !== service.id));
      await loadArchive();
      toast.success('Service category archived');
    } catch (error) {
      toast.error(error.message || 'Could not archive service category');
    }
  };

  const restoreCategory = async (service) => {
    try {
      const restored = await apiRequest(`/api/admin/services/${service.id}/restore`, { method: 'PATCH' });
      setAdminServices((current) => [...current.filter((item) => item.id !== restored.id), restored].sort((a, b) => a.label.localeCompare(b.label)));
      await loadArchive();
      toast.success('Service category restored');
    } catch (error) {
      toast.error(error.message || 'Could not restore service category');
    }
  };

  const visibleKyc = kycQueue.filter((item) => item.status === 'pending');

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />

      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-6">
          <aside className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-sm h-fit xl:sticky xl:top-24">
            <div className="p-4 border-b-4 border-bauhaus-ink">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </div>
              <h1 className="mt-3 font-black text-xl uppercase tracking-tighter text-bauhaus-ink">Command Center</h1>
              <p className="mt-1 font-medium text-xs text-bauhaus-ink/50">Operations, trust, finance, support, and content controls.</p>
            </div>
            <nav className="max-h-[70vh] overflow-y-auto">
              {adminModules.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => setActiveModule(id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 border-bauhaus-ink/10 font-black text-[11px] uppercase tracking-wider transition-colors ${activeModule === id ? 'bg-bauhaus-yellow text-bauhaus-ink' : 'text-bauhaus-ink hover:bg-bauhaus-canvas'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-6">
            <header className="border-b-4 border-bauhaus-ink pb-5">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-bauhaus-yellow border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider text-bauhaus-ink">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Live Platform Operations
                  </div>
                  <h2 className="mt-3 font-black text-3xl sm:text-4xl uppercase tracking-tighter text-bauhaus-ink">Admin Dashboard</h2>
                  <p className="mt-1 font-medium text-sm text-bauhaus-ink/55">Monitor health, verify providers, moderate trust signals, and control marketplace content.</p>
                </div>
                <div className="flex items-center gap-2 bg-white border-2 border-bauhaus-ink px-3 py-2 min-w-0 lg:w-80">
                  <Search className="h-4 w-4 text-bauhaus-ink/40 shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users, reports, bookings..."
                    className="w-full min-w-0 bg-transparent outline-none font-bold text-xs text-bauhaus-ink placeholder:text-bauhaus-ink/35"
                  />
                </div>
              </div>
            </header>

            <Section id="analytics" title="Dashboard Analytics" icon={LayoutDashboard}>
              <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
                {displayKpis.map((stat) => <StatCard key={stat.label} stat={stat} />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                <div className="lg:col-span-2">
                  <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink/50 mb-2">Booking Volume Trend</div>
                  <MiniBars values={adminStats?.bookingTrend || []} />
                </div>
                <div>
                  <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink/50 mb-2">Platform Health</div>
                  <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-4 space-y-3 min-h-36">
                    {displayHealth.map(([label, value, tone]) => (
                      <div key={label} className="flex items-center justify-between gap-3">
                        <span className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink/60">{label}</span>
                        <StatusBadge tone={tone}>{value}</StatusBadge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            <Section
              id="users"
              title="User Management"
              icon={UserCog}
              action={(
                <button onClick={startCreateUser} className="inline-flex items-center gap-1 px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                  <UserPlus className="h-3.5 w-3.5" />
                  New Account
                </button>
              )}
            >
              {usersLoading ? (
                <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/50">
                  Loading accounts...
                </div>
              ) : (
                <DataTable
                  headers={['Avatar', 'Name', 'Email', 'Role', 'Status', 'Joined', 'Actions']}
                  rows={filteredUsers.map((user) => [
                    user.avatar ? (
                      <img key="avatar" src={user.avatar} alt={user.name || 'User avatar'} className="w-10 h-10 object-cover border-2 border-bauhaus-ink" />
                    ) : (
                      <div key="avatar" className="w-10 h-10 bg-bauhaus-yellow border-2 border-bauhaus-ink flex items-center justify-center font-black text-[10px] uppercase">
                        {(user.name || 'U').split(' ').slice(0, 2).map((part) => part[0]).join('')}
                      </div>
                    ),
                    user.name || 'Unnamed',
                    user.email || 'N/A',
                    formatRole(user.role),
                    <StatusBadge key={user.status} tone={statusTone(user.status)}>{user.status || 'active'}</StatusBadge>,
                    formatDate(user.createdAt || user.kycSubmittedAt),
                    <div key="actions" className="flex flex-wrap gap-2">
                      <button onClick={() => startEditUser(user)} className="inline-flex items-center gap-1 px-2 py-1 bg-bauhaus-yellow border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                        <Edit3 className="h-3 w-3" />
                        Edit
                      </button>
                      <button onClick={() => (user.status === 'active' ? requestConfirmation({
                        title: 'Suspend User Account?',
                        message: `${user.name || 'This user'} will be unable to access the platform until reactivated.`,
                        confirmLabel: 'Suspend Account',
                        onConfirm: () => toggleUserStatus(user),
                      }) : toggleUserStatus(user))} className="inline-flex items-center gap-1 px-2 py-1 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                        {user.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                      <button onClick={() => requestConfirmation({
                        title: 'Archive User Account?',
                        message: `${user.name || 'This user'} will be removed from active management and lose access. Linked provider visibility is also paused. You can restore this later.`,
                        confirmLabel: 'Archive Account',
                        onConfirm: () => archiveUser(user),
                      })} className="inline-flex items-center gap-1 px-2 py-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                        <Archive className="h-3 w-3" />
                        Archive
                      </button>
                    </div>,
                  ])}
                />
              )}
            </Section>

            <Section
              id="verification"
              title="Provider Verification"
              icon={ClipboardCheck}
              action={<StatusBadge tone="yellow">{kycLoading ? 'Loading' : `${visibleKyc.filter((item) => item.status === 'pending').length} Pending`}</StatusBadge>}
            >
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <div className="space-y-3">
                  {visibleKyc.length === 0 && (
                    <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-6 text-center">
                      <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">No Pending Applications</div>
                      <div className="mt-1 font-medium text-xs text-bauhaus-ink/50">Approved and rejected providers are removed from this queue.</div>
                    </div>
                  )}
                  {visibleKyc.map((submission) => (
                    <div key={submission._id} className={`border-2 border-bauhaus-ink p-3 ${selectedKyc?._id === submission._id ? 'bg-bauhaus-yellow' : 'bg-bauhaus-canvas'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{submission.fullName}</div>
                          <div className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/50">{submission.idType} - {submission.address}</div>
                        </div>
                        <StatusBadge tone={submission.status === 'approved' ? 'blue' : submission.status === 'rejected' ? 'red' : 'yellow'}>{submission.status}</StatusBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(submission.documents || []).map((doc) => (
                          <span key={doc.name} className="px-2 py-1 bg-white border-2 border-bauhaus-ink font-black text-[9px] uppercase tracking-wider">{doc.name}</span>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedKyc(submission)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          disabled={reviewingId === submission._id}
                          onClick={() => reviewKyc(submission, 'approved')}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          disabled={reviewingId === submission._id}
                          onClick={() => requestConfirmation({
                            title: 'Reject Provider Verification?',
                            message: `${submission.fullName || 'This provider'} will not receive verified provider access and must resubmit documents.`,
                            confirmLabel: 'Reject Application',
                            onConfirm: () => reviewKyc(submission, 'rejected'),
                          })}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-2 border-bauhaus-ink bg-white p-4">
                  {selectedKyc ? (
                    <div className="space-y-4">
                      <div>
                        <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink/50">Application Details</div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            ['Full Name', selectedKyc.fullName],
                            ['ID Type', selectedKyc.idType],
                            ['ID Number', selectedKyc.idNumber],
                            ['Address', selectedKyc.address],
                            ['Submitted', formatDate(selectedKyc.submittedAt)],
                            ['User ID', selectedKyc.userId],
                          ].map(([label, value]) => (
                            <div key={label} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                              <div className="font-black text-[9px] uppercase tracking-wider text-bauhaus-ink/45">{label}</div>
                              <div className="mt-1 font-bold text-sm text-bauhaus-ink break-all">{value || 'N/A'}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink/50">Submitted Photos</div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          {(selectedKyc.documents || []).map((doc) => (
                            <a
                              key={`${doc.slot}-${doc.name}`}
                              href={doc.dataUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block border-2 border-bauhaus-ink bg-bauhaus-canvas p-2 hover:bg-bauhaus-yellow transition-colors"
                            >
                              <div className="aspect-[4/3] border-2 border-bauhaus-ink bg-white overflow-hidden flex items-center justify-center">
                                {doc.dataUrl?.startsWith('data:image') ? (
                                  <img src={doc.dataUrl} alt={doc.label || doc.name} className="h-full w-full object-cover" />
                                ) : (
                                  <FileText className="h-9 w-9 text-bauhaus-ink/30" />
                                )}
                              </div>
                              <div className="mt-2 font-black text-[10px] uppercase tracking-wider text-bauhaus-ink">{doc.label || doc.slot || 'Document'}</div>
                              <div className="font-medium text-[10px] text-bauhaus-ink/50 truncate">{doc.name}</div>
                            </a>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink/50">Review Checklist</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          {['Government ID matches name', 'Front and back ID are readable', 'Selfie matches submitted ID', 'Address is serviceable', 'Duplicate account check', 'Safety flags clear'].map((item) => (
                            <label key={item} className="flex items-center gap-2 border-2 border-bauhaus-ink bg-bauhaus-canvas px-3 py-2">
                              <input type="checkbox" className="h-4 w-4 accent-bauhaus-blue" />
                              <span className="font-bold text-xs text-bauhaus-ink">{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-72 items-center justify-center border-2 border-dashed border-bauhaus-ink bg-bauhaus-canvas">
                      <div className="text-center px-4">
                        <ClipboardCheck className="h-10 w-10 mx-auto text-bauhaus-ink/30" />
                        <div className="mt-3 font-black text-sm uppercase tracking-tight text-bauhaus-ink">Select an Application</div>
                        <div className="mt-1 font-medium text-xs text-bauhaus-ink/50">Provider details and uploaded images will appear here.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Section>

            <Section
              id="provider-profiles"
              title="Provider Profiles"
              icon={UserCog}
              action={<StatusBadge tone="blue">{providersLoading ? 'Loading' : `${filteredProviders.length} Profiles`}</StatusBadge>}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="bg-bauhaus-ink text-white">
                      {['Provider', 'Service', 'Rate', 'Area', 'Trust', 'Reports', 'Actions'].map((head) => (
                        <th key={head} className="px-3 py-3 border-2 border-bauhaus-ink text-left font-black text-[10px] uppercase tracking-wider">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProviders.map((provider) => {
                      const reportCount = reportsForProvider(provider).length;
                      return (
                        <tr key={provider._id || provider.id} className="bg-white">
                          <td className="px-3 py-3 border-2 border-bauhaus-ink font-black text-xs uppercase">{provider.name || 'Unnamed'}</td>
                          <td className="px-3 py-3 border-2 border-bauhaus-ink font-bold text-xs">{provider.service || 'N/A'}</td>
                          <td className="px-3 py-3 border-2 border-bauhaus-ink font-bold text-xs">PHP {provider.rate || 0}</td>
                          <td className="px-3 py-3 border-2 border-bauhaus-ink font-medium text-xs">{provider.serviceArea || provider.location || 'N/A'}</td>
                          <td className="px-3 py-3 border-2 border-bauhaus-ink">
                            <StatusBadge tone={provider.verified ? 'yellow' : 'canvas'}>{provider.verified ? 'Verified' : 'Unverified'}</StatusBadge>
                          </td>
                          <td className="px-3 py-3 border-2 border-bauhaus-ink">
                            <StatusBadge tone={reportCount > 0 ? 'red' : 'canvas'}>{reportCount} Cases</StatusBadge>
                          </td>
                          <td className="px-3 py-3 border-2 border-bauhaus-ink">
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => setCaseProvider(provider)} className="inline-flex items-center gap-1 px-2 py-1 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                                <MessageSquareWarning className="h-3 w-3" />
                                Reports
                              </button>
                              <button onClick={() => startEditProvider(provider)} className="inline-flex items-center gap-1 px-2 py-1 bg-bauhaus-yellow border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </button>
                              <button onClick={() => requestConfirmation({
                                title: 'Archive Provider Profile?',
                                message: `${provider.name || 'This provider'} will no longer appear to clients or accept new bookings. The profile can be restored later.`,
                                confirmLabel: 'Archive Profile',
                                onConfirm: () => archiveProvider(provider),
                              })} className="inline-flex items-center gap-1 px-2 py-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                                <Archive className="h-3 w-3" />
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!providersLoading && filteredProviders.length === 0 && (
                      <tr className="bg-white">
                        <td colSpan={7} className="px-3 py-6 border-2 border-bauhaus-ink text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">No provider profiles found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 border-2 border-bauhaus-ink bg-bauhaus-canvas p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">Provider Complaint History</div>
                    <div className="mt-1 font-medium text-xs text-bauhaus-ink/55">{caseProvider ? `Reports associated with ${caseProvider.name || 'this provider'}.` : 'Choose Reports on a provider row to inspect associated cases.'}</div>
                  </div>
                  {caseProvider && <StatusBadge tone={reportsForProvider(caseProvider).length > 0 ? 'red' : 'canvas'}>{reportsForProvider(caseProvider).length} Reports</StatusBadge>}
                </div>
                {caseProvider && (
                  <div className="mt-4 space-y-3">
                    {reportsForProvider(caseProvider).map((report) => (
                      <div key={report._id} className="border-2 border-bauhaus-ink bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-black text-xs uppercase text-bauhaus-ink">{report.categoryLabel || report.category || 'Complaint'}</div>
                            <div className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/45">Filed by {report.reporterName || 'Customer'} - {formatDate(report.createdAt)}</div>
                          </div>
                          <StatusBadge tone={report.status === 'resolved' || report.status === 'dismissed' ? 'blue' : 'red'}>{report.status || 'open'}</StatusBadge>
                        </div>
                        <p className="mt-2 font-medium text-sm text-bauhaus-ink/70">{report.details || report.subject || 'No details provided.'}</p>
                        <input
                          value={reportNotes[String(report._id)] || ''}
                          onChange={(event) => setReportNotes((current) => ({ ...current, [String(report._id)]: event.target.value }))}
                          placeholder="Internal resolution note"
                          className="mt-3 w-full border-2 border-bauhaus-ink bg-bauhaus-canvas px-3 py-2 font-medium text-xs outline-none"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {['investigating', 'escalated', 'resolved', 'dismissed'].map((status) => (
                            <button key={status} type="button" disabled={updatingReportId === String(report._id)} onClick={() => (status === 'dismissed' ? requestConfirmation({
                              title: 'Dismiss Complaint?',
                              message: 'This complaint will be marked dismissed and removed from the active safety queue. Keep a resolution note for accountability.',
                              confirmLabel: 'Dismiss Report',
                              onConfirm: () => updateReportStatus(report, status),
                            }) : updateReportStatus(report, status))} className="px-2 py-1 border-2 border-bauhaus-ink bg-white font-black text-[9px] uppercase tracking-wider disabled:opacity-50">{status}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {reportsForProvider(caseProvider).length === 0 && (
                      <div className="border-2 border-dashed border-bauhaus-ink bg-white p-5 text-center font-black text-xs uppercase text-bauhaus-ink/45">No reports filed for this provider</div>
                    )}
                  </div>
                )}
              </div>
            </Section>

            <Section
              id="archive"
              title="Archive & Recovery"
              icon={Archive}
              action={<StatusBadge tone="canvas">{archivedUsers.length + archivedProviders.length + archivedServices.length} Archived</StatusBadge>}
            >
              <div className="mb-4 border-2 border-bauhaus-ink bg-bauhaus-yellow/40 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-bauhaus-red" />
                <div className="font-medium text-xs text-bauhaus-ink/70">Archive keeps records available for restoration and audit review. Restoring an account or provider makes it active in management again.</div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {[
                  {
                    title: 'User Accounts',
                    records: archivedUsers,
                    label: (record) => record.name || record.email || 'Archived User',
                    detail: (record) => record.email || formatDate(record.archivedAt || record.deletedAt),
                    restore: restoreUser,
                    canRestore: () => true,
                  },
                  {
                    title: 'Provider Profiles',
                    records: archivedProviders,
                    label: (record) => record.name || 'Archived Provider',
                    detail: (record) => record.service || formatDate(record.archivedAt),
                    restore: restoreProvider,
                    canRestore: (record) => !record.archivedViaUserId,
                  },
                  {
                    title: 'Service Categories',
                    records: archivedServices,
                    label: (record) => record.label || record.id || 'Archived Category',
                    detail: (record) => `Archived ${formatDate(record.archivedAt)}`,
                    restore: restoreCategory,
                    canRestore: () => true,
                  },
                ].map((group) => (
                  <div key={group.title} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">{group.title}</div>
                      <StatusBadge tone="canvas">{group.records.length}</StatusBadge>
                    </div>
                    <div className="space-y-2">
                      {group.records.map((record) => (
                        <div key={record.id || record._id} className="border-2 border-bauhaus-ink bg-white p-3">
                          <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">{group.label(record)}</div>
                          <div className="mt-1 font-medium text-[10px] text-bauhaus-ink/55 break-all">{group.detail(record)}</div>
                          {group.canRestore(record) ? (
                            <button type="button" onClick={() => group.restore(record)} className="mt-3 inline-flex items-center gap-1 border-2 border-bauhaus-ink bg-bauhaus-blue px-2 py-1 font-black text-[9px] uppercase tracking-wider text-white">
                              <RotateCcw className="h-3 w-3" />
                              Restore
                            </button>
                          ) : (
                            <div className="mt-3 border-2 border-bauhaus-ink bg-bauhaus-yellow px-2 py-1 font-black text-[9px] uppercase tracking-wider text-bauhaus-ink">Restore linked user first</div>
                          )}
                        </div>
                      ))}
                      {group.records.length === 0 && (
                        <div className="border-2 border-dashed border-bauhaus-ink bg-white p-4 text-center font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/40">Nothing archived</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Section id="reports" title="Reports Management" icon={MessageSquareWarning}>
                <div className="space-y-3">
                  {displayReports.map((report) => (
                    <div key={report._id || report.id} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">{report.id || `RPT-${String(report._id).slice(-4).toUpperCase()}`} - {report.categoryLabel || report.type || 'Report'}</div>
                          <div className="font-medium text-sm text-bauhaus-ink/60 truncate">{report.providerName ? `${report.providerName}: ` : ''}{report.subject}</div>
                        </div>
                        <StatusBadge tone={report.status === 'resolved' || report.status === 'dismissed' ? 'blue' : report.priority === 'High' ? 'red' : 'yellow'}>{report.status || report.priority || 'open'}</StatusBadge>
                      </div>
                      {report._id && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {['investigating', 'resolved', 'dismissed'].map((status) => (
                            <button key={status} type="button" disabled={updatingReportId === String(report._id)} onClick={() => (status === 'dismissed' ? requestConfirmation({
                              title: 'Dismiss Complaint?',
                              message: 'This complaint will be removed from the active safety queue. Confirm only after it has been reviewed.',
                              confirmLabel: 'Dismiss Report',
                              onConfirm: () => updateReportStatus(report, status),
                            }) : updateReportStatus(report, status))} className="px-2 py-1 border-2 border-bauhaus-ink bg-white font-black text-[9px] uppercase tracking-wider disabled:opacity-50">{status}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {displayReports.length === 0 && (
                    <div className="border-2 border-dashed border-bauhaus-ink bg-bauhaus-canvas p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">No complaints filed</div>
                  )}
                </div>
              </Section>

              <Section id="bookings" title="Booking Management" icon={CalendarClock}>
                <div className="space-y-3">
                  {displayBookings.map((booking) => (
                    <div key={booking._id || booking.id} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">{booking.id || formatBookingId(booking)} - {booking.service || providerNameById(booking.providerId)}</div>
                        <StatusBadge tone={booking.status === 'in_progress' || booking.status === 'In Progress' ? 'red' : 'yellow'}>{booking.status}</StatusBadge>
                      </div>
                      <div className="mt-2 font-bold text-xs text-bauhaus-ink/60">{booking.customer || booking.customerName || 'Customer'} with {booking.provider || providerNameById(booking.providerId)}</div>
                      <div className="font-bold text-xs text-bauhaus-blue">{booking.schedule || formatDate(booking.scheduledAt)}</div>
                      {booking._id && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {['requested', 'in_progress', 'completed', 'cancelled'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => (status === 'cancelled' ? requestConfirmation({
                                title: 'Cancel Booking?',
                                message: 'Cancelling a booking affects both client and provider scheduling and may require payment review.',
                                confirmLabel: 'Cancel Booking',
                                onConfirm: () => updateBookingStatus(booking, status),
                              }) : updateBookingStatus(booking, status))}
                              disabled={booking.status === status}
                              className="px-2 py-1 bg-white border-2 border-bauhaus-ink font-black text-[9px] uppercase tracking-wider disabled:opacity-50"
                            >
                              {status.replaceAll('_', ' ')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            <Section id="transactions" title="Transaction Monitoring" icon={ReceiptText}>
              <DataTable
                headers={['Transaction', 'Booking', 'Gross', 'Platform Fee', 'Provider Payout', 'Status']}
                rows={displayTransactions.map((tx) => [tx.id, tx.booking, tx.gross, tx.fee, tx.payout, <StatusBadge key={tx.status} tone={tx.status.includes('Refund') ? 'red' : tx.status.includes('Payout') ? 'yellow' : 'blue'}>{tx.status}</StatusBadge>])}
              />
            </Section>

            <Section
              id="payouts"
              title="Provider Payout Requests"
              icon={Banknote}
              action={<StatusBadge tone="yellow">{displayPayouts.filter((payout) => payout.status === 'pending').length} Pending</StatusBadge>}
            >
              <div className="space-y-3">
                {displayPayouts.map((payout) => {
                  const fields = payoutReviewForm[String(payout._id)] || {};
                  const pending = payout.status === 'pending';
                  return (
                    <div key={payout._id} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-4">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div>
                          <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{payout.providerName || 'Provider'}</div>
                          <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/50">
                            Requested {formatDate(payout.createdAt)} - Cashout every 15 days
                          </div>
                        </div>
                        <StatusBadge tone={payout.status === 'approved' ? 'blue' : payout.status === 'rejected' ? 'red' : 'yellow'}>{payout.status}</StatusBadge>
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                        {[
                          ['Requested Earnings', `PHP ${Number(payout.requestedAmount || 0).toLocaleString('en-PH')}`],
                          ['Service Fee (15%)', `PHP ${Number(payout.serviceFeeAmount || 0).toLocaleString('en-PH')}`],
                          ['Payout Amount', `PHP ${Number(payout.netPayout || 0).toLocaleString('en-PH')}`],
                          ['Method', String(payout.paymentMethod?.type || '').replace('_', ' ')],
                        ].map(([label, value]) => (
                          <div key={label} className="border-2 border-bauhaus-ink bg-white p-3">
                            <div className="font-black text-[9px] uppercase tracking-wider text-bauhaus-ink/45">{label}</div>
                            <div className="mt-1 font-black text-xs uppercase text-bauhaus-ink">{value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 border-2 border-bauhaus-ink bg-white p-3">
                        <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/50">Validate Payout Destination</div>
                        <div className="mt-2 font-bold text-xs text-bauhaus-ink">
                          {payout.paymentMethod?.accountName || 'No name'} - {payout.paymentMethod?.accountNumber || 'No account'}
                          {payout.paymentMethod?.institution ? ` - ${payout.paymentMethod.institution}` : ''}
                        </div>
                        {pending ? (
                          <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-2">
                            <input
                              value={fields.reference || ''}
                              onChange={(event) => setPayoutReviewForm((current) => ({ ...current, [payout._id]: { ...fields, reference: event.target.value } }))}
                              placeholder="Payout reference (required to approve)"
                              className="px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-xs outline-none"
                            />
                            <input
                              value={fields.note || ''}
                              onChange={(event) => setPayoutReviewForm((current) => ({ ...current, [payout._id]: { ...fields, note: event.target.value } }))}
                              placeholder="Validation note"
                              className="px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-xs outline-none"
                            />
                            <div className="flex gap-2">
                              <button type="button" disabled={payoutReviewingId === String(payout._id)} onClick={() => requestConfirmation({
                                title: 'Approve Payout?',
                                message: `Approve the payout of PHP ${Number(payout.netPayout || 0).toLocaleString('en-PH')} to ${payout.providerName || 'this provider'}? Confirm the payment destination and reference first.`,
                                confirmLabel: 'Approve Payout',
                                onConfirm: () => reviewPayout(payout, 'approve'),
                              })} className="px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-50">Approve</button>
                              <button type="button" disabled={payoutReviewingId === String(payout._id)} onClick={() => requestConfirmation({
                                title: 'Reject Payout?',
                                message: `${payout.providerName || 'This provider'} will not receive this payout request and may need to submit a new request.`,
                                confirmLabel: 'Reject Payout',
                                onConfirm: () => reviewPayout(payout, 'reject'),
                              })} className="px-3 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-50">Reject</button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 font-bold text-xs text-bauhaus-ink/60">
                            Reference: {payout.payoutReference || 'N/A'} {payout.reviewNote ? `- ${payout.reviewNote}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {displayPayouts.length === 0 && (
                  <div className="border-2 border-dashed border-bauhaus-ink bg-bauhaus-canvas p-8 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">No payout requests yet</div>
                )}
              </div>
            </Section>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Section id="reviews" title="Review Moderation" icon={Star}>
                <div className="space-y-3">
                  {displayReviews.map((review) => (
                    <div key={review._id || `${review.provider}-${review.text}`} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">{review.provider || review.name || providerNameById(review.providerId)} - {review.rating} Stars</div>
                        <StatusBadge tone={review.status === 'Flagged' || review.status === 'flagged' ? 'red' : 'blue'}>{review.status || 'published'}</StatusBadge>
                      </div>
                      <p className="mt-2 font-medium text-sm text-bauhaus-ink/65">{review.text}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="categories" title="Service Category Management" icon={Tags}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {displayServices.slice(0, 12).map((service) => (
                    <div key={service.id} className="min-h-20 border-2 border-bauhaus-ink bg-bauhaus-canvas p-2 flex flex-col justify-between gap-2">
                      <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">{service.label}</div>
                      <button type="button" onClick={() => requestConfirmation({
                        title: 'Archive Category?',
                        message: `${service.label} will no longer be available for new service selection. It can be restored from Archive & Recovery.`,
                        confirmLabel: 'Archive Category',
                        onConfirm: () => archiveCategory(service),
                      })} className="border-2 border-bauhaus-ink bg-white px-2 py-1 font-black text-[9px] uppercase tracking-wider text-bauhaus-red">
                        Archive
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={addCategory} className="mt-4 flex gap-2">
                  <input
                    value={categoryLabel}
                    onChange={(e) => setCategoryLabel(e.target.value)}
                    placeholder="New service category"
                    className="flex-1 px-3 py-3 border-2 border-bauhaus-ink bg-bauhaus-canvas font-bold text-sm outline-none"
                  />
                  <button disabled={savingCategory} className="px-4 py-3 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider disabled:opacity-60">
                    Add
                  </button>
                </form>
                <div className="mt-2 font-medium text-[10px] text-bauhaus-ink/45">Archived categories are hidden from clients and can be restored later.</div>
              </Section>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Section id="notifications" title="Notification Management" icon={Megaphone}>
                <div className="space-y-3">
                  <input placeholder="Broadcast title" className="w-full px-3 py-3 border-2 border-bauhaus-ink bg-bauhaus-canvas font-bold text-sm outline-none" />
                  <textarea placeholder="Message body" rows={4} className="w-full px-3 py-3 border-2 border-bauhaus-ink bg-bauhaus-canvas font-bold text-sm outline-none resize-none" />
                  <button className="w-full px-4 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider">Send Broadcast</button>
                </div>
              </Section>

              <Section id="logs" title="System Logs" icon={Server}>
                <div className="space-y-3">
                  {displayLogs.map((log) => (
                    <div key={log._id || `${log.time}-${log.message}`} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/50">{log.time || formatDate(log.createdAt)} - {log.type || 'System'}</div>
                        <StatusBadge tone={log.status === 'Recovered' ? 'yellow' : 'blue'}>{log.status}</StatusBadge>
                      </div>
                      <div className="mt-1 font-medium text-sm text-bauhaus-ink/65">{log.message}</div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="cms" title="Content Management System" icon={FileText}>
                <div className="space-y-3">
                  {cmsItems.map((item) => (
                    <button key={item} className="w-full flex items-center justify-between gap-3 px-3 py-3 border-2 border-bauhaus-ink bg-bauhaus-canvas hover:bg-white font-black text-xs uppercase tracking-wider text-bauhaus-ink">
                      {item}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            <Section id="earnings" title="Earnings Analytics" icon={Banknote}>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                <div>
                  <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink/50 mb-2">Commission Revenue Over Time</div>
                  <MiniBars values={adminStats?.earningTrend || []} />
                </div>
                <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-4 space-y-3">
                  {[
                    ['Gross volume', `PHP ${Number(earnings.grossVolume || 0).toLocaleString('en-PH')}`],
                    ['Commission cut', `PHP ${Number(earnings.platformFee || 0).toLocaleString('en-PH')}`],
                    ['Provider payouts', `PHP ${Number(earnings.providerPayout || 0).toLocaleString('en-PH')}`],
                    ['Refund exposure', `PHP ${Number(earnings.refundExposure || 0).toLocaleString('en-PH')}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 border-b-2 border-bauhaus-ink/10 pb-2">
                      <span className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink/55">{label}</span>
                      <span className="font-black text-sm text-bauhaus-ink">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Section
              id="map"
              title="Map Monitoring"
              icon={MapPin}
              action={<StatusBadge tone="red">{adminProviders.filter((provider) => provider.available).length} Active Providers</StatusBadge>}
            >
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
                <AdminMap providers={adminProviders} />
                <div className="space-y-3">
                  {adminProviders.slice(0, 5).map((provider) => (
                    <div key={provider.id || provider._id} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">{provider.name}</div>
                        <StatusBadge tone={provider.available ? 'yellow' : 'canvas'}>{provider.available ? 'Live' : 'Offline'}</StatusBadge>
                      </div>
                      <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/50">{provider.service} - {provider.location}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        </div>
      </main>

      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bauhaus-ink/70 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" className="w-full max-w-md border-4 border-bauhaus-ink bg-white shadow-bauhaus-lg">
            <div className="flex items-center gap-3 border-b-4 border-bauhaus-ink bg-bauhaus-red px-5 py-4 text-white">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <div id="admin-confirm-title" className="font-black text-lg uppercase tracking-tight">{confirmDialog.title}</div>
            </div>
            <div className="p-5">
              <p className="font-medium text-sm leading-relaxed text-bauhaus-ink/75">{confirmDialog.message}</p>
              <div className="mt-4 border-2 border-bauhaus-ink bg-bauhaus-canvas p-3 font-bold text-xs text-bauhaus-ink/65">
                Confirm this action only if you have reviewed its impact. Archived records remain recoverable in Archive & Recovery.
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t-2 border-bauhaus-ink bg-bauhaus-canvas p-4">
              <button type="button" disabled={confirmingAction} onClick={() => setConfirmDialog(null)} className="px-4 py-3 bg-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider disabled:opacity-50">Cancel</button>
              <button type="button" disabled={confirmingAction} onClick={runConfirmedAction} className="px-4 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider disabled:opacity-50">
                {confirmingAction ? 'Processing...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bauhaus-ink/70 p-4">
          <form onSubmit={saveUser} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border-4 border-bauhaus-ink bg-white shadow-bauhaus-lg">
            <div className="flex items-center justify-between gap-3 border-b-4 border-bauhaus-ink bg-bauhaus-yellow px-5 py-4">
              <div>
                <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">{editingUser ? 'Edit User Account' : 'New User Account'}</div>
                <div className="font-medium text-xs text-bauhaus-ink/60">{editingUser ? 'Update identity, access role, or account state.' : 'Create an account managed by the admin team.'}</div>
              </div>
              <button type="button" onClick={() => setUserModalOpen(false)} className="border-2 border-bauhaus-ink bg-white p-2" aria-label="Close user form">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-5 p-5">
              <div className="flex flex-col items-center gap-2">
                <div className="w-28 h-28 border-2 border-bauhaus-ink bg-bauhaus-canvas flex items-center justify-center overflow-hidden">
                  {userForm.avatar ? (
                    <img src={userForm.avatar} alt="Account avatar" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-bauhaus-ink/30" />
                  )}
                </div>
                <label className="w-full inline-flex items-center justify-center px-2 py-2 bg-white border-2 border-bauhaus-ink font-black text-[9px] uppercase tracking-wider cursor-pointer hover:bg-bauhaus-yellow">
                  Select Avatar
                  <input type="file" accept="image/*" onChange={handleAdminAvatarUpload} className="sr-only" />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={userForm.name} onChange={(e) => handleUserFormChange('name', e.target.value)} placeholder="Full name" className="px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none" />
                <input value={userForm.email} onChange={(e) => handleUserFormChange('email', e.target.value)} placeholder="Email address" type="email" className="px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none" />
                <input value={userForm.phone} onChange={(e) => handleUserFormChange('phone', e.target.value)} placeholder="Phone" className="px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none" />
                <input value={userForm.password} onChange={(e) => handleUserFormChange('password', e.target.value)} placeholder={editingUser ? 'New password optional' : 'Password'} type="password" className="px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none" />
                <select value={userForm.role} onChange={(e) => handleUserFormChange('role', e.target.value)} className="px-3 py-3 border-2 border-bauhaus-ink bg-white font-black text-xs uppercase tracking-wider outline-none">
                  {roleOptions.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
                </select>
                <select value={userForm.status} onChange={(e) => handleUserFormChange('status', e.target.value)} className="px-3 py-3 border-2 border-bauhaus-ink bg-white font-black text-xs uppercase tracking-wider outline-none">
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t-2 border-bauhaus-ink bg-bauhaus-canvas p-4">
              <button type="button" onClick={() => setUserModalOpen(false)} className="px-4 py-3 bg-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider">Cancel</button>
              <button disabled={savingUser} className="inline-flex items-center justify-center gap-1 px-5 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider disabled:opacity-60">
                <Plus className="h-3.5 w-3.5" />
                {savingUser ? 'Saving...' : editingUser ? 'Save User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {providerModalOpen && editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bauhaus-ink/70 p-4">
          <form onSubmit={saveProviderProfile} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border-4 border-bauhaus-ink bg-white shadow-bauhaus-lg">
            <div className="flex items-center justify-between gap-3 border-b-4 border-bauhaus-ink bg-bauhaus-yellow px-5 py-4">
              <div>
                <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">Edit Provider Profile</div>
                <div className="font-medium text-xs text-bauhaus-ink/60">{editingProvider.name || 'Provider'} - public profile details and pricing</div>
              </div>
              <button type="button" onClick={() => setProviderModalOpen(false)} className="border-2 border-bauhaus-ink bg-white p-2" aria-label="Close provider form">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
              {[
                ['Display Name', 'name'],
                ['Service', 'service'],
                ['Service ID', 'serviceId'],
                ['Location', 'location'],
                ['Service Area', 'serviceArea'],
                ['Avatar URL', 'avatar'],
              ].map(([label, field]) => (
                <label key={field} className="block">
                  <span className="font-black text-[9px] uppercase tracking-wider text-bauhaus-ink/55">{label}</span>
                  <input value={providerForm[field]} onChange={(e) => handleProviderFormChange(field, e.target.value)} className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-xs outline-none" />
                </label>
              ))}
              <label className="block">
                <span className="font-black text-[9px] uppercase tracking-wider text-bauhaus-ink/55">Hourly Rate</span>
                <input type="number" min="0" value={providerForm.rate} onChange={(e) => handleProviderFormChange('rate', Number(e.target.value))} className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-xs outline-none" />
              </label>
              <label className="block sm:col-span-2">
                <span className="font-black text-[9px] uppercase tracking-wider text-bauhaus-ink/55">About</span>
                <textarea value={providerForm.bio} onChange={(e) => handleProviderFormChange('bio', e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-medium text-xs outline-none resize-none" />
              </label>
              <label className="block sm:col-span-2">
                <span className="font-black text-[9px] uppercase tracking-wider text-bauhaus-ink/55">Service Tags</span>
                <input value={providerForm.tags} onChange={(e) => handleProviderFormChange('tags', e.target.value)} className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-xs outline-none" />
              </label>
              <label className="block">
                <span className="font-black text-[9px] uppercase tracking-wider text-bauhaus-ink/55">Certifications</span>
                <input value={providerForm.certifications} onChange={(e) => handleProviderFormChange('certifications', e.target.value)} className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-xs outline-none" />
              </label>
              <label className="block">
                <span className="font-black text-[9px] uppercase tracking-wider text-bauhaus-ink/55">Gallery Image URLs</span>
                <input value={providerForm.gallery} onChange={(e) => handleProviderFormChange('gallery', e.target.value)} className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-xs outline-none" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t-2 border-bauhaus-ink bg-bauhaus-canvas p-4">
              <button type="button" onClick={() => setProviderModalOpen(false)} className="px-4 py-3 bg-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider">Cancel</button>
              <button disabled={savingProvider} className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider disabled:opacity-60">
                <Save className="h-4 w-4" />
                {savingProvider ? 'Saving...' : 'Save Provider Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      <NearMeFooter />
      <Toaster position="top-center" />
    </div>
  );
}

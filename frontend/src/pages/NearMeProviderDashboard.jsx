import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  Banknote,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck2,
  ImagePlus,
  MapPin,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Upload,
  WalletCards,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import { apiRequest, uploadImage } from '../lib/api';
import {
  PROVIDER_KYC_PATH,
  PROVIDER_REVIEW_PATH,
  canAccessProviderDashboard,
  getStoredNearMeUser,
  isProviderUnderReview,
  mergeStoredNearMeUser,
  needsProviderKyc,
} from '../lib/providerAccess';

const emptyProviderProfile = {
  id: 0,
  _id: '',
  name: '',
  avatar: '',
  service: '',
  serviceId: 'other',
  rate: 0,
  location: '',
  serviceArea: '',
  bio: '',
  tags: [],
  certifications: [],
  gallery: [],
  rating: 0,
  reviews: 0,
  jobs: 0,
  available: true,
  verified: false,
};

const initialPricing = [];

const listToText = (value) => (Array.isArray(value) ? value.join(', ') : '');
const textToList = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const providerPublicId = (provider) => provider?.id || provider?._id || '';

function StatusPill({ children, tone = 'blue' }) {
  const tones = {
    blue: 'bg-bauhaus-blue text-white',
    red: 'bg-bauhaus-red text-white',
    yellow: 'bg-bauhaus-yellow text-bauhaus-ink',
    ink: 'bg-bauhaus-ink text-white',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Panel({ title, icon: Icon, children, action }) {
  return (
    <section className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-4 border-bauhaus-ink bg-bauhaus-canvas">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-bauhaus-red" />
          <h2 className="font-black text-sm uppercase tracking-tight text-bauhaus-ink truncate">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function NearMeProviderDashboard() {
  const [user, setUser] = useState(() => getStoredNearMeUser());
  const [available, setAvailable] = useState(true);
  const [pricing, setPricing] = useState(initialPricing);
  const [providerProfile, setProviderProfile] = useState(emptyProviderProfile);
  const [settingsForm, setSettingsForm] = useState({
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
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [providerBookings, setProviderBookings] = useState([]);
  const [providerConversations, setProviderConversations] = useState([]);

  useEffect(() => {
    const syncUser = () => setUser(getStoredNearMeUser());
    syncUser();
    window.addEventListener('storage', syncUser);
    window.addEventListener('nearme:user-updated', syncUser);

    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('nearme:user-updated', syncUser);
    };
  }, []);

  const firstName = useMemo(() => user?.fname || user?.name?.split(' ')?.[0] || 'Provider', [user]);

  useEffect(() => {
    if (!user?.id) return;

    setProfileLoading(true);
    apiRequest(`/api/providers/me?userId=${encodeURIComponent(user.id)}`)
      .then((profile) => {
        const merged = { ...emptyProviderProfile, ...profile };
        setProviderProfile(merged);
        setAvailable(Boolean(merged.available));
        setPricing([{
          service: merged.service || 'Primary Service',
          fixedFee: Number(merged.rate || 0),
          variableFee: Number(merged.rate || 0),
          consultationFee: 0,
          variableEnabled: true,
        }]);
        setSettingsForm({
          name: merged.name || '',
          service: merged.service || '',
          serviceId: merged.serviceId || 'other',
          rate: Number(merged.rate || 0),
          location: merged.location || '',
          serviceArea: merged.serviceArea || '',
          bio: merged.bio || '',
          tags: listToText(merged.tags),
          certifications: listToText(merged.certifications),
          gallery: listToText(merged.gallery),
          avatar: merged.avatar || '',
        });
      })
      .catch((error) => toast.error(error.message || 'Could not load provider settings'))
      .finally(() => setProfileLoading(false));
  }, [user?.id]);

  useEffect(() => {
    const providerId = providerPublicId(providerProfile);
    if (!providerId || profileLoading) return;

    Promise.all([
      apiRequest(`/api/bookings?providerId=${encodeURIComponent(providerId)}`).catch(() => []),
      apiRequest('/api/conversations').catch(() => []),
    ]).then(([bookingData, conversationData]) => {
      setProviderBookings(Array.isArray(bookingData) ? bookingData : []);
      setProviderConversations(Array.isArray(conversationData) ? conversationData : []);
    });
  }, [providerProfile.id, providerProfile._id, profileLoading]);

  if (!user) return <Navigate to="/login" replace />;
  if (needsProviderKyc(user)) return <Navigate to={PROVIDER_KYC_PATH} replace />;
  if (isProviderUnderReview(user)) return <Navigate to={PROVIDER_REVIEW_PATH} replace />;
  if (!canAccessProviderDashboard(user)) return <Navigate to={PROVIDER_KYC_PATH} replace />;

  const formatBookingDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };
  const formatBookingTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const todayBookings = providerBookings.filter((booking) => {
    const date = new Date(booking.scheduledAt);
    const today = new Date();
    return !Number.isNaN(date.getTime()) && date.toDateString() === today.toDateString();
  });
  const weeklyEarnings = providerBookings
    .filter((booking) => ['completed', 'reviewed'].includes(booking.status))
    .reduce((sum, booking) => sum + Number(booking.rate || 0), 0);
  const schedule = todayBookings.map((booking) => ({
    time: formatBookingTime(booking.scheduledAt),
    label: `${booking.service || providerProfile.service || 'Service'} - ${booking.customerName || 'Customer'}`,
    type: 'booking',
  }));

  const updatePrice = (index, field, value) => {
    setPricing((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const updateSetting = (field, value) => {
    setSettingsForm((current) => ({ ...current, [field]: value }));
  };

  const uploadProviderAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const avatarUrl = await uploadImage(file, 'provider-avatars');
      updateSetting('avatar', avatarUrl);
      toast.success('Provider image uploaded');
    } catch (error) {
      toast.error(error.message || 'Could not upload image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const uploadGalleryImages = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploadingGallery(true);
    try {
      const urls = [];
      for (const file of files) {
        urls.push(await uploadImage(file, 'provider-gallery'));
      }

      setSettingsForm((current) => ({
        ...current,
        gallery: listToText([...textToList(current.gallery), ...urls]),
      }));
      toast.success(`${urls.length} gallery image${urls.length === 1 ? '' : 's'} uploaded`);
    } catch (error) {
      toast.error(error.message || 'Could not upload gallery images');
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = (url) => {
    setSettingsForm((current) => ({
      ...current,
      gallery: listToText(textToList(current.gallery).filter((item) => item !== url)),
    }));
  };

  const toggleAvailability = async () => {
    const nextAvailable = !available;
    setAvailable(nextAvailable);

    if (!providerPublicId(providerProfile)) return;

    try {
      const updated = await apiRequest(`/api/providers/${providerPublicId(providerProfile)}`, {
        method: 'PATCH',
        body: JSON.stringify({ available: nextAvailable }),
      });
      setProviderProfile((current) => ({ ...current, ...updated }));
    } catch (error) {
      setAvailable(!nextAvailable);
      toast.error(error.message || 'Could not update availability');
    }
  };

  const saveProviderSettings = async (e) => {
    e.preventDefault();

    if (!providerPublicId(providerProfile)) {
      toast.error('Provider profile is still loading');
      return;
    }

    setProfileSaving(true);
    try {
      const payload = {
        name: settingsForm.name,
        service: settingsForm.service,
        serviceId: settingsForm.serviceId || 'other',
        rate: Number(settingsForm.rate || 0),
        location: settingsForm.location,
        serviceArea: settingsForm.serviceArea,
        bio: settingsForm.bio,
        tags: textToList(settingsForm.tags),
        certifications: textToList(settingsForm.certifications),
        gallery: textToList(settingsForm.gallery),
        avatar: settingsForm.avatar,
      };

      const updated = await apiRequest(`/api/providers/${providerPublicId(providerProfile)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      const merged = { ...emptyProviderProfile, ...updated };
      setProviderProfile(merged);
      mergeStoredNearMeUser({ avatar: merged.avatar || '' });
      setPricing((current) => current.map((item, index) => (
        index === 0 ? { ...item, service: merged.service || 'Primary Service', fixedFee: Number(merged.rate || 0), variableFee: Number(merged.rate || 0) } : item
      )));
      toast.success('Provider profile updated');
    } catch (error) {
      toast.error(error.message || 'Could not save settings');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          <aside className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-sm h-fit lg:sticky lg:top-24">
            <div className="p-4 border-b-4 border-bauhaus-ink">
              <div className="font-black text-lg uppercase tracking-tighter text-bauhaus-ink">{firstName}'s Workspace</div>
              <div className="mt-2">
                <StatusPill tone={user.providerStatus === 'approved' ? 'yellow' : 'blue'}>
                  {user.providerStatus === 'approved' ? 'Verified' : 'KYC Under Review'}
                </StatusPill>
              </div>
            </div>
            {[
              ['Dashboard', CalendarDays],
              ['Calendar', Clock],
              ['Bookings', FileCheck2],
              ['Chat History', MessageSquareText],
              ['Pricing', WalletCards],
            ].map(([label, Icon]) => (
              <a key={label} href={`#${label.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-2 px-4 py-3 border-b-2 border-bauhaus-ink/10 font-bold text-xs uppercase tracking-wider text-bauhaus-ink hover:bg-bauhaus-yellow/30">
                <Icon className="h-4 w-4" />
                {label}
              </a>
            ))}
          </aside>

          <div className="space-y-6">
            <header className="border-b-4 border-bauhaus-ink pb-5">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-bauhaus-yellow border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider text-bauhaus-ink">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Provider Dashboard
                  </div>
                  <h1 className="mt-3 font-black text-3xl sm:text-4xl uppercase tracking-tighter text-bauhaus-ink">Manage Local Work</h1>
                  <p className="mt-1 font-medium text-sm text-bauhaus-ink/55">Calendar, bookings, chat history, and flexible service rates in one workspace.</p>
                </div>
                <button
                  type="button"
                  onClick={toggleAvailability}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-3 border-2 border-bauhaus-ink shadow-bauhaus-sm font-black text-xs uppercase tracking-wider ${available ? 'bg-bauhaus-blue text-white' : 'bg-white text-bauhaus-ink'}`}
                >
                  {available ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {available ? 'Accepting Jobs' : 'Offline'}
                </button>
              </div>
            </header>

            <section id="dashboard" className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                ['Today', `${todayBookings.length} Jobs`, CalendarDays, 'blue'],
                ['Completed Earnings', `PHP ${weeklyEarnings.toLocaleString('en-PH')}`, Banknote, 'yellow'],
                ['Rating', providerProfile.rating || '0.0', Star, 'red'],
                ['Completed', providerProfile.jobs || 0, CheckCircle2, 'ink'],
              ].map(([label, value, Icon, tone]) => (
                <div key={label} className="bg-white border-4 border-bauhaus-ink p-4 shadow-bauhaus-sm">
                  <div className={`w-9 h-9 border-2 border-bauhaus-ink flex items-center justify-center ${tone === 'blue' ? 'bg-bauhaus-blue text-white' : tone === 'yellow' ? 'bg-bauhaus-yellow text-bauhaus-ink' : tone === 'red' ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-ink text-white'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-3 font-black text-xl uppercase tracking-tight text-bauhaus-ink">{value}</div>
                  <div className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/45">{label}</div>
                </div>
              ))}
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
              <Panel
                title="Work Management Calendar"
                icon={CalendarDays}
                action={(
                  <button className="inline-flex items-center gap-1 px-3 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                    <Plus className="h-3.5 w-3.5" />
                    Slot
                  </button>
                )}
              >
                <div id="calendar" className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4">
                  <div className="grid grid-cols-7 md:grid-cols-1 gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                      <button key={day} className={`min-h-12 border-2 border-bauhaus-ink font-black text-xs uppercase ${index === 2 ? 'bg-bauhaus-yellow' : 'bg-white hover:bg-bauhaus-canvas'}`}>
                        {day}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {schedule.map((item) => (
                      <div key={`${item.time}-${item.label}`} className="grid grid-cols-[70px_1fr] gap-3 items-stretch">
                        <div className="bg-bauhaus-ink text-white border-2 border-bauhaus-ink flex items-center justify-center font-black text-xs">{item.time}</div>
                        <div className={`border-2 border-bauhaus-ink px-4 py-3 font-bold text-sm ${item.type === 'booking' ? 'bg-bauhaus-yellow' : item.type === 'blocked' ? 'bg-bauhaus-red text-white' : 'bg-white'}`}>
                          {item.label}
                        </div>
                      </div>
                    ))}
                    {schedule.length === 0 && (
                      <div className="border-2 border-dashed border-bauhaus-ink bg-white p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">
                        No bookings scheduled today
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              <Panel title="Chat History" icon={MessageSquareText}>
                <div id="chat-history" className="space-y-3">
                  {providerConversations.slice(0, 4).map((chat) => (
                    <button key={chat._id} className="w-full text-left border-2 border-bauhaus-ink bg-bauhaus-canvas hover:bg-white p-3 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">{chat.customer?.name || 'Customer'}</div>
                        <StatusPill tone={chat.status === 'Active Job' ? 'red' : 'blue'}>{chat.status}</StatusPill>
                      </div>
                      <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/45">{chat.provider?.service || providerProfile.service}</div>
                      <p className="mt-2 font-medium text-xs text-bauhaus-ink/60 line-clamp-2">{chat.lastMessage || 'No messages yet'}</p>
                    </button>
                  ))}
                  {providerConversations.length === 0 && (
                    <div className="border-2 border-dashed border-bauhaus-ink bg-white p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">
                      No conversations yet
                    </div>
                  )}
                  <Link to="/messages" className="inline-flex items-center justify-center w-full gap-2 px-4 py-3 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider">
                    <MessageSquareText className="h-4 w-4" />
                    Open Messages
                  </Link>
                </div>
              </Panel>
            </div>

            <Panel title="Booking Queue" icon={FileCheck2}>
              <div id="bookings" className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead>
                    <tr className="bg-bauhaus-ink text-white">
                      {['Client', 'Service', 'Date', 'Time', 'Rate', 'Status'].map((head) => (
                        <th key={head} className="px-3 py-3 text-left font-black text-[10px] uppercase tracking-wider border-2 border-bauhaus-ink">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {providerBookings.map((booking) => (
                      <tr key={booking._id} className="bg-white">
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-black text-xs uppercase">{booking.customerName || 'Customer'}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-medium text-sm">{booking.service || providerProfile.service}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-bold text-xs">{formatBookingDate(booking.scheduledAt)}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-bold text-xs">{formatBookingTime(booking.scheduledAt)}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-bold text-xs">PHP {Number(booking.rate || 0).toLocaleString('en-PH')}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink"><StatusPill tone="yellow">{booking.status}</StatusPill></td>
                      </tr>
                    ))}
                    {providerBookings.length === 0 && (
                      <tr className="bg-white">
                        <td colSpan={6} className="px-3 py-6 border-2 border-bauhaus-ink text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">No bookings yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel
              title="Flexible Pricing"
              icon={WalletCards}
              action={(
                <button
                  type="button"
                  onClick={() => updateSetting('rate', pricing[0]?.fixedFee || 0)}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
                >
                  <Save className="h-3.5 w-3.5" />
                  Use Rate
                </button>
              )}
            >
              <div id="pricing" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pricing.map((item, index) => (
                  <div key={item.service} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{item.service}</h3>
                      <Pencil className="h-4 w-4 text-bauhaus-red" />
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        ['Fixed Fee', 'fixedFee'],
                        ['Variable / Hourly', 'variableFee'],
                        ['Consultation', 'consultationFee'],
                      ].map(([label, field]) => (
                        <label key={field} className="block">
                          <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">{label}</span>
                          <div className="mt-1 flex border-2 border-bauhaus-ink bg-white">
                            <span className="px-2 py-2 bg-bauhaus-yellow border-r-2 border-bauhaus-ink font-black text-xs">PHP</span>
                            <input
                              type="number"
                              min="0"
                              value={item[field]}
                              onChange={(e) => updatePrice(index, field, Number(e.target.value))}
                              className="w-full min-w-0 px-2 py-2 font-bold text-sm outline-none"
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Settings"
              icon={Settings}
              action={(
                <Link
                  to={providerPublicId(providerProfile) ? `/provider/${providerPublicId(providerProfile)}` : '/browse'}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
                >
                  View Public Profile
                </Link>
              )}
            >
              <form id="settings" onSubmit={saveProviderSettings} className="space-y-5">
                {profileLoading ? (
                  <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-6 font-black text-sm uppercase tracking-tight text-bauhaus-ink/50">
                    Loading provider settings...
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-4">
                      <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                        <div className="aspect-square border-2 border-bauhaus-ink bg-white overflow-hidden flex items-center justify-center">
                          {settingsForm.avatar ? (
                            <img src={settingsForm.avatar} alt={settingsForm.name || 'Provider'} className="h-full w-full object-cover" />
                          ) : (
                            <ImagePlus className="h-10 w-10 text-bauhaus-ink/25" />
                          )}
                        </div>
                        <label className={`mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider cursor-pointer hover:bg-bauhaus-yellow ${uploadingAvatar ? 'opacity-60 pointer-events-none' : ''}`}>
                          <Upload className="h-3.5 w-3.5" />
                          {uploadingAvatar ? 'Uploading...' : 'Upload Image'}
                          <input type="file" accept="image/*" onChange={uploadProviderAvatar} className="sr-only" />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          ['Display Name', 'name'],
                          ['Service', 'service'],
                          ['Service ID', 'serviceId'],
                          ['Location', 'location'],
                          ['Service Area', 'serviceArea'],
                        ].map(([label, field]) => (
                          <label key={field} className="block">
                            <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">{label}</span>
                            <input value={settingsForm[field]} onChange={(e) => updateSetting(field, e.target.value)} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue" />
                          </label>
                        ))}
                        <label className="block">
                          <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Hourly Rate</span>
                          <div className="mt-1 flex border-2 border-bauhaus-ink bg-white">
                            <span className="px-3 py-3 bg-bauhaus-yellow border-r-2 border-bauhaus-ink font-black text-xs">PHP</span>
                            <input type="number" min="0" value={settingsForm.rate} onChange={(e) => updateSetting('rate', Number(e.target.value))} className="w-full min-w-0 px-3 py-3 font-bold text-sm outline-none" />
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <label className="block lg:col-span-2">
                        <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">About</span>
                        <textarea value={settingsForm.bio} onChange={(e) => updateSetting('bio', e.target.value)} rows={4} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-medium text-sm outline-none focus:border-bauhaus-blue resize-none" />
                      </label>
                      <label className="block">
                        <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Service Tags</span>
                        <input value={settingsForm.tags} onChange={(e) => updateSetting('tags', e.target.value)} placeholder="Pipe Repair, Installation" className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue" />
                      </label>
                      <label className="block">
                        <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Certifications</span>
                        <input value={settingsForm.certifications} onChange={(e) => updateSetting('certifications', e.target.value)} placeholder="TESDA Certified" className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue" />
                      </label>
                      <div className="lg:col-span-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Gallery</span>
                          <label className={`inline-flex items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider cursor-pointer hover:bg-bauhaus-yellow ${uploadingGallery ? 'opacity-60 pointer-events-none' : ''}`}>
                            <ImagePlus className="h-3.5 w-3.5" />
                            {uploadingGallery ? 'Uploading...' : 'Add Photos'}
                            <input type="file" accept="image/*" multiple onChange={uploadGalleryImages} className="sr-only" />
                          </label>
                        </div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                          {textToList(settingsForm.gallery).map((url) => (
                            <div key={url} className="relative border-2 border-bauhaus-ink bg-white aspect-video overflow-hidden">
                              <img src={url} alt="Provider gallery" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeGalleryImage(url)}
                                className="absolute top-1 right-1 p-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          {textToList(settingsForm.gallery).length === 0 && (
                            <div className="col-span-2 md:col-span-4 border-2 border-dashed border-bauhaus-ink bg-white p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">
                              No gallery photos uploaded
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        [MapPin, 'Quick Info Location', settingsForm.location || 'Not set'],
                        [Briefcase, 'Jobs Completed', `${providerProfile.jobs || 0} jobs`],
                        [Star, 'Reviews', `${providerProfile.reviews || 0} reviews`],
                      ].map(([Icon, label, value]) => (
                        <div key={label} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3 flex items-start gap-2">
                          <Icon className="h-4 w-4 text-bauhaus-red shrink-0 mt-0.5" />
                          <div>
                            <div className="font-black text-[9px] uppercase tracking-wider text-bauhaus-ink/45">{label}</div>
                            <div className="font-black text-xs text-bauhaus-ink mt-0.5">{value}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button disabled={profileSaving} className="inline-flex items-center gap-2 px-5 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink shadow-bauhaus-sm font-black text-xs uppercase tracking-wider disabled:opacity-60">
                        <Save className="h-4 w-4" />
                        {profileSaving ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </Panel>
          </div>
        </div>
      </main>

      <NearMeFooter />
      <Toaster position="top-center" />
    </div>
  );
}

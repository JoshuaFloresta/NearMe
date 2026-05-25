import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  Banknote,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  ImagePlus,
  MapPin,
  MessageSquareText,
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
import { getSocket } from '../lib/socket';
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
  availabilityDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  workingHours: { start: '08:00', end: '18:00' },
  availabilityOverrides: {},
  rating: 0,
  reviews: 0,
  jobs: 0,
  available: true,
  verified: false,
};

const listToText = (value) => (Array.isArray(value) ? value.join(', ') : '');
const textToList = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const providerPublicId = (provider) => provider?.id || provider?._id || '';
const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const calendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const toTitleCase = (value = '') => String(value)
  .trim()
  .replace(/\s+/g, ' ')
  .split(' ')
  .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ''))
  .join(' ');
const slugify = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-');

const parseInquiryCard = (text = '') => {
  if (!String(text).startsWith('INQUIRY_CARD::')) return null;
  try {
    return JSON.parse(String(text).replace('INQUIRY_CARD::', ''));
  } catch {
    return null;
  }
};
const parseInquiryResponseCard = (text = '') => {
  if (!String(text).startsWith('INQUIRY_RESPONSE::')) return null;
  try {
    return JSON.parse(String(text).replace('INQUIRY_RESPONSE::', ''));
  } catch {
    return null;
  }
};
const isOtherInquiry = (payload) => String(payload?.serviceCategory || '').toLowerCase() === 'other';
const isFixedOrBundleSelection = (payload) => {
  const type = String(payload?.serviceSelection?.type || '').toLowerCase();
  return type === 'fixed' || type === 'bundle';
};
const getSelectedPrice = (payload) => {
  const selection = payload?.serviceSelection || {};
  const candidates = [selection.price, selection.hourly_rate, selection.priceFixed];
  const picked = candidates.map((value) => Number(value)).find((value) => Number.isFinite(value) && value > 0);
  return picked || 0;
};
const chatPreviewText = (text = '') => {
  if (String(text || '').startsWith('WORK_PROOF_RECEIPT::')) {
    return 'Work completion receipt sent';
  }
  if (String(text || '').startsWith('WORK_PROOF::')) {
    return 'Work completion proof sent';
  }
  const inquiryResponse = parseInquiryResponseCard(text);
  if (inquiryResponse) {
    return inquiryResponse.decision === 'accepted'
      ? `Inquiry accepted - PHP ${Number(inquiryResponse.quotedPrice || 0).toLocaleString('en-PH')}`
      : 'Inquiry rejected';
  }
  return String(text || 'No messages yet');
};
const parseDateFromBookingParts = (dateValue = '', timeValue = '') => {
  const datePart = String(dateValue || '').trim();
  const timePartRaw = String(timeValue || '').trim();
  if (!datePart || !timePartRaw) return null;

  const ampm = timePartRaw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  let hh = 0;
  let mm = 0;
  if (ampm) {
    hh = Number(ampm[1] || 0);
    mm = Number(ampm[2] || 0);
    const suffix = String(ampm[3] || '').toUpperCase();
    if (suffix === 'PM' && hh < 12) hh += 12;
    if (suffix === 'AM' && hh === 12) hh = 0;
  } else {
    const h24 = timePartRaw.match(/^(\d{1,2}):(\d{2})$/);
    if (!h24) return null;
    hh = Number(h24[1] || 0);
    mm = Number(h24[2] || 0);
  }
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const normalized = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  const parsed = new Date(`${datePart}T${normalized}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const parseScheduledAtValue = (jobOrBooking) => {
  const direct = jobOrBooking?.scheduledAt ? new Date(jobOrBooking.scheduledAt) : null;
  if (direct && !Number.isNaN(direct.getTime())) return direct;
  return parseDateFromBookingParts(jobOrBooking?.appointment?.bookingDate, jobOrBooking?.appointment?.bookingTime);
};

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

export default function NearMeProviderDashboard({ focusSection = null }) {
  const [user, setUser] = useState(() => getStoredNearMeUser());
  const [available, setAvailable] = useState(true);
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
    coordinates: null,
    availabilityDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    workingHours: { start: '08:00', end: '18:00' },
    availabilityOverrides: {},
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [providerBookings, setProviderBookings] = useState([]);
  const [providerConversations, setProviderConversations] = useState([]);
  const [providerReviews, setProviderReviews] = useState([]);
  const [providerJobs, setProviderJobs] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmAction, setConfirmAction] = useState({ open: false, title: '', message: '', confirmLabel: '', action: null, busy: false });
  const [doneModal, setDoneModal] = useState({ open: false, job: null });
  const [doneForm, setDoneForm] = useState({ summary: '', files: [] });
  const [submittingDone, setSubmittingDone] = useState(false);
  const [acceptingInquiryId, setAcceptingInquiryId] = useState('');
  const [inquiryQuoteModal, setInquiryQuoteModal] = useState({ open: false, conversation: null, inquiry: null });
  const [inquiryQuoteForm, setInquiryQuoteForm] = useState({ price: '', inclusions: '', breakdown: '', description: '' });
  const [calendarDetail, setCalendarDetail] = useState({ open: false, date: null, jobs: [], dayMeta: null });
  const [bookingDetail, setBookingDetail] = useState({ open: false, booking: null });
  const [workTab, setWorkTab] = useState('calendar');
  const isOverview = !focusSection;
  const isCalendarView = isOverview || focusSection === 'calendar';
  const isBookingsView = isOverview || focusSection === 'bookings';
  const isChatView = isOverview || focusSection === 'chat-history';
  const isPricingView = isOverview || focusSection === 'pricing';
  const isReviewsView = isOverview || focusSection === 'reviews';
  const isSettingsView = isOverview || focusSection === 'settings';
  const isFocusedView = !isOverview;
  const showCalendarPanel = isOverview ? workTab === 'calendar' : focusSection === 'calendar';
  const showChatPanel = isOverview ? workTab === 'chat' : focusSection === 'chat-history';
  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [serviceTab, setServiceTab] = useState('fixed');
  const [livePreview, setLivePreview] = useState(false);
  const [fixedServices, setFixedServices] = useState([]);
  const [bundlePlans, setBundlePlans] = useState([]);
  const [editingFixedId, setEditingFixedId] = useState('');
  const [editingBundleId, setEditingBundleId] = useState('');
  const [newInclusion, setNewInclusion] = useState('');
  const [fixedForm, setFixedForm] = useState({
    title: '',
    category: '',
    price: '',
    durationHours: '0',
    durationMinutes: '30',
    description: '',
    active: true,
  });
  const [bundleForm, setBundleForm] = useState({
    name: '',
    description: '',
    price: '',
    durationDays: '7',
    inclusions: [],
    active: true,
  });
  const [fixedErrors, setFixedErrors] = useState({});
  const [bundleErrors, setBundleErrors] = useState({});
  const [serviceBusy, setServiceBusy] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([{ value: 'other', label: 'Others' }]);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [fixedCustomCategoryInput, setFixedCustomCategoryInput] = useState('');
  const [tagCustomCategoryInput, setTagCustomCategoryInput] = useState('');
  const [settingsCategoryPickerValue, setSettingsCategoryPickerValue] = useState('');
  const [fixedCategoryPickerValue, setFixedCategoryPickerValue] = useState('');
  const [customFixedCategoryInput, setCustomFixedCategoryInput] = useState('');
  const [tagPickerValue, setTagPickerValue] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');
  const [certPickerValue, setCertPickerValue] = useState('');
  const triggerRefresh = () => setRefreshKey((current) => current + 1);
  const closeConfirmAction = () => setConfirmAction({ open: false, title: '', message: '', confirmLabel: '', action: null, busy: false });
  const openConfirmAction = ({ title, message, confirmLabel = 'Confirm', action }) => {
    setConfirmAction({ open: true, title, message, confirmLabel, action, busy: false });
  };
  const runConfirmAction = async () => {
    if (confirmAction.busy || typeof confirmAction.action !== 'function') return;
    setConfirmAction((current) => ({ ...current, busy: true }));
    try {
      await confirmAction.action();
      closeConfirmAction();
    } catch (error) {
      toast.error(error.message || 'Could not complete action');
      setConfirmAction((current) => ({ ...current, busy: false }));
    }
  };

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

  useEffect(() => {
    if (focusSection === 'chat-history') setWorkTab('chat');
    if (focusSection === 'calendar') setWorkTab('calendar');
  }, [focusSection]);

  const firstName = useMemo(() => user?.fname || user?.name?.split(' ')?.[0] || 'Provider', [user]);
  const categoryDropdownOptions = useMemo(() => {
    const map = new Map((categoryOptions || []).map((item) => [item.value, item]));
    if (settingsForm.serviceId && settingsForm.service && !map.has(settingsForm.serviceId)) {
      map.set(settingsForm.serviceId, {
        value: settingsForm.serviceId,
        label: toTitleCase(settingsForm.service),
      });
    }
    if (!map.has('other')) map.set('other', { value: 'other', label: 'Others' });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [categoryOptions, settingsForm.serviceId, settingsForm.service]);

  useEffect(() => {
    if (!user?.id) return;

    setProfileLoading(true);
    apiRequest(`/api/providers/me?userId=${encodeURIComponent(user.id)}`)
      .then((profile) => {
        const merged = { ...emptyProviderProfile, ...profile };
        setProviderProfile(merged);
        setAvailable(Boolean(merged.available));
        setSettingsForm({
          name: merged.name || '',
          service: merged.service || '',
          serviceId: merged.serviceId || 'other',
          rate: Number(merged.rate || 0),
          location: merged.location || '',
          serviceArea: merged.serviceArea || '',
          bio: merged.bio || '',
          tags: listToText(Array.isArray(merged.tags) && merged.tags.length > 0 ? merged.tags : (merged.service ? [merged.service] : [])),
          certifications: listToText(merged.certifications),
          gallery: listToText(merged.gallery),
          avatar: merged.avatar || '',
          coordinates: merged.coordinates || null,
          availabilityDays: Array.isArray(merged.availabilityDays) && merged.availabilityDays.length > 0 ? merged.availabilityDays : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
          workingHours: {
            start: merged.workingHours?.start || '08:00',
            end: merged.workingHours?.end || '18:00',
          },
          availabilityOverrides: merged.availabilityOverrides && typeof merged.availabilityOverrides === 'object' ? merged.availabilityOverrides : {},
        });
      })
      .catch((error) => toast.error(error.message || 'Could not load provider settings'))
      .finally(() => setProfileLoading(false));
  }, [user?.id, refreshKey]);

  useEffect(() => {
    const providerId = providerPublicId(providerProfile);
    if (!providerId || profileLoading) return;

    const providerUserIdCandidates = Array.from(new Set([
      String(user?.id || '').trim(),
      String(user?._id || '').trim(),
    ].filter(Boolean)));
    const providerIdCandidates = Array.from(new Set([
      String(providerProfile?.id || '').trim(),
      String(providerProfile?._id || '').trim(),
      String(providerPublicId(providerProfile) || '').trim(),
    ].filter(Boolean)));

    Promise.all([
      apiRequest(`/api/bookings?providerId=${encodeURIComponent(providerId)}`).catch(() => []),
      apiRequest('/api/conversations').catch(() => []),
      apiRequest(`/api/providers/${encodeURIComponent(providerId)}/reviews`).catch(() => []),
      apiRequest('/api/v1/jobs').catch(() => []),
      apiRequest(`/api/v1/provider-services?providerUserId=${encodeURIComponent(user?.id || user?._id || '')}`).catch(() => []),
      apiRequest(`/api/v1/custom-packages?providerId=${encodeURIComponent(user?.id || user?._id || '')}`).catch(() => []),
      apiRequest('/api/services').catch(() => []),
    ]).then(([bookingData, conversationData, reviewData, jobsData, servicesData, bundlesData, categoriesData]) => {
      setProviderBookings(Array.isArray(bookingData) ? bookingData : []);
      setProviderConversations(Array.isArray(conversationData) ? conversationData : []);
      setProviderReviews(Array.isArray(reviewData) ? reviewData : []);
      setProviderJobs(
        Array.isArray(jobsData)
          ? jobsData.filter((job) => {
              const providerUserId = String(job.providerUserId || '').trim();
              const providerId = String(job.providerId || '').trim();
              const providerObjectId = String(job.providerObjectId || '').trim();
              return providerUserIdCandidates.includes(providerUserId)
                || providerIdCandidates.includes(providerId)
                || providerIdCandidates.includes(providerObjectId);
            })
          : []
      );
      setFixedServices(Array.isArray(servicesData) ? servicesData : []);
      setBundlePlans(Array.isArray(bundlesData) ? bundlesData : []);
      const categoryMap = new Map();
      (Array.isArray(categoriesData) ? categoriesData : []).forEach((item) => {
        const value = String(item.id || item.serviceId || item.slug || slugify(item.label || item.name || '')).trim();
        const label = toTitleCase(item.label || item.name || item.id || item.serviceId || '');
        if (value && label && !categoryMap.has(value)) {
          categoryMap.set(value, { value, label });
        }
      });
      if (providerProfile.serviceId && providerProfile.service) {
        categoryMap.set(String(providerProfile.serviceId), { value: String(providerProfile.serviceId), label: toTitleCase(providerProfile.service) });
      }
      categoryMap.set('other', { value: 'other', label: 'Others' });
      setCategoryOptions(Array.from(categoryMap.values()).sort((a, b) => a.label.localeCompare(b.label)));
    });
  }, [providerProfile.id, providerProfile._id, profileLoading, user?.id, user?._id, refreshKey]);

  useEffect(() => {
    const userIdCandidates = Array.from(new Set([
      String(user?.id || '').trim(),
      String(user?._id || '').trim(),
    ].filter(Boolean)));
    if (userIdCandidates.length === 0) return undefined;
    const joinUserId = userIdCandidates[0];
    const socket = getSocket();
    socket.emit('join:user', joinUserId);

    const upsertProviderJob = (job) => {
      if (!job) return;
      if (!userIdCandidates.includes(String(job?.providerUserId || '').trim())) return;
      setProviderJobs((current) => {
        const exists = current.some((item) => String(item?._id || '') === String(job?._id || ''));
        if (exists) return current.map((item) => (String(item?._id || '') === String(job?._id || '') ? job : item));
        return [job, ...current];
      });
    };

    socket.on('job:created', upsertProviderJob);
    socket.on('job:accepted', upsertProviderJob);
    socket.on('job:started', upsertProviderJob);
    socket.on('job:pending-payment', upsertProviderJob);
    socket.on('job:completed', upsertProviderJob);
    socket.on('job:cancelled-to-inquiry', upsertProviderJob);

    return () => {
      socket.off('job:created', upsertProviderJob);
      socket.off('job:accepted', upsertProviderJob);
      socket.off('job:started', upsertProviderJob);
      socket.off('job:pending-payment', upsertProviderJob);
      socket.off('job:completed', upsertProviderJob);
      socket.off('job:cancelled-to-inquiry', upsertProviderJob);
    };
  }, [user?.id, user?._id]);

  useEffect(() => {
    const pendingCashlessIds = providerJobs
      .filter((job) => (
        String(job?.status || '').toLowerCase() === 'pending payment'
        && String(job?.payment?.cashless?.state || '').toLowerCase() === 'initiated'
      ))
      .map((job) => String(job._id || ''))
      .filter(Boolean);
    if (pendingCashlessIds.length === 0) return undefined;

    let mounted = true;
    const syncPendingCashless = async () => {
      const results = await Promise.all(
        pendingCashlessIds.map((jobId) => (
          apiRequest(`/api/v1/jobs/${jobId}/payment/cashless-sync`, { method: 'POST' }).catch(() => null)
        ))
      );
      if (!mounted) return;
      const completedById = new Map(
        results
          .map((result) => result?.job)
          .filter((job) => String(job?.status || '').toLowerCase() === 'completed')
          .map((job) => [String(job._id), job])
      );
      if (completedById.size > 0) {
        setProviderJobs((current) => current.map((job) => completedById.get(String(job._id)) || job));
      }
    };

    syncPendingCashless();
    const timer = setInterval(syncPendingCashless, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [providerJobs]);

  useEffect(() => {
    if (settingsForm.serviceId === 'other' && settingsForm.service) {
      setCustomCategoryInput(toTitleCase(settingsForm.service));
    }
  }, [settingsForm.serviceId, settingsForm.service]);

  const runJobAction = async (jobId, action, body = {}) => {
    try {
      const updated = await apiRequest(`/api/v1/jobs/${jobId}/${action}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setProviderJobs((current) => current.map((item) => (String(item._id) === String(updated._id) ? updated : item)));
      triggerRefresh();
      toast.success('Job updated');
      return updated;
    } catch (error) {
      toast.error(error.message || 'Could not update job');
      return null;
    }
  };
  const openMarkDoneModal = (job) => {
    setDoneForm({ summary: '', files: [] });
    setDoneModal({ open: true, job });
  };
  const closeMarkDoneModal = () => {
    setDoneModal({ open: false, job: null });
    setDoneForm({ summary: '', files: [] });
  };
  const submitDoneWithProof = async () => {
    if (!doneModal.job?._id) return;
    if (!doneForm.summary.trim()) {
      toast.error('Work summary is required');
      return;
    }
    if (!Array.isArray(doneForm.files) || doneForm.files.length < 1) {
      toast.error('Upload at least one proof image');
      return;
    }
    setSubmittingDone(true);
    try {
      const uploadedUrls = [];
      for (const file of doneForm.files) {
        // sequential upload to keep backend load predictable
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadImage(file, 'job-proof');
        uploadedUrls.push(url);
      }

      const grossPrice = Number(doneModal.job?.financials?.grossPrice || doneModal.job?.quote?.grossPrice || 0);
      const platformFee = Number(doneModal.job?.financials?.platformFeeAmount || 0);
      const netPayout = Number(doneModal.job?.financials?.providerNetPayout || Math.max(0, grossPrice - platformFee));
      const receiptPayload = {
        type: 'work_completion_receipt',
        receiptNo: String(doneModal.job?.jobNumber || `NM-${String(doneModal.job?._id || '').slice(-8) || Date.now()}`),
        issuedAt: new Date().toISOString(),
        service: String(doneModal.job?.serviceId || providerProfile.service || 'Service'),
        summary: doneForm.summary.trim(),
        currency: 'PHP',
        proofImageCount: uploadedUrls.length,
        breakdown: [
          { label: 'Service Amount', amount: grossPrice },
          { label: 'Platform Fee', amount: platformFee },
          { label: 'Provider Net', amount: netPayout },
        ],
        totalDue: grossPrice,
      };
      const conversationId = doneModal.job.conversationId || doneModal.job.raw?.conversationId;
      if (conversationId) {
        await apiRequest(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            text: `WORK_PROOF_RECEIPT::${JSON.stringify(receiptPayload)}`,
            attachments: uploadedUrls,
          }),
        });
      }

      await runJobAction(doneModal.job._id, 'request-payment', {
        workSummary: doneForm.summary.trim(),
        proofUrls: uploadedUrls,
      });
      closeMarkDoneModal();
      toast.success('Work proof sent. Client has been asked to proceed with payment.');
    } catch (error) {
      toast.error(error.message || 'Could not submit work proof');
    } finally {
      setSubmittingDone(false);
    }
  };

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
  const bookingQueueRows = useMemo(() => {
    const normalizeDate = (value) => {
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? date : null;
    };

    const conversationCustomerByUserId = new Map(
      (providerConversations || [])
        .map((conversation) => [String(conversation.customerUserId || ''), conversation.customer?.name || ''])
        .filter(([id]) => Boolean(id))
    );

    const rowsFromJobs = (providerJobs || []).map((job) => {
      const scheduledAt = parseScheduledAtValue(job) || normalizeDate(job.scheduledAt);
      const resolvedCustomerName = String(
        job.clientName
        || job.customerName
        || conversationCustomerByUserId.get(String(job.clientUserId || ''))
        || ''
      ).trim();
      return {
        key: `job:${String(job._id || Math.random().toString(36).slice(2))}`,
        source: 'job',
        sourceId: String(job._id || ''),
        customerName: resolvedCustomerName || 'Customer',
        service: job.serviceId || providerProfile.service || 'Service',
        scheduledAt,
        rate: Number(job.financials?.grossPrice || job.quote?.grossPrice || 0),
        status: job.status || 'Accepted',
        raw: job,
      };
    });

    const rowsFromLegacyBookings = (providerBookings || []).map((booking) => {
      const scheduledAt = normalizeDate(booking.scheduledAt);
      return {
        key: `booking:${String(booking._id || Math.random().toString(36).slice(2))}`,
        source: 'booking',
        sourceId: String(booking._id || ''),
        customerName: booking.customerName || 'Customer',
        service: booking.service || providerProfile.service || 'Service',
        scheduledAt,
        rate: Number(booking.rate || 0),
        status: booking.status || 'pending',
        raw: booking,
      };
    });

    const merged = new Map();
    rowsFromJobs.forEach((row) => {
      merged.set(row.key, row);
    });
    rowsFromLegacyBookings.forEach((row) => {
      if (!merged.has(row.key)) {
        merged.set(row.key, row);
      }
    });

    return Array.from(merged.values()).sort((a, b) => {
      const at = a.scheduledAt ? a.scheduledAt.getTime() : 0;
      const bt = b.scheduledAt ? b.scheduledAt.getTime() : 0;
      return bt - at;
    });
  }, [providerJobs, providerBookings, providerProfile.service, providerConversations]);
  const hasTimeCollision = (scheduledAt, currentKey = '') => {
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) return false;
    const targetTime = new Date(scheduledAt).getTime();
    return bookingQueueRows.some((row) => {
      if (currentKey && String(row.key) === String(currentKey)) return false;
      const rowTime = row?.scheduledAt ? new Date(row.scheduledAt).getTime() : NaN;
      if (Number.isNaN(rowTime)) return false;
      const status = String(row?.status || '').toLowerCase();
      const isActive = [
        'accepted',
        'in progress',
        'pending payment',
        'pending verification',
        'provider_accepted',
        'customer_confirmed',
        'in_progress',
      ].includes(status);
      return isActive && rowTime === targetTime;
    });
  };
  const acceptBookingRequest = async (bookingRow) => {
    if (!bookingRow?.sourceId) return;
    if (hasTimeCollision(bookingRow.scheduledAt, bookingRow.key)) {
      toast.error('Schedule collision detected. Please adjust to another timeslot.');
      return;
    }
    try {
      const updated = await apiRequest(`/api/bookings/${bookingRow.sourceId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'provider_accepted',
          by: 'provider',
          note: 'Accepted from state-driven job controls',
        }),
      });
      setProviderBookings((current) => current.map((item) => (
        String(item._id) === String(updated?._id) ? updated : item
      )));
      toast.success('Booking accepted and added to active queue');
    } catch (error) {
      toast.error(error.message || 'Could not accept booking');
    }
  };

  const todayBookings = bookingQueueRows.filter((booking) => {
    const date = new Date(booking.scheduledAt);
    const today = new Date();
    return !Number.isNaN(date.getTime()) && date.toDateString() === today.toDateString();
  });
  const weeklyEarnings = bookingQueueRows
    .filter((booking) => ['completed', 'reviewed', 'Completed'].includes(booking.status))
    .reduce((sum, booking) => sum + Number(booking.rate || 0), 0);
  const getQueueActionState = (row) => {
    if (row.source !== 'job' || !row.raw?._id) return { type: 'none', label: '' };
    const status = String(row.status || '').toLowerCase();
    if (status === 'accepted') return { type: 'start', label: 'Not Started' };
    if (status === 'in progress') return { type: 'done', label: 'In Progress' };
    if (status === 'pending payment') return { type: 'cashPaid', label: 'Pending Payment' };
    if (status === 'completed') return { type: 'doneState', label: 'Paid' };
    return { type: 'none', label: row.status || 'N/A' };
  };
  const inquiryRequests = useMemo(() => (
    providerConversations
      .map((conversation) => {
        const inquiry = parseInquiryCard(conversation.lastMessage || '');
        if (!inquiry) return null;
        return { conversation, inquiry };
      })
      .filter(Boolean)
  ), [providerConversations]);

  const nonInquiryConversations = useMemo(() => (
    providerConversations.filter((conversation) => !parseInquiryCard(conversation.lastMessage || ''))
  ), [providerConversations]);

  const openInquiryQuote = (conversation, inquiry) => {
    setInquiryQuoteForm({ price: '', inclusions: '', breakdown: '', description: '' });
    setInquiryQuoteModal({ open: true, conversation, inquiry });
  };

  const closeInquiryQuote = () => {
    setInquiryQuoteModal({ open: false, conversation: null, inquiry: null });
    setInquiryQuoteForm({ price: '', inclusions: '', breakdown: '', description: '' });
  };

  const acceptInquiryRequest = async ({ conversation, inquiry, quotedPrice = null, quoteBreakdown = '', quoteInclusions = [], quoteDescription = '' }) => {
    if (acceptingInquiryId) return;
    setAcceptingInquiryId(String(conversation?._id || 'pending'));
    try {
      const selectedPrice = getSelectedPrice(inquiry);
      const resolvedQuotedPrice = Number.isFinite(Number(quotedPrice)) && Number(quotedPrice) > 0 ? Number(quotedPrice) : selectedPrice;
      const payload = {
        clientUserId: conversation.customerUserId,
        providerId: providerPublicId(providerProfile),
        serviceCategory: inquiry.serviceCategory,
        bookingDate: inquiry.bookingDate,
        bookingTime: inquiry.bookingTime,
        address: inquiry.address,
        notes: inquiry.notes || '',
        inquiryMessageId: conversation.lastMessageId || inquiry.inquiryId || null,
        conversationId: conversation._id,
        inquiryPayload: inquiry,
        quotedPrice: resolvedQuotedPrice > 0 ? resolvedQuotedPrice : null,
        quoteBreakdown: String(quoteBreakdown || '').trim(),
        quoteInclusions: Array.isArray(quoteInclusions) ? quoteInclusions : [],
        quoteDescription: String(quoteDescription || '').trim(),
      };
      let created;
      try {
        created = await apiRequest('/api/v1/jobs/accept-inquiry', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (error) {
        if (!String(error.message || '').includes('Cannot POST')) throw error;
        created = await apiRequest('/api/jobs/accept-inquiry', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setProviderJobs((current) => {
        const exists = current.some((item) => String(item._id) === String(created?._id));
        if (exists) return current;
        return [created, ...current];
      });
      const responseText = `INQUIRY_RESPONSE::${JSON.stringify({
        inquiryMessageId: payload.inquiryMessageId || String(inquiry?.inquiryId || ''),
        decision: 'accepted',
        serviceCategory: inquiry?.serviceCategory || 'other',
        quotedPrice: resolvedQuotedPrice > 0 ? resolvedQuotedPrice : 0,
        currency: 'PHP',
        inclusions: Array.isArray(quoteInclusions) ? quoteInclusions : [],
        breakdown: String(quoteBreakdown || '').trim() || (resolvedQuotedPrice > 0 ? `Quoted price: PHP ${resolvedQuotedPrice.toLocaleString('en-PH')}` : 'Accepted'),
        description: String(quoteDescription || '').trim(),
      })}`;
      await apiRequest(`/api/conversations/${conversation._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: responseText }),
      });
      triggerRefresh();
      toast.success('Inquiry accepted and added to your calendar');
      return true;
    } catch (error) {
      const message = String(error.message || '');
      if (message.includes('COLLISION_DETECTED')) {
        toast.error('Schedule collision detected. Adjust to another time before accepting.');
        return false;
      }
      if (message.includes('OUTSIDE_PROVIDER_AVAILABILITY')) {
        toast.error('This request is on an off-day based on your availability settings.');
        return false;
      }
      if (message.includes('OUTSIDE_PROVIDER_WORKING_HOURS')) {
        toast.error('This request time is outside your configured working hours.');
        return false;
      }
      toast.error(error.message || 'Could not accept inquiry');
      return false;
    } finally {
      setAcceptingInquiryId('');
    }
  };

  const submitInquiryQuote = async () => {
    if (!inquiryQuoteModal.conversation || !inquiryQuoteModal.inquiry) return;
    const price = Number(inquiryQuoteForm.price);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Please enter a valid quoted price.');
      return;
    }
    if (!inquiryQuoteForm.breakdown.trim()) {
      toast.error('Please add a price breakdown.');
      return;
    }
    const inclusions = inquiryQuoteForm.inclusions
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const accepted = await acceptInquiryRequest({
      conversation: inquiryQuoteModal.conversation,
      inquiry: inquiryQuoteModal.inquiry,
      quotedPrice: price,
      quoteBreakdown: inquiryQuoteForm.breakdown.trim(),
      quoteInclusions: inclusions,
      quoteDescription: inquiryQuoteForm.description.trim(),
    });
    if (accepted) closeInquiryQuote();
  };

  const evaluateInquiryAvailability = (inquiry) => {
    const bookingDate = String(inquiry?.bookingDate || '').trim();
    const bookingTime = String(inquiry?.bookingTime || '').trim();
    if (!bookingDate || !bookingTime) return { ok: true, reason: '' };
    const scheduledAt = new Date(`${bookingDate}T${bookingTime}:00`);
    if (Number.isNaN(scheduledAt.getTime())) return { ok: true, reason: '' };

    const dateKey = scheduledAt.toISOString().slice(0, 10);
    const dayKey = weekdayKeys[scheduledAt.getDay()];
    const override = settingsForm.availabilityOverrides?.[dateKey];
    const availableByDay = override ? override.available !== false : (settingsForm.availabilityDays || []).includes(dayKey);
    if (!availableByDay) {
      return { ok: false, reason: 'Off day based on your availability settings' };
    }

    const start = String(override?.start || settingsForm.workingHours?.start || '08:00');
    const end = String(override?.end || settingsForm.workingHours?.end || '18:00');
    const [startHour, startMinute] = start.split(':').map((item) => Number(item || 0));
    const [endHour, endMinute] = end.split(':').map((item) => Number(item || 0));
    const minutes = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
    const startTotal = (startHour * 60) + startMinute;
    const endTotal = (endHour * 60) + endMinute;
    if (minutes < startTotal || minutes > endTotal) {
      return { ok: false, reason: `Outside working hours (${start}-${end})` };
    }

    return { ok: true, reason: '' };
  };


  const scheduledJobs = useMemo(() => (
    bookingQueueRows
      .filter((row) => row?.scheduledAt && !Number.isNaN(new Date(row.scheduledAt).getTime()))
      .filter((row) => !['cancelled', 'rejected'].includes(String(row.status || '').toLowerCase()))
      .map((row) => ({
        _id: row.sourceId || row.key,
        source: row.source,
        serviceId: row.service || providerProfile.service || 'Service',
        status: row.status || 'Requested',
        scheduledAt: row.scheduledAt,
        scheduledAtDate: new Date(row.scheduledAt),
        customerName: row.customerName || 'Customer',
        raw: row.raw,
      }))
  ), [bookingQueueRows, providerProfile.service]);
  const isWorkingDay = (date) => {
    const dateObj = new Date(date);
    const dateKey = dateObj.toISOString().slice(0, 10);
    const override = settingsForm.availabilityOverrides?.[dateKey];
    if (override) return override.available !== false;
    const key = weekdayKeys[dateObj.getDay()];
    return (settingsForm.availabilityDays || []).includes(key);
  };
  const isWithinWorkingHours = (date) => {
    const dateObj = new Date(date);
    const dateKey = dateObj.toISOString().slice(0, 10);
    const override = settingsForm.availabilityOverrides?.[dateKey];
    const start = String(override?.start || settingsForm.workingHours?.start || '08:00');
    const end = String(override?.end || settingsForm.workingHours?.end || '18:00');
    const [startHour, startMinute] = start.split(':').map((value) => Number(value || 0));
    const [endHour, endMinute] = end.split(':').map((value) => Number(value || 0));
    const minutes = dateObj.getHours() * 60 + dateObj.getMinutes();
    const startTotal = (startHour * 60) + startMinute;
    const endTotal = (endHour * 60) + endMinute;
    return minutes >= startTotal && minutes <= endTotal;
  };

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay.getDay();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - startOffset + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      const date = new Date(year, month, dayNumber);
      const dayJobs = scheduledJobs.filter((job) => (
        job.scheduledAtDate.getFullYear() === date.getFullYear()
        && job.scheduledAtDate.getMonth() === date.getMonth()
        && job.scheduledAtDate.getDate() === date.getDate()
      ));
      const availableDay = isWorkingDay(date);
      const outOfHoursJobs = dayJobs.filter((job) => !isWithinWorkingHours(job.scheduledAtDate));
      const dateKey = date.toISOString().slice(0, 10);
      const override = settingsForm.availabilityOverrides?.[dateKey] || null;
      const effectiveStart = override?.start || settingsForm.workingHours?.start || '08:00';
      const effectiveEnd = override?.end || settingsForm.workingHours?.end || '18:00';
      return { date, dayNumber, jobs: dayJobs, availableDay, outOfHoursJobs, dateKey, override, effectiveStart, effectiveEnd };
    });
  }, [calendarDate, scheduledJobs, settingsForm.availabilityDays, settingsForm.workingHours, settingsForm.availabilityOverrides]);

  const updateSetting = (field, value) => {
    setSettingsForm((current) => ({ ...current, [field]: value }));
  };
  const saveAvailabilityConfig = async (nextPatch) => {
    if (!providerPublicId(providerProfile)) return false;
    try {
      const updated = await apiRequest(`/api/providers/${providerPublicId(providerProfile)}`, {
        method: 'PATCH',
        body: JSON.stringify(nextPatch),
      });
      setProviderProfile((current) => ({ ...current, ...updated }));
      setSettingsForm((current) => ({
        ...current,
        availabilityDays: Array.isArray(updated.availabilityDays) && updated.availabilityDays.length > 0 ? updated.availabilityDays : current.availabilityDays,
        workingHours: updated.workingHours || current.workingHours,
        availabilityOverrides: updated.availabilityOverrides && typeof updated.availabilityOverrides === 'object' ? updated.availabilityOverrides : current.availabilityOverrides,
      }));
      triggerRefresh();
      return true;
    } catch (error) {
      toast.error(error.message || 'Could not save availability');
      return false;
    }
  };
  const selectedProviderCategories = useMemo(() => textToList(settingsForm.tags), [settingsForm.tags]);
  const selectedCertifications = useMemo(() => textToList(settingsForm.certifications), [settingsForm.certifications]);
  const selectedFixedCategories = useMemo(() => textToList(fixedForm.category), [fixedForm.category]);
  const addFixedCategory = () => {
    const next = toTitleCase(fixedCategoryPickerValue);
    if (!next) return;
    const merged = Array.from(new Set([...selectedFixedCategories, next]));
    setFixedForm((current) => ({ ...current, category: merged.join(', ') }));
    setFixedCategoryPickerValue('');
  };
  const removeFixedCategory = (value) => {
    const filtered = selectedFixedCategories.filter((item) => item !== value);
    setFixedForm((current) => ({ ...current, category: filtered.join(', ') }));
  };
  const addProviderCategory = () => {
    if (settingsCategoryPickerValue === 'other') {
      if (customCategoryInput.trim()) {
        addCustomProviderCategory();
      }
      updateSetting('serviceId', 'other');
      return;
    }
    const selected = categoryDropdownOptions.find((item) => item.value === settingsCategoryPickerValue);
    const next = toTitleCase(selected?.label || '');
    if (!next) return;
    const merged = Array.from(new Set([...selectedProviderCategories, next]));
    updateSetting('tags', merged.join(', '));
    if (!settingsForm.service || settingsForm.serviceId === 'other') {
      updateSetting('service', next);
      updateSetting('serviceId', selected?.value || slugify(next));
    }
    setSettingsCategoryPickerValue('');
  };
  const addCustomProviderCategory = () => {
    const next = toTitleCase(customCategoryInput);
    if (!next) return;
    const merged = Array.from(new Set([...selectedProviderCategories, next]));
    updateSetting('tags', merged.join(', '));
    updateSetting('service', next);
    updateSetting('serviceId', slugify(next) || 'other');
    setCustomCategoryInput(next);
  };
  const addTag = () => {
    const next = toTitleCase(tagPickerValue);
    if (!next) return;
    const merged = Array.from(new Set([...selectedProviderCategories, next]));
    updateSetting('tags', merged.join(', '));
    setTagPickerValue('');
  };
  const removeTag = (value) => {
    const filtered = selectedProviderCategories.filter((item) => item !== value);
    updateSetting('tags', filtered.join(', '));
  };
  const removeProviderCategory = (value) => {
    const filtered = selectedProviderCategories.filter((item) => item !== value);
    updateSetting('tags', filtered.join(', '));
    if (toTitleCase(settingsForm.service) === toTitleCase(value)) {
      const fallback = filtered[0] || '';
      updateSetting('service', fallback);
      updateSetting('serviceId', fallback ? (categoryDropdownOptions.find((item) => toTitleCase(item.label) === toTitleCase(fallback))?.value || slugify(fallback)) : 'other');
    }
  };
  const addCertification = () => {
    const next = toTitleCase(certPickerValue);
    if (!next) return;
    const merged = Array.from(new Set([...selectedCertifications, next]));
    updateSetting('certifications', merged.join(', '));
    setCertPickerValue('');
  };
  const removeCertification = (value) => {
    const filtered = selectedCertifications.filter((item) => item !== value);
    updateSetting('certifications', filtered.join(', '));
  };
  const fixedDirty = Boolean(
    fixedForm.title.trim()
    || fixedForm.category.trim()
    || fixedForm.price
    || fixedForm.description.trim()
    || fixedForm.durationHours !== '0'
    || fixedForm.durationMinutes !== '30'
  );
  const bundleDirty = Boolean(
    bundleForm.name.trim()
    || bundleForm.description.trim()
    || bundleForm.price
    || bundleForm.durationDays !== '7'
    || bundleForm.inclusions.length > 0
  );
  const hasUnsavedServiceChanges = fixedDirty || bundleDirty;

  useEffect(() => {
    const warnIfDirty = (event) => {
      if (!hasUnsavedServiceChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnIfDirty);
    return () => window.removeEventListener('beforeunload', warnIfDirty);
  }, [hasUnsavedServiceChanges]);

  const validateFixedForm = () => {
    const errors = {};
    const title = fixedForm.title.trim();
    if (title.length < 5 || title.length > 50) errors.title = 'Service title must be 5 to 50 characters.';
    if (!fixedForm.category.trim()) errors.category = 'Category is required.';
    const price = Number(fixedForm.price);
    if (!Number.isFinite(price) || price < 1) errors.price = 'Price must be greater than PHP 1.';
    const hours = Number(fixedForm.durationHours);
    const minutes = Number(fixedForm.durationMinutes);
    if ((hours === 0 && minutes === 0) || !Number.isFinite(hours) || !Number.isFinite(minutes)) errors.duration = 'Duration cannot be 0 hours and 0 minutes.';
    if (!fixedForm.description.trim()) errors.description = 'Service description is required.';
    setFixedErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateBundleForm = () => {
    const errors = {};
    if (bundleForm.name.trim().length < 5 || bundleForm.name.trim().length > 80) errors.name = 'Plan name must be 5 to 80 characters.';
    if (!bundleForm.description.trim()) errors.description = 'Plan description is required.';
    const price = Number(bundleForm.price);
    if (!Number.isFinite(price) || price < 1000) errors.price = 'Package price must be at least PHP 1,000.';
    const durationDays = Number(bundleForm.durationDays);
    if (![7, 14, 30].includes(durationDays)) errors.durationDays = 'Duration must be 7, 14, or 30 days.';
    if (!Array.isArray(bundleForm.inclusions) || bundleForm.inclusions.length < 1) errors.inclusions = 'Add at least one inclusion item.';
    setBundleErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetFixedForm = () => {
    setEditingFixedId('');
    setFixedForm({
      title: '',
      category: providerProfile.serviceId || 'other',
      price: '',
      durationHours: '0',
      durationMinutes: '30',
      description: '',
      active: true,
    });
    setFixedErrors({});
  };

  const resetBundleForm = () => {
    setEditingBundleId('');
    setNewInclusion('');
    setBundleForm({
      name: '',
      description: '',
      price: '',
      durationDays: '7',
      inclusions: [],
      active: true,
    });
    setBundleErrors({});
  };

  const saveFixedService = async () => {
    if (!validateFixedForm()) return;
    setServiceBusy(true);
    try {
      const payload = {
        title: fixedForm.title.trim(),
        category: fixedForm.category.trim(),
        price: Number(fixedForm.price),
        durationHours: Number(fixedForm.durationHours),
        durationMinutes: Number(fixedForm.durationMinutes),
        description: fixedForm.description.trim(),
        active: Boolean(fixedForm.active),
      };
      const saved = editingFixedId
        ? await apiRequest(`/api/v1/provider-services/${editingFixedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiRequest('/api/v1/provider-services', { method: 'POST', body: JSON.stringify(payload) });
      setFixedServices((current) => {
        if (editingFixedId) return current.map((item) => (String(item._id) === String(saved._id) ? saved : item));
        return [saved, ...current];
      });
      toast.success(`Service ${editingFixedId ? 'updated' : 'created'}`);
      resetFixedForm();
      triggerRefresh();
    } catch (error) {
      toast.error(error.message || 'Could not save service');
    } finally {
      setServiceBusy(false);
    }
  };

  const saveBundlePlan = async () => {
    if (!validateBundleForm()) return;
    setServiceBusy(true);
    try {
      const payload = {
        serviceId: providerProfile.serviceId || 'other',
        providerId: user?.id || user?._id,
        title: bundleForm.name.trim(),
        description: bundleForm.description.trim(),
        priceFixed: Number(bundleForm.price),
        durationWeeks: Math.max(1, Math.round(Number(bundleForm.durationDays) / 7)),
        visitCount: 0,
        scope: {},
        terms: { durationDays: Number(bundleForm.durationDays) },
        inclusions: bundleForm.inclusions,
        active: Boolean(bundleForm.active),
      };
      const saved = editingBundleId
        ? await apiRequest(`/api/v1/custom-packages/${editingBundleId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiRequest('/api/v1/custom-packages', { method: 'POST', body: JSON.stringify(payload) });
      setBundlePlans((current) => {
        if (editingBundleId) return current.map((item) => (String(item._id) === String(saved._id) ? saved : item));
        return [saved, ...current];
      });
      toast.success(`Bundle ${editingBundleId ? 'updated' : 'created'}`);
      resetBundleForm();
      triggerRefresh();
    } catch (error) {
      toast.error(error.message || 'Could not save bundle');
    } finally {
      setServiceBusy(false);
    }
  };

  const toggleFixedActive = async (item) => {
    try {
      const updated = await apiRequest(`/api/v1/provider-services/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      });
      setFixedServices((current) => current.map((service) => (String(service._id) === String(updated._id) ? updated : service)));
      triggerRefresh();
    } catch (error) {
      toast.error(error.message || 'Could not update service');
    }
  };

  const toggleBundleActive = async (item) => {
    try {
      const updated = await apiRequest(`/api/v1/custom-packages/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      });
      setBundlePlans((current) => current.map((plan) => (String(plan._id) === String(updated._id) ? updated : plan)));
      triggerRefresh();
    } catch (error) {
      toast.error(error.message || 'Could not update bundle');
    }
  };

  const deleteFixedService = (item) => {
    openConfirmAction({
      title: 'Delete Fixed Service',
      message: `Delete "${item.title || 'this service'}"? This action cannot be undone.`,
      confirmLabel: 'Delete Service',
      action: async () => {
        await apiRequest(`/api/v1/provider-services/${item._id}`, { method: 'DELETE' });
        setFixedServices((current) => current.filter((service) => String(service._id) !== String(item._id)));
        triggerRefresh();
        toast.success('Service deleted');
      },
    });
  };

  const deleteBundlePlan = (item) => {
    openConfirmAction({
      title: 'Delete Bundle Plan',
      message: `Delete "${item.title || 'this bundle'}"? This action cannot be undone.`,
      confirmLabel: 'Delete Bundle',
      action: async () => {
        await apiRequest(`/api/v1/custom-packages/${item._id}`, { method: 'DELETE' });
        setBundlePlans((current) => current.filter((plan) => String(plan._id) !== String(item._id)));
        triggerRefresh();
        toast.success('Bundle deleted');
      },
    });
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
    openConfirmAction({
      title: 'Remove Gallery Image',
      message: 'This photo will be removed from your profile gallery after you save settings.',
      confirmLabel: 'Remove Photo',
      action: async () => {
        setSettingsForm((current) => ({
          ...current,
          gallery: listToText(textToList(current.gallery).filter((item) => item !== url)),
        }));
      },
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported on this browser');
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setDetectingLocation(false);
          toast.error('Could not detect your location');
          return;
        }

        const locationText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);
          const data = await response.json();
          const address = data?.address || {};
          const city = address.city || address.town || address.municipality || address.village || address.suburb || '';
          const region = address.state || address.region || address.county || '';
          const serviceArea = [city, region].filter(Boolean).join(', ') || city || region || data?.display_name?.split(',')?.slice(0, 2).join(',').trim() || locationText;

          setSettingsForm((current) => ({
            ...current,
            location: locationText,
            serviceArea,
            coordinates: { lat, lng },
          }));
          toast.success('Location detected and service area updated');
        } catch {
          setSettingsForm((current) => ({
            ...current,
            location: locationText,
            serviceArea: current.serviceArea || locationText,
            coordinates: { lat, lng },
          }));
          toast.success('Location detected');
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        setDetectingLocation(false);
        toast.error('Location access denied or unavailable');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
      triggerRefresh();
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
      const normalizedCustomCategory = toTitleCase(customCategoryInput);
      const baseCategories = Array.from(new Set(selectedProviderCategories.map((item) => toTitleCase(item)).filter(Boolean)));
      const providerCategories = (settingsForm.serviceId === 'other' && normalizedCustomCategory)
        ? Array.from(new Set([...baseCategories, normalizedCustomCategory]))
        : baseCategories;
      const serviceName = settingsForm.serviceId === 'other'
        ? normalizedCustomCategory || toTitleCase(settingsForm.service)
        : toTitleCase(providerCategories[0] || settingsForm.service || normalizedCustomCategory);
      const matched = categoryDropdownOptions.find((item) => toTitleCase(item.label) === serviceName);
      const serviceId = matched?.value || slugify(serviceName) || 'other';
      if (!serviceName) {
        toast.error('Please select a category or add one under Others.');
        setProfileSaving(false);
        return;
      }
      const payload = {
        name: settingsForm.name,
        service: serviceName,
        serviceId,
        location: settingsForm.location,
        coordinates: settingsForm.coordinates,
        serviceArea: settingsForm.serviceArea,
        bio: settingsForm.bio,
        tags: providerCategories,
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
      setSettingsForm((current) => ({
        ...current,
        service: serviceName,
        serviceId,
        tags: providerCategories.join(', '),
      }));
      mergeStoredNearMeUser({ avatar: merged.avatar || '' });
      triggerRefresh();
      toast.success('Provider profile updated');
    } catch (error) {
      toast.error(error.message || 'Could not save settings');
    } finally {
      setProfileSaving(false);
    }
  };

  const saveSingleDayAvailability = async () => {
    if (!calendarDetail.dayMeta?.dateKey) return;
    const dateKey = calendarDetail.dayMeta.dateKey;
    const nextOverrides = {
      ...(settingsForm.availabilityOverrides || {}),
      [dateKey]: {
        available: Boolean(calendarDetail.dayMeta.availableDay),
        start: calendarDetail.dayMeta.effectiveStart || settingsForm.workingHours?.start || '08:00',
        end: calendarDetail.dayMeta.effectiveEnd || settingsForm.workingHours?.end || '18:00',
      },
    };
    const ok = await saveAvailabilityConfig({ availabilityOverrides: nextOverrides });
    if (ok) toast.success('Day availability saved');
  };

  const clearSingleDayAvailability = async () => {
    if (!calendarDetail.dayMeta?.dateKey) return;
    const dateKey = calendarDetail.dayMeta.dateKey;
    const nextOverrides = { ...(settingsForm.availabilityOverrides || {}) };
    delete nextOverrides[dateKey];
    const ok = await saveAvailabilityConfig({ availabilityOverrides: nextOverrides });
    if (ok) toast.success('Day override cleared');
  };

  const saveDefaultAvailabilityFromCalendar = async () => {
    const start = String(settingsForm.workingHours?.start || '08:00');
    const end = String(settingsForm.workingHours?.end || '18:00');
    if (start >= end) {
      toast.error('Default hours are invalid. End time must be later than start time.');
      return;
    }
    const ok = await saveAvailabilityConfig({
      availabilityDays: Array.isArray(settingsForm.availabilityDays) ? settingsForm.availabilityDays : [],
      workingHours: { start, end },
    });
    if (ok) toast.success('Default availability saved');
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
              ['Dashboard', CalendarDays, '/provider-dashboard'],
              ['Calendar', Clock, '/provider-dashboard/calendar'],
              ['Bookings', FileCheck2, '/provider-dashboard/bookings'],
              ['Chat History', MessageSquareText, '/provider-dashboard/chat-history'],
              ['Pricing', WalletCards, '/provider-dashboard/pricing'],
              ['Reviews', Star, '/provider-dashboard/reviews'],
              ['Settings', Settings, '/provider-dashboard/settings'],
            ].map(([label, Icon, href]) => (
              <Link key={label} to={href} className="flex items-center gap-2 px-4 py-3 border-b-2 border-bauhaus-ink/10 font-bold text-xs uppercase tracking-wider text-bauhaus-ink hover:bg-bauhaus-yellow/30">
                <Icon className="h-4 w-4" />
                {label}
              </Link>
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

            {!isFocusedView && (
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
            )}

            {(isCalendarView || isChatView) && (
              <div className="space-y-3">
              {isOverview && (
                <div className="inline-flex border-2 border-bauhaus-ink bg-white">
                  <button
                    type="button"
                    onClick={() => setWorkTab('calendar')}
                    className={`px-4 py-2 font-black text-[10px] uppercase tracking-wider border-r-2 border-bauhaus-ink ${workTab === 'calendar' ? 'bg-bauhaus-yellow text-bauhaus-ink' : 'bg-white text-bauhaus-ink'}`}
                  >
                    Calendar
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkTab('chat')}
                    className={`px-4 py-2 font-black text-[10px] uppercase tracking-wider ${workTab === 'chat' ? 'bg-bauhaus-yellow text-bauhaus-ink' : 'bg-white text-bauhaus-ink'}`}
                  >
                    Chat History
                  </button>
                </div>
              )}

              {showCalendarPanel && (
                <Panel
                  title="Work Management Calendar"
                  icon={CalendarDays}
                  action={(
                    <div className="inline-flex items-center gap-2">
                      <button type="button" onClick={() => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="p-2 bg-white border-2 border-bauhaus-ink">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <div className="px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                        {calendarDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                      </div>
                      <button type="button" onClick={() => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="p-2 bg-white border-2 border-bauhaus-ink">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                >
                <div id="calendar" className="space-y-3">
                  <div className="grid grid-cols-7 gap-2">
                    {calendarWeekdays.map((day) => (
                      <div key={day} className="min-h-10 border-2 border-bauhaus-ink bg-white flex items-center justify-center font-black text-[10px] uppercase tracking-wider">
                        {day}
                      </div>
                    ))}
                    {calendarDays.map((entry, index) => (
                      <div
                        key={`${index}-${entry?.dayNumber || 'blank'}`}
                        className={`min-h-28 border-2 border-bauhaus-ink p-2 ${!entry ? 'bg-white' : entry.availableDay ? 'bg-[#eef7ea]' : 'bg-[#fdeaea]'} ${entry?.jobs?.length ? 'cursor-pointer hover:bg-bauhaus-canvas' : ''}`}
                        onClick={() => {
                          if (!entry) return;
                          setCalendarDetail({ open: true, date: entry.date, jobs: entry.jobs, dayMeta: entry });
                        }}
                      >
                        {entry ? (
                          <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-black text-xs text-bauhaus-ink">{entry.dayNumber}</div>
                              {entry.jobs.length > 0 && (
                                <span className="px-1.5 py-0.5 bg-bauhaus-blue text-white border border-bauhaus-ink font-black text-[9px] uppercase tracking-wider">
                                  {entry.jobs.length}
                                </span>
                              )}
                            </div>
                            <div className={`mt-0.5 inline-flex px-1.5 py-0.5 border border-bauhaus-ink font-black text-[8px] uppercase tracking-wider ${entry.availableDay ? 'bg-bauhaus-yellow text-bauhaus-ink' : 'bg-bauhaus-red text-white'}`}>
                              {entry.availableDay ? 'Available' : 'Off Day'}
                            </div>
                            <div className="mt-1 space-y-1">
                              {entry.jobs.slice(0, 2).map((job) => (
                                <div key={job._id} className={`px-1.5 py-1 border border-bauhaus-ink font-black text-[9px] uppercase tracking-tight truncate ${isWithinWorkingHours(new Date(job.scheduledAt)) ? 'bg-bauhaus-yellow' : 'bg-bauhaus-red text-white'}`}>
                                  {new Date(job.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {job.serviceId || providerProfile.service}
                                </div>
                              ))}
                              {entry.jobs.length > 2 && (
                                <div className="font-black text-[9px] uppercase tracking-wider text-bauhaus-red">+{entry.jobs.length - 2} more - click to view</div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 border border-bauhaus-ink bg-[#eef7ea] font-black text-[9px] uppercase tracking-wider text-bauhaus-ink">Available Day</span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 border border-bauhaus-ink bg-[#fdeaea] font-black text-[9px] uppercase tracking-wider text-bauhaus-ink">Off Day</span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 border border-bauhaus-ink bg-bauhaus-yellow font-black text-[9px] uppercase tracking-wider text-bauhaus-ink">Within Working Hours</span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 border border-bauhaus-ink bg-bauhaus-red text-white font-black text-[9px] uppercase tracking-wider">Outside Working Hours</span>
                  </div>

                  {scheduledJobs.length === 0 && (
                    <div className="border-2 border-dashed border-bauhaus-ink bg-white p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">
                      No accepted appointments yet
                    </div>
                  )}
                </div>
                </Panel>
              )}

              {showChatPanel && (
                <Panel title="Chat History" icon={MessageSquareText}>
                <div id="chat-history" className="space-y-3">
                  {inquiryRequests.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Inquiry Requests</div>
                      {inquiryRequests.map(({ conversation, inquiry }) => (
                        <Link key={`inquiry-${conversation._id}`} to={`/messages?conversation=${encodeURIComponent(conversation._id)}`} className="block w-full min-w-0 overflow-hidden border-2 border-bauhaus-ink bg-white p-3 hover:bg-bauhaus-canvas transition-colors">
                          {(() => {
                            const availabilityCheck = evaluateInquiryAvailability(inquiry);
                            return !availabilityCheck.ok ? (
                              <div className="mb-2 inline-flex items-center gap-1 px-2 py-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[9px] uppercase tracking-wider">
                                <AlertTriangle className="h-3 w-3" />
                                {availabilityCheck.reason}
                              </div>
                            ) : null;
                          })()}
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 font-black text-xs uppercase tracking-tight text-bauhaus-ink truncate">{conversation.customer?.name || 'Customer'}</div>
                            <StatusPill tone="blue">Inquiry</StatusPill>
                          </div>
                          <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/50 truncate">
                            {inquiry.serviceCategory} - {inquiry.bookingDate} {inquiry.bookingTime}
                          </div>
                          <div className="mt-1 font-medium text-xs text-bauhaus-ink/65 truncate">{inquiry.address}</div>
                          <button
                            type="button"
                            disabled={acceptingInquiryId === String(conversation._id)}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isOtherInquiry(inquiry) && !isFixedOrBundleSelection(inquiry)) {
                                openInquiryQuote(conversation, inquiry);
                                return;
                              }
                              acceptInquiryRequest({ conversation, inquiry });
                            }}
                            className="mt-2 inline-flex items-center gap-1 px-3 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {acceptingInquiryId === String(conversation._id) ? 'Accepting...' : 'Accept'}
                          </button>
                        </Link>
                      ))}
                    </div>
                  )}

                  {nonInquiryConversations.slice(0, 4).map((chat) => (
                    <Link key={chat._id} to={`/messages?conversation=${encodeURIComponent(chat._id)}`} className="block w-full min-w-0 overflow-hidden text-left border-2 border-bauhaus-ink bg-bauhaus-canvas hover:bg-white p-3 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 font-black text-xs uppercase tracking-tight text-bauhaus-ink truncate">{chat.customer?.name || 'Customer'}</div>
                        <StatusPill tone={chat.status === 'Active Job' ? 'red' : 'blue'}>{chat.status}</StatusPill>
                      </div>
                      <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/45 truncate">{chat.provider?.service || providerProfile.service}</div>
                      <p className="mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-medium text-xs text-bauhaus-ink/60">{chatPreviewText(chat.lastMessage || '')}</p>
                    </Link>
                  ))}
                  {nonInquiryConversations.length === 0 && (
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
              )}
              </div>
            )}

            {isBookingsView && (
              <Panel title="Booking Queue" icon={FileCheck2}>
              <div id="bookings" className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead>
                    <tr className="bg-bauhaus-ink text-white">
                      {['Client', 'Service', 'Date', 'Time', 'Rate', 'Status', 'Action'].map((head) => (
                        <th key={head} className="px-3 py-3 text-left font-black text-[10px] uppercase tracking-wider border-2 border-bauhaus-ink">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookingQueueRows.map((booking) => (
                      <tr
                        key={booking.key}
                        className="bg-white cursor-pointer hover:bg-bauhaus-canvas"
                        onClick={() => setBookingDetail({ open: true, booking })}
                      >
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-black text-xs uppercase">{booking.customerName || 'Customer'}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-medium text-sm">{booking.service || providerProfile.service}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-bold text-xs">{formatBookingDate(booking.scheduledAt)}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-bold text-xs">{formatBookingTime(booking.scheduledAt)}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink font-bold text-xs">PHP {Number(booking.rate || 0).toLocaleString('en-PH')}</td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink"><StatusPill tone="yellow">{booking.status}</StatusPill></td>
                        <td className="px-3 py-3 border-2 border-bauhaus-ink">
                          {(() => {
                            const action = getQueueActionState(booking);
                            if (action.type === 'start') {
                              return (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    runJobAction(booking.raw._id, 'start-work');
                                  }}
                                  className="px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
                                >
                                  Start Work
                                </button>
                              );
                            }
                            if (action.type === 'done') {
                              return (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openMarkDoneModal(booking.raw);
                                  }}
                                  className="px-3 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
                                >
                                  Mark as Done
                                </button>
                              );
                            }
                            if (action.type === 'cashPaid') {
                              return (
                                <button
                                  type="button"
                                  onClick={async (event) => {
                                    event.stopPropagation();
                                    try {
                                      const updated = await apiRequest(`/api/v1/jobs/${booking.raw._id}/payment/cash-confirm`, {
                                        method: 'PATCH',
                                        body: JSON.stringify({
                                          providerConfirm: true,
                                          clientConfirm: true,
                                          confirmedAmount: Number(booking.rate || 0),
                                        }),
                                      });
                                      setProviderJobs((current) => current.map((item) => (String(item._id) === String(updated._id) ? updated : item)));
                                      triggerRefresh();
                                      toast.success('Cash payment confirmed');
                                    } catch (error) {
                                      toast.error(error.message || 'Could not confirm cash payment');
                                    }
                                  }}
                                  className="px-3 py-2 bg-white text-bauhaus-ink border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
                                >
                                  Mark Cash Paid
                                </button>
                              );
                            }
                            return <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/50">{action.label}</span>;
                          })()}
                        </td>
                      </tr>
                    ))}
                    {bookingQueueRows.length === 0 && (
                      <tr className="bg-white">
                        <td colSpan={7} className="px-3 py-6 border-2 border-bauhaus-ink text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">No bookings yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </Panel>
            )}

            {isReviewsView && (
              <Panel title="All Reviews" icon={Star}>
              <div className="space-y-3">
                {providerReviews.map((review, index) => (
                  <div key={review._id || `${review.customerName || review.customer || 'customer'}-${review.createdAt || review.text || index}`} className="border-2 border-bauhaus-ink bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">
                        {review.customerName || review.customer || 'Customer'}
                      </div>
                      <StatusPill tone="yellow">{Number(review.rating || 0)} Stars</StatusPill>
                    </div>
                    <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/45">
                      {review.createdAt ? formatBookingDate(review.createdAt) : 'Date not available'}
                    </div>
                    <p className="mt-2 font-medium text-sm text-bauhaus-ink/75">
                      {review.text || review.comment || 'No written feedback'}
                    </p>
                  </div>
                ))}
                {providerReviews.length === 0 && (
                  <div className="border-2 border-dashed border-bauhaus-ink bg-white p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">
                    No reviews yet
                  </div>
                )}
              </div>
              </Panel>
            )}

            {isPricingView && (
              <Panel
              title="Service Management"
              icon={WalletCards}
              action={(
                <button
                  type="button"
                  onClick={() => setLivePreview((current) => !current)}
                  className={`inline-flex items-center gap-1 px-3 py-2 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${livePreview ? 'bg-bauhaus-blue text-white' : 'bg-white text-bauhaus-ink'}`}
                >
                  {livePreview ? 'Hide Preview' : 'Live Preview'}
                </button>
              )}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    ['Total Active Services', fixedServices.filter((item) => item.active).length],
                    ['Total Active Bundles', bundlePlans.filter((item) => item.active).length],
                    ['Publish Warning', fixedServices.filter((item) => item.active).length + bundlePlans.filter((item) => item.active).length > 0 ? 'Live' : 'No Active Offerings'],
                  ].map(([label, value]) => (
                    <div key={label} className={`border-2 border-bauhaus-ink p-3 ${label === 'Publish Warning' && value === 'No Active Offerings' ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-canvas text-bauhaus-ink'}`}>
                      <div className="font-black text-[10px] uppercase tracking-wider">{label}</div>
                      <div className="mt-1 font-black text-lg">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setServiceTab('fixed')} className={`px-4 py-2 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${serviceTab === 'fixed' ? 'bg-bauhaus-yellow' : 'bg-white'}`}>Fixed Price Catalog</button>
                  <button type="button" onClick={() => setServiceTab('bundles')} className={`px-4 py-2 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${serviceTab === 'bundles' ? 'bg-bauhaus-yellow' : 'bg-white'}`}>Custom Bundle Plans</button>
                </div>

                <div className={`${livePreview ? 'grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4' : ''}`}>
                  <div className="space-y-4">
                    {serviceTab === 'fixed' && (
                      <>
                        <div className="border-2 border-bauhaus-ink bg-white p-4 space-y-3">
                          <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">{editingFixedId ? 'Edit Fixed Service' : 'Add Fixed Service'}</div>
                          <label className="block">
                            <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Service Title</span>
                            <input value={fixedForm.title} onChange={(e) => setFixedForm((c) => ({ ...c, title: e.target.value }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink font-bold text-sm outline-none" />
                            {fixedErrors.title && <div className="mt-1 text-xs font-black text-bauhaus-red">{fixedErrors.title}</div>}
                          </label>
                          <label className="block">
                            <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Category</span>
                            <div className="mt-1 border-2 border-bauhaus-ink bg-white p-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {selectedFixedCategories.map((category) => (
                                  <span key={`fixed-category-chip-${category}`} className="inline-flex items-center gap-2 px-2 py-1 border border-bauhaus-ink bg-bauhaus-canvas font-bold text-xs text-bauhaus-ink">
                                    {category}
                                    <button type="button" onClick={() => removeFixedCategory(category)} className="text-bauhaus-ink/55 hover:text-bauhaus-red">x</button>
                                  </span>
                                ))}
                                {selectedFixedCategories.length === 0 && <span className="text-xs font-bold text-bauhaus-ink/45">No categories selected</span>}
                              </div>
                              <div className="mt-2 flex gap-2">
                                <select
                                  value={fixedCategoryPickerValue}
                                  onChange={(e) => setFixedCategoryPickerValue(e.target.value)}
                                  className="w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none"
                                >
                                  <option value="">Select category</option>
                                  {categoryDropdownOptions.map((item) => (
                                    <option key={`fixed-category-${item.value}`} value={item.value}>{item.label}</option>
                                  ))}
                                  <option value="other">Others</option>
                                </select>
                                <button type="button" onClick={addFixedCategory} className="px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Add</button>
                              </div>
                            </div>
                            <div className="mt-2 border border-dashed border-bauhaus-ink p-2 font-black text-xs text-bauhaus-ink min-h-[44px]">
                              {selectedFixedCategories.length > 0 ? selectedFixedCategories.join(', ') : 'No selected categories'}
                            </div>
                            {fixedErrors.category && <div className="mt-1 text-xs font-black text-bauhaus-red">{fixedErrors.category}</div>}
                          </label>
                          <label className="block">
                            <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Fixed Price Amount (PHP)</span>
                            <input
                              type="number"
                              min="2"
                              step="1"
                              value={fixedForm.price}
                              onKeyDown={(e) => { if (!['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key) && !/[0-9]/.test(e.key)) e.preventDefault(); }}
                              onChange={(e) => setFixedForm((c) => ({ ...c, price: e.target.value.replace(/[^\d]/g, '') }))}
                              className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink font-bold text-sm outline-none"
                            />
                            {fixedErrors.price && <div className="mt-1 text-xs font-black text-bauhaus-red">{fixedErrors.price}</div>}
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Hours</span>
                              <select value={fixedForm.durationHours} onChange={(e) => setFixedForm((c) => ({ ...c, durationHours: e.target.value }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink font-bold text-sm outline-none">
                                {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={String(h)}>{h} Hours</option>)}
                              </select>
                            </label>
                            <label className="block">
                              <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Minutes</span>
                              <select value={fixedForm.durationMinutes} onChange={(e) => setFixedForm((c) => ({ ...c, durationMinutes: e.target.value }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink font-bold text-sm outline-none">
                                {[0, 15, 30, 45].map((m) => <option key={m} value={String(m)}>{m} Minutes</option>)}
                              </select>
                            </label>
                          </div>
                          {fixedErrors.duration && <div className="text-xs font-black text-bauhaus-red">{fixedErrors.duration}</div>}
                          <label className="block">
                            <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Service Description</span>
                            <textarea rows={3} value={fixedForm.description} onChange={(e) => setFixedForm((c) => ({ ...c, description: e.target.value }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink font-medium text-sm outline-none resize-none" />
                            {fixedErrors.description && <div className="mt-1 text-xs font-black text-bauhaus-red">{fixedErrors.description}</div>}
                          </label>
                          <div className="flex gap-2">
                            <button type="button" onClick={saveFixedService} disabled={serviceBusy} className="px-4 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60">{editingFixedId ? 'Update Service' : 'Add Service'}</button>
                            {editingFixedId && <button type="button" onClick={resetFixedForm} className="px-4 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Cancel</button>}
                          </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto space-y-2">
                          {fixedServices.map((item) => (
                            <div key={item._id} className="border-2 border-bauhaus-ink bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">{item.title}</div>
                                  <div className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/50">{item.category} • PHP {Number(item.price || 0).toLocaleString('en-PH')}</div>
                                </div>
                                <button type="button" onClick={() => toggleFixedActive(item)} className={`px-2 py-1 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${item.active ? 'bg-bauhaus-yellow' : 'bg-white'}`}>{item.active ? 'Active' : 'Inactive'}</button>
                              </div>
                              <div className="mt-2 flex gap-2">
                                <button type="button" onClick={() => { setEditingFixedId(String(item._id)); setFixedForm({ title: item.title || '', category: item.category || '', price: String(item.price || ''), durationHours: String(item.durationHours || '0'), durationMinutes: String(item.durationMinutes || '0'), description: item.description || '', active: Boolean(item.active) }); }} className="px-3 py-1 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Edit</button>
                                <button type="button" onClick={() => deleteFixedService(item)} className="px-3 py-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Delete</button>
                              </div>
                            </div>
                          ))}
                          {fixedServices.length === 0 && <div className="border-2 border-dashed border-bauhaus-ink bg-white p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">No fixed services yet</div>}
                        </div>
                      </>
                    )}

                    {serviceTab === 'bundles' && (
                      <>
                        <div className="border-2 border-bauhaus-ink bg-white p-4 space-y-3">
                          <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">{editingBundleId ? 'Edit Bundle Plan' : 'Create Bundle Plan'}</div>
                          <label className="block">
                            <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Plan Name</span>
                            <input value={bundleForm.name} onChange={(e) => setBundleForm((c) => ({ ...c, name: e.target.value }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink font-bold text-sm outline-none" />
                            {bundleErrors.name && <div className="mt-1 text-xs font-black text-bauhaus-red">{bundleErrors.name}</div>}
                          </label>
                          <label className="block">
                            <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Package Description</span>
                            <textarea rows={3} value={bundleForm.description} onChange={(e) => setBundleForm((c) => ({ ...c, description: e.target.value }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink font-medium text-sm outline-none resize-none" />
                            {bundleErrors.description && <div className="mt-1 text-xs font-black text-bauhaus-red">{bundleErrors.description}</div>}
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Total Contract Price (PHP)</span>
                              <input value={bundleForm.price} onKeyDown={(e) => { if (!['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key) && !/[0-9]/.test(e.key)) e.preventDefault(); }} onChange={(e) => setBundleForm((c) => ({ ...c, price: e.target.value.replace(/[^\d]/g, '') }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink font-bold text-sm outline-none" />
                              {bundleErrors.price && <div className="mt-1 text-xs font-black text-bauhaus-red">{bundleErrors.price}</div>}
                            </label>
                            <label className="block">
                              <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Duration</span>
                              <select value={bundleForm.durationDays} onChange={(e) => setBundleForm((c) => ({ ...c, durationDays: e.target.value }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink font-bold text-sm outline-none">
                                {[7, 14, 30].map((day) => <option key={day} value={String(day)}>{day} Days</option>)}
                              </select>
                              {bundleErrors.durationDays && <div className="mt-1 text-xs font-black text-bauhaus-red">{bundleErrors.durationDays}</div>}
                            </label>
                          </div>
                          <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                            <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Inclusions Checklist</div>
                            <div className="mt-2 flex gap-2">
                              <input value={newInclusion} onChange={(e) => setNewInclusion(e.target.value)} className="w-full px-3 py-2 border-2 border-bauhaus-ink font-medium text-sm outline-none" placeholder="e.g., Includes 3 sessions per week" />
                              <button type="button" onClick={() => { const line = newInclusion.trim(); if (!line) return; setBundleForm((c) => ({ ...c, inclusions: [...c.inclusions, line] })); setNewInclusion(''); }} className="px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Add Line</button>
                            </div>
                            <div className="mt-2 space-y-1">
                              {bundleForm.inclusions.map((item, idx) => (
                                <div key={`${item}-${idx}`} className="flex items-center justify-between gap-2 border border-bauhaus-ink bg-white px-2 py-1">
                                  <div className="font-medium text-xs text-bauhaus-ink">• {item}</div>
                                  <button type="button" onClick={() => setBundleForm((c) => ({ ...c, inclusions: c.inclusions.filter((_, i) => i !== idx) }))} className="font-black text-[10px] uppercase text-bauhaus-red">Remove</button>
                                </div>
                              ))}
                            </div>
                            {bundleErrors.inclusions && <div className="mt-1 text-xs font-black text-bauhaus-red">{bundleErrors.inclusions}</div>}
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={saveBundlePlan} disabled={serviceBusy || bundleForm.inclusions.length === 0} className="px-4 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60">{editingBundleId ? 'Update Plan' : 'Publish Plan'}</button>
                            {editingBundleId && <button type="button" onClick={resetBundleForm} className="px-4 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Cancel</button>}
                          </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto space-y-2">
                          {bundlePlans.map((item) => (
                            <div key={item._id} className="border-2 border-bauhaus-ink bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">{item.title}</div>
                                  <div className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/50">PHP {Number(item.priceFixed || 0).toLocaleString('en-PH')} • {(item.terms?.durationDays || (Number(item.durationWeeks || 1) * 7))} Days</div>
                                </div>
                                <button type="button" onClick={() => toggleBundleActive(item)} className={`px-2 py-1 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${item.active ? 'bg-bauhaus-yellow' : 'bg-white'}`}>{item.active ? 'Active' : 'Inactive'}</button>
                              </div>
                              <div className="mt-2 flex gap-2">
                                <button type="button" onClick={() => { setEditingBundleId(String(item._id)); setBundleForm({ name: item.title || '', description: item.description || '', price: String(item.priceFixed || ''), durationDays: String(item.terms?.durationDays || (Number(item.durationWeeks || 1) * 7)), inclusions: Array.isArray(item.inclusions) ? item.inclusions : [], active: Boolean(item.active) }); }} className="px-3 py-1 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Edit</button>
                                <button type="button" onClick={() => deleteBundlePlan(item)} className="px-3 py-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Delete</button>
                              </div>
                            </div>
                          ))}
                          {bundlePlans.length === 0 && <div className="border-2 border-dashed border-bauhaus-ink bg-white p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">No bundle plans yet</div>}
                        </div>
                      </>
                    )}
                  </div>

                  {livePreview && (
                    <div className="border-4 border-bauhaus-ink bg-bauhaus-canvas p-3">
                      <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">See What Clients See</div>
                      <div className="mt-2 border-2 border-bauhaus-ink bg-white p-3 max-h-[520px] overflow-y-auto">
                        <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">Fixed Services</div>
                        <div className="mt-2 grid grid-cols-1 gap-2">
                          {fixedServices.filter((item) => item.active).map((item) => (
                            <div key={`preview-fixed-${item._id}`} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-2">
                              <div className="font-black text-[10px] uppercase text-bauhaus-ink">{item.title}</div>
                              <div className="font-bold text-[10px] text-bauhaus-ink/60">{item.description}</div>
                              <div className="mt-1 flex items-center justify-between">
                                <div className="font-black text-xs text-bauhaus-red">PHP {Number(item.price || 0).toLocaleString('en-PH')}</div>
                                <button className="px-2 py-1 bg-bauhaus-red text-white border border-bauhaus-ink font-black text-[9px] uppercase">Book</button>
                              </div>
                            </div>
                          ))}
                          {fixedServices.filter((item) => item.active).length === 0 && <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/40">No active fixed services</div>}
                        </div>

                        <div className="mt-4 font-black text-xs uppercase tracking-tight text-bauhaus-ink">Bundle Plans</div>
                        <div className="mt-2 space-y-2">
                          {bundlePlans.filter((item) => item.active).map((item) => (
                            <div key={`preview-bundle-${item._id}`} className="border-2 border-bauhaus-ink bg-bauhaus-yellow p-3">
                              <div className="font-black text-xs uppercase text-bauhaus-ink">{item.title}</div>
                              <div className="mt-1 font-bold text-[10px] text-bauhaus-ink/70">{item.description}</div>
                              <div className="mt-1 font-black text-sm text-bauhaus-red">PHP {Number(item.priceFixed || 0).toLocaleString('en-PH')}</div>
                              <div className="mt-1 space-y-1">
                                {(Array.isArray(item.inclusions) ? item.inclusions : []).map((line, idx) => (
                                  <div key={`${line}-${idx}`} className="font-medium text-[10px] text-bauhaus-ink">✓ {line}</div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {bundlePlans.filter((item) => item.active).length === 0 && <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/40">No active bundles</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </Panel>
            )}

            {isSettingsView && (
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
                      <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3 h-fit self-start">
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
                        <label className="block">
                          <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Display Name</span>
                          <input value={settingsForm.name} onChange={(e) => updateSetting('name', e.target.value)} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue" />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Category</span>
                          <div className="mt-1 border-2 border-bauhaus-ink bg-white p-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {selectedProviderCategories.map((category) => (
                                <span key={`provider-category-chip-${category}`} className="inline-flex items-center gap-2 px-2 py-1 border border-bauhaus-ink bg-bauhaus-canvas font-bold text-xs text-bauhaus-ink">
                                  {category}
                                  <button type="button" onClick={() => removeProviderCategory(category)} className="text-bauhaus-ink/55 hover:text-bauhaus-red">x</button>
                                </span>
                              ))}
                              {selectedProviderCategories.length === 0 && <span className="text-xs font-bold text-bauhaus-ink/45">No categories selected</span>}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <select
                                value={settingsCategoryPickerValue}
                                onChange={(e) => setSettingsCategoryPickerValue(e.target.value)}
                                className="w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue"
                              >
                                <option value="">Select category</option>
                                {categoryDropdownOptions.map((item) => (
                                  <option key={`provider-category-${item.value}`} value={item.value}>{item.label}</option>
                                ))}
                              </select>
                              <button type="button" onClick={addProviderCategory} className="px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Add</button>
                            </div>
                          </div>
                          <div className="mt-2 border border-dashed border-bauhaus-ink p-2 font-black text-xs text-bauhaus-ink min-h-[44px]">
                            {selectedProviderCategories.length > 0 ? selectedProviderCategories.join(', ') : 'No selected categories'}
                          </div>
                        </label>
                        {(settingsForm.serviceId === 'other' || settingsCategoryPickerValue === 'other') && (
                          <label className="block sm:col-span-2">
                            <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Add New Category</span>
                            <div className="mt-1 flex gap-2">
                              <input
                                value={customCategoryInput}
                                onChange={(e) => setCustomCategoryInput(e.target.value)}
                                onBlur={() => setCustomCategoryInput(toTitleCase(customCategoryInput))}
                                placeholder="Enter category name"
                                className="w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue"
                              />
                              <button type="button" onClick={addCustomProviderCategory} className="px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Add</button>
                            </div>
                          </label>
                        )}
                        <label className="block">
                          <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Location</span>
                          <div className="mt-1 flex gap-2">
                            <input
                              value={settingsForm.location}
                              onChange={(e) => updateSetting('location', e.target.value)}
                              className="w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue"
                            />
                            <button
                              type="button"
                              onClick={useCurrentLocation}
                              disabled={detectingLocation}
                              className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-bauhaus-yellow border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              {detectingLocation ? 'Detecting...' : 'Use My Location'}
                            </button>
                          </div>
                        </label>
                        <label className="block">
                          <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Service Area</span>
                          <input value={settingsForm.serviceArea} onChange={(e) => updateSetting('serviceArea', e.target.value)} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue" />
                        </label>
                        <div className="sm:col-span-2 border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                          <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Schedule Management</div>
                          <div className="mt-1 font-medium text-xs text-bauhaus-ink/70">Working days and time blocks are managed in the Calendar page.</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <label className="block lg:col-span-2">
                        <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">About</span>
                        <textarea value={settingsForm.bio} onChange={(e) => updateSetting('bio', e.target.value)} rows={4} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-medium text-sm outline-none focus:border-bauhaus-blue resize-none" />
                      </label>
                      <label className="block">
                        <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Service Tags</span>
                        <div className="mt-1 border-2 border-bauhaus-ink bg-white p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {selectedProviderCategories.map((tag) => (
                              <span key={`tag-chip-${tag}`} className="inline-flex items-center gap-2 px-2 py-1 border border-bauhaus-ink bg-bauhaus-canvas font-bold text-xs text-bauhaus-ink">
                                {tag}
                                <button type="button" onClick={() => removeTag(tag)} className="text-bauhaus-ink/55 hover:text-bauhaus-red">x</button>
                              </span>
                            ))}
                            {selectedProviderCategories.length === 0 && <span className="text-xs font-bold text-bauhaus-ink/45">No tags selected</span>}
                          </div>
                          <div className="mt-2 flex gap-2">
                            <select
                              value={tagPickerValue}
                              onChange={(e) => setTagPickerValue(e.target.value)}
                              className="w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue"
                            >
                              <option value="">Select category</option>
                              {categoryDropdownOptions.filter((item) => item.value !== 'other').map((item) => (
                                <option key={`tag-${item.value}`} value={item.label}>{item.label}</option>
                              ))}
                              <option value="other">Others</option>
                            </select>
                            <button type="button" onClick={addTag} className="px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Add</button>
                          </div>
                        </div>
                        <div className="mt-2 border border-dashed border-bauhaus-ink p-2 font-black text-xs text-bauhaus-ink min-h-[44px]">
                          {selectedProviderCategories.length > 0 ? selectedProviderCategories.join(', ') : 'No selected tags'}
                        </div>
                      </label>
                      <label className="block">
                        <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Certifications</span>
                        <div className="mt-1 border-2 border-bauhaus-ink bg-white p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {selectedCertifications.map((cert) => (
                              <span key={`cert-chip-${cert}`} className="inline-flex items-center gap-2 px-2 py-1 border border-bauhaus-ink bg-bauhaus-canvas font-bold text-xs text-bauhaus-ink">
                                {cert}
                                <button type="button" onClick={() => removeCertification(cert)} className="text-bauhaus-ink/55 hover:text-bauhaus-red">x</button>
                              </span>
                            ))}
                            {selectedCertifications.length === 0 && <span className="text-xs font-bold text-bauhaus-ink/45">No certifications selected</span>}
                          </div>
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              value={certPickerValue}
                              onChange={(e) => setCertPickerValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addCertification();
                                }
                              }}
                              placeholder="Type certification (e.g., TESDA NC II)"
                              className="w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none focus:border-bauhaus-blue"
                            />
                            <button type="button" onClick={addCertification} className="px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Add</button>
                          </div>
                        </div>
                        <div className="mt-2 border border-dashed border-bauhaus-ink p-2 font-black text-xs text-bauhaus-ink min-h-[44px]">
                          {selectedCertifications.length > 0 ? selectedCertifications.join(', ') : 'No selected certifications'}
                        </div>
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
            )}
          </div>
        </div>
      </main>

      <NearMeFooter />
      <Toaster position="top-center" />
      {confirmAction.open && (
        <div className="fixed inset-0 z-50 bg-bauhaus-ink/70 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-5">
            <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">{confirmAction.title || 'Confirm Action'}</div>
            <p className="mt-2 font-medium text-sm text-bauhaus-ink/75">{confirmAction.message || 'Please confirm this action.'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closeConfirmAction}
                disabled={confirmAction.busy}
                className="px-4 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runConfirmAction}
                disabled={confirmAction.busy}
                className="px-4 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60"
              >
                {confirmAction.busy ? 'Processing...' : (confirmAction.confirmLabel || 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      {bookingDetail.open && bookingDetail.booking && (
        <div className="fixed inset-0 z-50 bg-bauhaus-ink/70 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">Booking Details</div>
                <div className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink/55">
                  {bookingDetail.booking.source === 'job' ? 'Jobs Ledger' : 'Legacy Booking'} - {formatBookingDate(bookingDetail.booking.scheduledAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingDetail({ open: false, booking: null })}
                className="px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
              >
                Close
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-2">
              <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">
                    {bookingDetail.booking.raw?.jobNumber || `Booking ${String(bookingDetail.booking.sourceId || '').slice(-6)}`}
                  </div>
                  <StatusPill tone={String(bookingDetail.booking.status || '').toLowerCase().includes('completed') ? 'ink' : 'yellow'}>
                    {bookingDetail.booking.status || 'N/A'}
                  </StatusPill>
                </div>
                <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/60">{bookingDetail.booking.service || providerProfile.service}</div>
                <div className="mt-2 space-y-1 text-xs font-medium text-bauhaus-ink/75">
                  <div><span className="font-black text-bauhaus-ink">Client:</span> {bookingDetail.booking.customerName || 'Customer'}</div>
                  <div><span className="font-black text-bauhaus-ink">Date:</span> {formatBookingDate(bookingDetail.booking.scheduledAt)}</div>
                  <div><span className="font-black text-bauhaus-ink">Time:</span> {formatBookingTime(bookingDetail.booking.scheduledAt)}</div>
                  <div><span className="font-black text-bauhaus-ink">Rate:</span> PHP {Number(bookingDetail.booking.rate || 0).toLocaleString('en-PH')}</div>
                  <div><span className="font-black text-bauhaus-ink">Address:</span> {bookingDetail.booking.raw?.appointment?.address || bookingDetail.booking.raw?.address || 'N/A'}</div>
                  <div><span className="font-black text-bauhaus-ink">Notes:</span> {bookingDetail.booking.raw?.appointment?.notes || bookingDetail.booking.raw?.notes || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {doneModal.open && doneModal.job && (
        <div className="fixed inset-0 z-50 bg-bauhaus-ink/70 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">Mark Job as Done</div>
                <div className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink/55">
                  Add work proof. This will notify the client to pay.
                </div>
              </div>
              <button type="button" onClick={closeMarkDoneModal} className="px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Close</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/60">Work Summary</div>
                <textarea
                  rows={3}
                  value={doneForm.summary}
                  onChange={(event) => setDoneForm((current) => ({ ...current, summary: event.target.value }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink font-medium text-sm outline-none"
                  placeholder="Describe completed work and key results"
                />
              </div>
              <div>
                <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/60">Proof Images</div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setDoneForm((current) => ({ ...current, files: Array.from(event.target.files || []) }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink bg-white font-bold text-xs outline-none"
                />
                {doneForm.files.length > 0 && (
                  <div className="mt-2 text-xs font-bold text-bauhaus-ink/70">{doneForm.files.length} image(s) selected</div>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={closeMarkDoneModal} className="px-4 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Cancel</button>
              <button type="button" disabled={submittingDone} onClick={submitDoneWithProof} className="px-4 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60">
                {submittingDone ? 'Submitting...' : 'Submit and Request Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      {inquiryQuoteModal.open && inquiryQuoteModal.conversation && inquiryQuoteModal.inquiry && (
        <div className="fixed inset-0 z-50 bg-bauhaus-ink/70 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">Custom Quote</div>
                <div className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink/55">Provide a professional quote for this custom request</div>
              </div>
              <button type="button" onClick={closeInquiryQuote} className="px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Close</button>
            </div>

            <div className="mt-4 border-2 border-bauhaus-ink bg-bauhaus-canvas p-3 text-xs font-medium text-bauhaus-ink/75 space-y-1">
              <div><span className="font-black text-bauhaus-ink">Client:</span> {inquiryQuoteModal.conversation.customer?.name || 'Customer'}</div>
              <div><span className="font-black text-bauhaus-ink">Category:</span> {inquiryQuoteModal.inquiry.serviceCategory || 'other'}</div>
              <div><span className="font-black text-bauhaus-ink">Schedule:</span> {inquiryQuoteModal.inquiry.bookingDate} {inquiryQuoteModal.inquiry.bookingTime}</div>
              <div><span className="font-black text-bauhaus-ink">Address:</span> {inquiryQuoteModal.inquiry.address || '-'}</div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/60">Quoted Price (PHP)</span>
                <input
                  value={inquiryQuoteForm.price}
                  onChange={(e) => setInquiryQuoteForm((current) => ({ ...current, price: e.target.value.replace(/[^\d]/g, '') }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink font-bold text-sm outline-none"
                />
              </label>
              <label className="block">
                <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/60">Inclusions (one per line)</span>
                <textarea
                  rows={3}
                  value={inquiryQuoteForm.inclusions}
                  onChange={(e) => setInquiryQuoteForm((current) => ({ ...current, inclusions: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink font-medium text-sm outline-none resize-none"
                />
              </label>
              <label className="block">
                <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/60">Price Breakdown</span>
                <textarea
                  rows={3}
                  value={inquiryQuoteForm.breakdown}
                  onChange={(e) => setInquiryQuoteForm((current) => ({ ...current, breakdown: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink font-medium text-sm outline-none resize-none"
                />
              </label>
              <label className="block">
                <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/60">Scope Description</span>
                <textarea
                  rows={2}
                  value={inquiryQuoteForm.description}
                  onChange={(e) => setInquiryQuoteForm((current) => ({ ...current, description: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink font-medium text-sm outline-none resize-none"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={closeInquiryQuote} className="px-4 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Cancel</button>
              <button
                type="button"
                disabled={acceptingInquiryId === String(inquiryQuoteModal.conversation._id)}
                onClick={submitInquiryQuote}
                className="px-4 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60"
              >
                {acceptingInquiryId === String(inquiryQuoteModal.conversation._id) ? 'Submitting...' : 'Submit Quote & Accept'}
              </button>
            </div>
          </div>
        </div>
      )}
      {calendarDetail.open && (
        <div className="fixed inset-0 z-50 bg-bauhaus-ink/70 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">Scheduled Jobs</div>
                <div className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink/55">
                  {calendarDetail.date ? new Date(calendarDetail.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                </div>
              </div>
              <button type="button" onClick={() => setCalendarDetail({ open: false, date: null, jobs: [], dayMeta: null })} className="px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Close</button>
            </div>

            <div className="mt-4 space-y-3">
              {calendarDetail.dayMeta && (
                <div className="border-2 border-bauhaus-ink bg-white p-3 space-y-3">
                  <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Single-Day Availability</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setCalendarDetail((current) => ({ ...current, dayMeta: { ...current.dayMeta, availableDay: !current.dayMeta.availableDay } }))}
                      className={`px-3 py-2 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${calendarDetail.dayMeta.availableDay ? 'bg-bauhaus-blue text-white' : 'bg-bauhaus-red text-white'}`}
                    >
                      {calendarDetail.dayMeta.availableDay ? 'Available' : 'Off Day'}
                    </button>
                    <input
                      type="time"
                      value={calendarDetail.dayMeta.effectiveStart || '08:00'}
                      onChange={(e) => setCalendarDetail((current) => ({ ...current, dayMeta: { ...current.dayMeta, effectiveStart: e.target.value } }))}
                      className="px-3 py-2 border-2 border-bauhaus-ink font-bold text-sm outline-none"
                    />
                    <input
                      type="time"
                      value={calendarDetail.dayMeta.effectiveEnd || '18:00'}
                      onChange={(e) => setCalendarDetail((current) => ({ ...current, dayMeta: { ...current.dayMeta, effectiveEnd: e.target.value } }))}
                      className="px-3 py-2 border-2 border-bauhaus-ink font-bold text-sm outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={saveSingleDayAvailability} className="px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Save Day</button>
                    <button type="button" onClick={clearSingleDayAvailability} className="px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Clear Day Override</button>
                  </div>
                </div>
              )}
              <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3 space-y-3">
                <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Default Availability</div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {weekdayKeys.map((dayKey, idx) => {
                    const active = (settingsForm.availabilityDays || []).includes(dayKey);
                    return (
                      <button
                        key={`calendar-default-${dayKey}`}
                        type="button"
                        onClick={() => {
                          const current = Array.isArray(settingsForm.availabilityDays) ? settingsForm.availabilityDays : [];
                          const next = active ? current.filter((item) => item !== dayKey) : [...current, dayKey];
                          updateSetting('availabilityDays', next);
                        }}
                        className={`px-2 py-2 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${active ? 'bg-bauhaus-blue text-white' : 'bg-white text-bauhaus-ink'}`}
                      >
                        {calendarWeekdays[idx]}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input type="time" value={settingsForm.workingHours?.start || '08:00'} onChange={(e) => updateSetting('workingHours', { ...(settingsForm.workingHours || {}), start: e.target.value })} className="px-3 py-2 border-2 border-bauhaus-ink font-bold text-sm outline-none bg-white" />
                  <input type="time" value={settingsForm.workingHours?.end || '18:00'} onChange={(e) => updateSetting('workingHours', { ...(settingsForm.workingHours || {}), end: e.target.value })} className="px-3 py-2 border-2 border-bauhaus-ink font-bold text-sm outline-none bg-white" />
                  <button type="button" onClick={saveDefaultAvailabilityFromCalendar} className="px-3 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Save Default</button>
                </div>
              </div>
            </div>

            <div className="mt-4 max-h-[45vh] overflow-y-auto space-y-2">
              {calendarDetail.jobs.map((job) => (
                <div key={`calendar-job-${job._id}`} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink">{job.jobNumber || `Job ${String(job._id).slice(-6)}`}</div>
                    <div className="flex items-center gap-2">
                      <StatusPill tone={isWithinWorkingHours(new Date(job.scheduledAt)) ? 'blue' : 'red'}>
                        {isWithinWorkingHours(new Date(job.scheduledAt)) ? 'Within Hours' : 'Outside Hours'}
                      </StatusPill>
                      <StatusPill tone={job.status === 'Completed' ? 'ink' : 'yellow'}>{job.status}</StatusPill>
                    </div>
                  </div>
                  <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/60">{job.serviceId || providerProfile.service}</div>
                  <div className="mt-1 text-xs font-medium text-bauhaus-ink/70">
                    <div><span className="font-black text-bauhaus-ink">Time:</span> {new Date(job.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div><span className="font-black text-bauhaus-ink">Address:</span> {job.appointment?.address || 'N/A'}</div>
                    <div><span className="font-black text-bauhaus-ink">Notes:</span> {job.appointment?.notes || job.notes || 'N/A'}</div>
                    <div><span className="font-black text-bauhaus-ink">Rate:</span> PHP {Number(job.financials?.grossPrice || job.quote?.grossPrice || 0).toLocaleString('en-PH')}</div>
                  </div>
                </div>
              ))}
              {calendarDetail.jobs.length === 0 && (
                <div className="border-2 border-dashed border-bauhaus-ink bg-white p-6 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">
                  No jobs found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

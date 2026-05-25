import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Briefcase, CalendarDays, Clock, CreditCard, Heart, MessageSquareText, Search } from 'lucide-react';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import { apiRequest, getStoredToken } from '../lib/api';
import { getStoredNearMeUser } from '../lib/providerAccess';

const favoritesStorageKey = 'nearme_favorite_providers';

function StatusPill({ status = '' }) {
  const normalized = String(status || '').toLowerCase();
  const tone = normalized.includes('completed')
    ? 'bg-bauhaus-blue text-white'
    : normalized.includes('pending payment')
      ? 'bg-bauhaus-yellow text-bauhaus-ink'
      : normalized.includes('in progress')
        ? 'bg-bauhaus-red text-white'
        : 'bg-white text-bauhaus-ink';
  return <span className={`inline-flex px-2.5 py-1 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${tone}`}>{status || 'N/A'}</span>;
}

const parseScheduledAt = (job) => {
  const direct = job?.scheduledAt ? new Date(job.scheduledAt) : null;
  if (direct && !Number.isNaN(direct.getTime())) return direct;
  const date = String(job?.appointment?.bookingDate || '').trim();
  const time = String(job?.appointment?.bookingTime || '').trim();
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const filterByTab = (job, tab) => {
  const status = String(job?.status || '').toLowerCase();
  const hasReview = Boolean(job?.review?.submittedAt || job?.reviewId || job?.reviewedAt);
  if (tab === 'all') return true;
  if (tab === 'on_progress') return ['accepted', 'in progress', 'pending verification'].includes(status);
  if (tab === 'to_pay') return status === 'pending payment';
  if (tab === 'to_review') return status === 'completed' && !hasReview;
  if (tab === 'refunds') return status === 'disputed' || status.includes('refund');
  return true;
};

export default function NearMeMyOrders() {
  const [user] = useState(() => getStoredNearMeUser());
  const [token] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [providers, setProviders] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [syncingCashless, setSyncingCashless] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [jobData, conversationData, providerData] = await Promise.all([
        apiRequest('/api/v1/jobs').catch(() => []),
        apiRequest('/api/conversations').catch(() => []),
        apiRequest('/api/providers').catch(() => []),
      ]);
      setJobs(Array.isArray(jobData) ? jobData : []);
      setConversations(Array.isArray(conversationData) ? conversationData : []);
      setProviders(Array.isArray(providerData) ? providerData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const activeJobId = localStorage.getItem('nearme_active_cashless_job_id');
    if (!activeJobId || !user || !token) return undefined;
    let mounted = true;
    setSyncingCashless(true);
    const timer = setInterval(async () => {
      try {
        const latestJobs = await apiRequest('/api/v1/jobs').catch(() => []);
        if (Array.isArray(latestJobs) && mounted) {
          setJobs(latestJobs);
        }
        const target = (Array.isArray(latestJobs) ? latestJobs : jobs || []).find((item) => String(item._id) === String(activeJobId));
        if (!target) return;
        if (String(target.status || '').toLowerCase() === 'completed') {
          localStorage.removeItem('nearme_active_cashless_job_id');
          localStorage.removeItem('nearme_active_cashless_started_at');
          localStorage.removeItem(`nearme_cashless_attempt_${activeJobId}`);
          if (mounted) setSyncingCashless(false);
          return;
        }
        if (String(target.status || '').toLowerCase() === 'pending payment') {
          await apiRequest(`/api/v1/jobs/${target._id}/payment/cashless-sync`, {
            method: 'POST',
          }).catch(() => null);
          const refreshedJobs = await apiRequest('/api/v1/jobs').catch(() => []);
          if (Array.isArray(refreshedJobs) && mounted) {
            setJobs(refreshedJobs);
            const refreshedTarget = refreshedJobs.find((item) => String(item._id) === String(activeJobId));
            if (String(refreshedTarget?.status || '').toLowerCase() === 'completed') {
              localStorage.removeItem('nearme_active_cashless_job_id');
              localStorage.removeItem('nearme_active_cashless_started_at');
              localStorage.removeItem(`nearme_cashless_attempt_${activeJobId}`);
              setSyncingCashless(false);
              return;
            }
          }
          return;
        }
        if (mounted) {
          setSyncingCashless(false);
        }
      } catch {
        // keep polling until paid or manually resolved
      }
    }, 7000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [jobs, token, user]);

  const myJobs = useMemo(() => {
    const userId = String(user?.id || user?._id || '');
    return (jobs || [])
      .filter((job) => String(job.clientUserId || '') === userId)
      .map((job) => ({ ...job, parsedSchedule: parseScheduledAt(job) }))
      .sort((a, b) => (b.parsedSchedule?.getTime() || 0) - (a.parsedSchedule?.getTime() || 0));
  }, [jobs, user?.id, user?._id]);

  const displayedJobs = useMemo(() => myJobs
    .filter((job) => filterByTab(job, activeTab))
    .filter((job) => {
      const s = search.trim().toLowerCase();
      if (!s) return true;
      const source = `${job.jobNumber || ''} ${job.serviceId || ''} ${job.appointment?.address || ''}`.toLowerCase();
      return source.includes(s);
    }), [myJobs, activeTab, search]);

  const favoriteProviders = useMemo(() => {
    let ids = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]');
      ids = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      ids = [];
    }
    return (providers || []).filter((provider) => ids.includes(String(provider.id || provider._id)));
  }, [providers]);

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
    [conversations]
  );

  if (!user || !token) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-black text-2xl uppercase tracking-tighter text-bauhaus-ink">My Orders</h1>
            <p className="mt-1 font-medium text-sm text-bauhaus-ink/60">Track your hired services, statuses, and chats in one place.</p>
            {syncingCashless && <p className="mt-1 font-black text-xs uppercase tracking-wider text-bauhaus-red">Syncing cashless payment status...</p>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowFavorites((current) => !current)} className="inline-flex items-center gap-1 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
              <Heart className="h-3.5 w-3.5" />
              Favorite Providers
            </button>
            <Link to="/browse" className="px-4 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">Find Providers</Link>
          </div>
        </div>

        {showFavorites && (
          <section className="mt-4 border-4 border-bauhaus-ink bg-white p-4">
            <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Favorite Providers</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {favoriteProviders.map((provider) => (
                <Link key={provider._id || provider.id} to={`/provider/${provider.id || provider._id}`} className="px-3 py-2 bg-bauhaus-canvas border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                  {provider.name}
                </Link>
              ))}
              {favoriteProviders.length === 0 && <div className="font-bold text-xs text-bauhaus-ink/50">No favorite providers yet.</div>}
            </div>
          </section>
        )}

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 border-4 border-bauhaus-ink bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              {[
                ['all', 'All'],
                ['on_progress', 'On Progress'],
                ['to_pay', 'To Pay'],
                ['to_review', 'To Review'],
                ['refunds', 'Refunds'],
              ].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setActiveTab(key)} className={`px-3 py-2 border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider ${activeTab === key ? 'bg-bauhaus-red text-white' : 'bg-white text-bauhaus-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center border-2 border-bauhaus-ink bg-bauhaus-canvas px-3 py-2 gap-2">
              <Search className="h-4 w-4 text-bauhaus-ink/40" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by order number, service, or address..."
                className="flex-1 bg-transparent outline-none font-medium text-sm text-bauhaus-ink placeholder:text-bauhaus-ink/35"
              />
            </div>

            <div className="mt-4 space-y-3">
              {loading && <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink/50">Loading orders...</div>}
              {!loading && displayedJobs.length === 0 && (
                <div className="border-2 border-dashed border-bauhaus-ink bg-bauhaus-canvas p-8 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/50">
                  No orders in this section
                </div>
              )}
              {!loading && displayedJobs.map((job) => (
                <div key={job._id} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{job.jobNumber || `Job ${String(job._id).slice(-6)}`}</div>
                      <div className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/55">{job.serviceId || 'Service'}</div>
                    </div>
                    <StatusPill status={job.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-bauhaus-ink/75"><Briefcase className="h-4 w-4 text-bauhaus-red" /> PHP {Number(job.financials?.grossPrice || job.quote?.grossPrice || 0).toLocaleString('en-PH')}</div>
                    <div className="flex items-center gap-2 text-xs font-bold text-bauhaus-ink/75"><CalendarDays className="h-4 w-4 text-bauhaus-blue" /> {job.parsedSchedule ? job.parsedSchedule.toLocaleDateString() : 'Date N/A'}</div>
                    <div className="flex items-center gap-2 text-xs font-bold text-bauhaus-ink/75"><Clock className="h-4 w-4 text-bauhaus-ink" /> {job.parsedSchedule ? job.parsedSchedule.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time N/A'}</div>
                    <div className="flex items-center gap-2 text-xs font-bold text-bauhaus-ink/75"><CreditCard className="h-4 w-4 text-bauhaus-red" /> {job.financials?.paymentStatus || 'unpaid'}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to="/messages" className="inline-flex items-center gap-1 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                      <MessageSquareText className="h-3.5 w-3.5" />
                      Open Messages
                    </Link>
                    {String(job.status || '').toLowerCase() === 'pending payment' && (
                      <Link to={`/pay/${job._id}`} className="inline-flex items-center gap-1 px-3 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                        <CreditCard className="h-3.5 w-3.5" />
                        Pay Now
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border-4 border-bauhaus-ink bg-white p-4 sm:p-5">
            <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Chats & History</div>
            <div className="mt-3 space-y-2">
              <Link to="/messages" className="inline-flex w-full items-center justify-center gap-2 px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                <MessageSquareText className="h-3.5 w-3.5" />
                Open Chats
              </Link>
              <Link to="/chat-history" className="inline-flex w-full items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                Chat History
              </Link>
            </div>
            <div className="mt-4 space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {sortedConversations.map((conversation) => (
                <Link key={conversation._id} to={`/messages?conversation=${encodeURIComponent(conversation._id)}`} className="block border-2 border-bauhaus-ink bg-bauhaus-canvas p-3 hover:bg-white">
                  <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink truncate">{conversation.provider?.name || conversation.customer?.name || 'Conversation'}</div>
                  <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/45 truncate">{conversation.provider?.service || 'General Service'}</div>
                  <div className="mt-1 font-medium text-xs text-bauhaus-ink/65 truncate">{conversation.lastMessage || 'No messages yet'}</div>
                </Link>
              ))}
              {sortedConversations.length === 0 && (
                <div className="border-2 border-dashed border-bauhaus-ink bg-white p-4 text-center font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">
                  No conversations yet
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <NearMeFooter />
    </div>
  );
}

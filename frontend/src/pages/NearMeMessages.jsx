import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCheck, ImagePlus, MessageSquareText, MoreVertical, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import NearMeNav from '../components/nearme/NearMeNav';
import { ConversationListSkeleton, SkeletonBlock } from '../components/nearme/PageSkeletons';
import { apiRequest, getStoredToken, uploadImage } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getStoredNearMeUser } from '../lib/providerAccess';

function StatusBadge({ status }) {
  const map = {
    'Active Job': 'bg-bauhaus-yellow text-bauhaus-ink',
    Inquiry: 'bg-bauhaus-blue text-white',
    Accepted: 'bg-bauhaus-yellow text-bauhaus-ink',
    'In Progress': 'bg-bauhaus-blue text-white',
    'Pending Payment': 'bg-bauhaus-red text-white',
    'Pending Verification': 'bg-bauhaus-red text-white',
    Completed: 'bg-bauhaus-ink text-white',
  };
  return (
    <span className={`px-2 py-0.5 ${map[status] || 'bg-bauhaus-canvas text-bauhaus-ink'} font-bold text-[9px] uppercase tracking-wider border border-bauhaus-ink`}>
      {status || 'Inquiry'}
    </span>
  );
}

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const conversationPreviewText = (text = '') => {
  const value = String(text || '');
  if (!value) return 'No messages yet';
  if (value.startsWith('INQUIRY_CARD::')) return 'Service inquiry';
  if (value.startsWith('INQUIRY_RESPONSE::')) return 'Inquiry response';
  if (value.startsWith('WORK_PROOF_RECEIPT::')) return 'Work completion receipt';
  if (value.startsWith('WORK_PROOF::')) return 'Work completion proof';
  return value;
};
const toTimeValue = (value) => {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeJobStatus = (status = '') => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'accepted') return 'Accepted';
  if (value === 'in progress') return 'In Progress';
  if (value === 'pending payment') return 'Pending Payment';
  if (value === 'pending verification') return 'Pending Verification';
  if (value === 'completed') return 'Completed';
  return '';
};

const parseInquiryCard = (text = '') => {
  if (!text.startsWith('INQUIRY_CARD::')) return null;
  try {
    return JSON.parse(text.replace('INQUIRY_CARD::', ''));
  } catch {
    return null;
  }
};
const parseInquiryResponseCard = (text = '') => {
  if (!text.startsWith('INQUIRY_RESPONSE::')) return null;
  try {
    return JSON.parse(text.replace('INQUIRY_RESPONSE::', ''));
  } catch {
    return null;
  }
};
const parseWorkProofReceiptCard = (text = '') => {
  if (!text.startsWith('WORK_PROOF_RECEIPT::')) return null;
  try {
    return JSON.parse(text.replace('WORK_PROOF_RECEIPT::', ''));
  } catch {
    return null;
  }
};
const parseLegacyWorkProof = (text = '') => {
  if (!text.startsWith('WORK_PROOF::')) return null;
  const normalized = String(text).replace('WORK_PROOF::', '').trim();
  return {
    type: 'work_completion_receipt',
    receiptNo: 'Legacy',
    issuedAt: null,
    service: 'Service',
    summary: normalized || 'Work completion proof submitted',
    currency: 'PHP',
    proofImageCount: 0,
    breakdown: [],
    totalDue: 0,
  };
};
const formatMoney = (value, currency = 'PHP') => `${currency} ${Number(value || 0).toLocaleString('en-PH')}`;

function InquiryCardMessage({ payload }) {
  const fields = payload?.dynamicFields || {};
  return (
    <div className="max-w-[75%] border-2 border-bauhaus-ink bg-bauhaus-canvas shadow-[2px_2px_0px_0px_#121212] p-3">
      <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-red">Service Inquiry</div>
      <div className="mt-1 font-bold text-xs uppercase text-bauhaus-ink">{payload?.serviceCategory || 'General'}</div>
      <div className="mt-2 grid grid-cols-1 gap-1 text-xs font-medium text-bauhaus-ink/70">
        <div><span className="font-black text-bauhaus-ink">Schedule:</span> {payload?.bookingDate} {payload?.bookingTime}</div>
        <div><span className="font-black text-bauhaus-ink">Address:</span> {payload?.address}</div>
        {Object.entries(fields).map(([key, value]) => (
          <div key={key}><span className="font-black text-bauhaus-ink">{key}:</span> {String(value)}</div>
        ))}
        {payload?.notes && <div><span className="font-black text-bauhaus-ink">Notes:</span> {payload.notes}</div>}
      </div>
    </div>
  );
}
function WorkProofReceiptMessage({ payload }) {
  const rows = Array.isArray(payload?.breakdown) ? payload.breakdown : [];
  return (
    <div className="max-w-[75%] border-2 border-bauhaus-ink bg-white shadow-[2px_2px_0px_0px_#121212] p-3">
      <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-red">Work Completion Receipt</div>
      <div className="mt-1 font-bold text-xs uppercase text-bauhaus-ink">{payload?.receiptNo || 'Receipt'}</div>
      <div className="mt-2 text-xs font-medium text-bauhaus-ink/75 space-y-1">
        {payload?.service && <div><span className="font-black text-bauhaus-ink">Service:</span> {payload.service}</div>}
        {payload?.issuedAt && <div><span className="font-black text-bauhaus-ink">Issued:</span> {new Date(payload.issuedAt).toLocaleString()}</div>}
        {payload?.summary && <div><span className="font-black text-bauhaus-ink">Summary:</span> {payload.summary}</div>}
        <div><span className="font-black text-bauhaus-ink">Proof Images:</span> {Number(payload?.proofImageCount || 0)}</div>
      </div>
      {rows.length > 0 && (
        <div className="mt-2 border-2 border-bauhaus-ink">
          {rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="flex items-center justify-between px-2 py-1 border-b border-bauhaus-ink last:border-b-0 text-xs">
              <span className="font-black text-bauhaus-ink">{row.label}</span>
              <span className="font-bold text-bauhaus-ink">{formatMoney(row.amount || 0, payload?.currency || 'PHP')}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between border-t-2 border-bauhaus-ink pt-2">
        <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink">Total Due</span>
        <span className="font-black text-sm text-bauhaus-red">{formatMoney(payload?.totalDue || 0, payload?.currency || 'PHP')}</span>
      </div>
    </div>
  );
}

const peerFor = (conversation, currentUser) => {
  if (currentUser?.role === 'provider') {
    return conversation.customer || { name: 'Customer', avatar: '' };
  }
  return conversation.provider || { name: 'Provider', avatar: '', service: 'Service' };
};

export default function NearMeMessages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState(() => getStoredNearMeUser());
  const [authToken, setAuthToken] = useState(() => getStoredToken());
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState('list');
  const [quoteModal, setQuoteModal] = useState({ open: false, messageId: '', inquiry: null });
  const [quoteForm, setQuoteForm] = useState({ price: '', inclusions: '', breakdown: '', description: '' });
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);
  const pendingImagesRef = useRef([]);
  const lastSendRef = useRef({ text: '', at: 0, convoId: '' });
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

  useEffect(() => {
    const syncUser = () => {
      setCurrentUser(getStoredNearMeUser());
      setAuthToken(getStoredToken());
    };

    window.addEventListener('storage', syncUser);
    window.addEventListener('nearme:user-updated', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('nearme:user-updated', syncUser);
    };
  }, []);

  const loadConversations = async (preferredId = '') => {
    if (!authToken) return;

    setLoading(true);
    try {
      let nextConversations = await apiRequest('/api/conversations');
      const nextJobs = await apiRequest('/api/v1/jobs').catch(() => []);
      const providerId = searchParams.get('provider');
      const conversationId = searchParams.get('conversation');

      if (providerId) {
        const created = await apiRequest('/api/conversations', {
          method: 'POST',
          body: JSON.stringify({ providerId }),
        });
        nextConversations = [created, ...nextConversations.filter((conversation) => conversation._id !== created._id)];
      }

      setConversations(nextConversations);
      setJobs(Array.isArray(nextJobs) ? nextJobs : []);
      const selected = nextConversations.find((conversation) => conversation._id === preferredId)
        || nextConversations.find((conversation) => conversation._id === conversationId)
        || nextConversations.find((conversation) => conversation.provider?.id === providerId)
        || nextConversations[0]
        || null;
      setActiveConvo(selected);
      if (selected) setMobileView('chat');
    } catch (error) {
      toast.error(error.message || 'Could not load conversations');
      setConversations([]);
      setActiveConvo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [authToken, searchParams]);

  useEffect(() => {
    if (!activeConvo?._id) {
      setMessages([]);
      return;
    }

    apiRequest(`/api/conversations/${activeConvo._id}/messages`)
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .then(() => apiRequest(`/api/conversations/${activeConvo._id}/messages/read`, { method: 'PATCH' }).catch(() => null))
      .catch((error) => toast.error(error.message || 'Could not load messages'));
  }, [activeConvo?._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => () => {
    pendingImagesRef.current.forEach((item) => {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  useEffect(() => {
    if (!authToken || !currentUser?.id) return undefined;

    const socket = getSocket();
    socket.emit('join:user', currentUser.id);

    const onNewMessage = (message) => {
      const conversationId = String(message.conversationId || '');
      loadConversations(activeConvo?._id);
      if (activeConvo?._id && conversationId === String(activeConvo._id)) {
        setMessages((current) => (
          current.some((item) => String(item._id) === String(message._id))
            ? current
            : [...current, message]
        ));
      }
    };

    socket.on('message:new', onNewMessage);
    return () => socket.off('message:new', onNewMessage);
  }, [authToken, currentUser?.id, activeConvo?._id]);

  const activePeer = useMemo(() => peerFor(activeConvo || {}, currentUser), [activeConvo, currentUser]);
  const getMessageAvatar = (msg, isUserMessage) => {
    if (isUserMessage) return currentUser?.avatar || '';
    if (String(msg.senderId || '') === String(activeConvo?.customerUserId || '')) return activeConvo?.customer?.avatar || '';
    if (String(msg.senderId || '') === String(activeConvo?.providerUserId || '')) return activeConvo?.provider?.avatar || '';
    return activePeer?.avatar || '';
  };
  const activeJob = useMemo(() => {
    if (!activeConvo) return null;
    const matching = jobs
      .filter((job) => (
        (
          activeConvo._id
          && String(job.conversationId || '') === String(activeConvo._id)
        )
        || (
          String(job.providerUserId || '') === String(activeConvo.providerUserId || '')
          && String(job.clientUserId || '') === String(activeConvo.customerUserId || '')
        )
      ))
      .filter((job) => ['Accepted', 'In Progress', 'Pending Payment', 'Pending Verification', 'Completed'].includes(job.status))
      .sort((a, b) => toTimeValue(b.updatedAt || b.createdAt) - toTimeValue(a.updatedAt || a.createdAt));
    return matching[0] || null;
  }, [jobs, activeConvo]);
  const getConversationDisplayStatus = (conversation) => {
    if (!conversation) return 'Inquiry';
    const matching = jobs
      .filter((job) => (
        (
          conversation._id
          && String(job.conversationId || '') === String(conversation._id)
        )
        || (
          String(job.providerUserId || '') === String(conversation.providerUserId || '')
          && String(job.clientUserId || '') === String(conversation.customerUserId || '')
        )
      ))
      .sort((a, b) => toTimeValue(b.updatedAt || b.createdAt) - toTimeValue(a.updatedAt || a.createdAt));
    const normalized = normalizeJobStatus(matching[0]?.status || '');
    return normalized || conversation.status || 'Inquiry';
  };
  const activeConversationStatus = getConversationDisplayStatus(activeConvo);

  if (!currentUser || !authToken) return <Navigate to="/login" replace />;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/my-orders');
  };

  const send = async () => {
    const text = input.trim();
    const hasImages = pendingImages.length > 0;
    if ((!text && !hasImages) || !activeConvo?._id || sendingMessage) return;

    const now = Date.now();
    const last = lastSendRef.current;
    if (
      last.convoId === String(activeConvo._id)
      && last.text === text
      && !hasImages
      && (now - Number(last.at || 0)) < 1200
    ) {
      return;
    }

    setInput('');
    setSendingMessage(true);
    lastSendRef.current = { text, at: now, convoId: String(activeConvo._id) };

    try {
      let attachmentUrls = [];
      if (hasImages) {
        attachmentUrls = [];
        for (const item of pendingImages) {
          // Keep uploads sequential to reduce backend spikes.
          // eslint-disable-next-line no-await-in-loop
          const imageUrl = await uploadImage(item.file, 'chat-message');
          attachmentUrls.push(imageUrl);
        }
      }
      const created = await apiRequest(`/api/conversations/${activeConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text, attachments: attachmentUrls }),
      });
      setMessages((current) => (
        current.some((item) => String(item?._id || '') === String(created?._id || ''))
          ? current
          : [...current, created]
      ));
      pendingImages.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setPendingImages([]);
      loadConversations(activeConvo._id);
    } catch (error) {
      setInput(text);
      toast.error(error.message || 'Could not send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSelectImages = (event) => {
    const files = Array.from(event.target.files || []).filter((file) => String(file?.type || '').startsWith('image/'));
    if (files.length === 0) return;
    setPendingImages((current) => {
      const nextItems = files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
      return [...current, ...nextItems].slice(0, 6);
    });
    event.target.value = '';
  };

  const handleRejectInquiry = async (messageId, inquiryPayload) => {
    if (!activeConvo?._id) return;
    setActionBusyId(String(messageId));
    try {
      const text = `INQUIRY_RESPONSE::${JSON.stringify({
        inquiryMessageId: String(messageId),
        decision: 'rejected',
        serviceCategory: inquiryPayload?.serviceCategory || 'other',
        note: 'Provider declined this request.',
      })}`;
      const created = await apiRequest(`/api/conversations/${activeConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setMessages((current) => [...current, created]);
      loadConversations(activeConvo._id);
      toast.success('Inquiry rejected');
    } catch (error) {
      toast.error(error.message || 'Could not reject inquiry');
    } finally {
      setActionBusyId('');
    }
  };

  const openAcceptModal = (messageId, inquiryPayload) => {
    setQuoteForm({ price: '', inclusions: '', breakdown: '', description: '' });
    setQuoteModal({ open: true, messageId: String(messageId), inquiry: inquiryPayload || null });
  };

  const acceptInquiryDirect = async (messageId, inquiryPayload) => {
    if (!activeConvo?._id) return;
    setActionBusyId(String(messageId));
    try {
      const payload = {
        clientUserId: activeConvo.customerUserId || activeConvo.customer?.id,
        providerId: activeConvo.provider?.id || activeConvo.providerId || activeConvo.providerObjectId || activeConvo.providerKey,
        serviceCategory: inquiryPayload?.serviceCategory || 'other',
        bookingDate: inquiryPayload?.bookingDate,
        bookingTime: inquiryPayload?.bookingTime,
        address: inquiryPayload?.address,
        notes: inquiryPayload?.notes || '',
        inquiryMessageId: String(messageId),
        conversationId: activeConvo._id,
        inquiryPayload: inquiryPayload || null,
        quotedPrice: null,
        quoteBreakdown: '',
        quoteInclusions: [],
        quoteDescription: '',
      };
      if (!payload.clientUserId || !payload.providerId) {
        throw new Error('Missing client/provider reference. Please refresh this conversation and try again.');
      }

      try {
        await apiRequest('/api/v1/jobs/accept-inquiry', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (error) {
        const errorText = String(error.message || '');
        if (errorText.includes('Cannot POST')) {
          await apiRequest('/api/jobs/accept-inquiry', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        } else if (!errorText.includes('DUPLICATE_INQUIRY_ACCEPT')) {
          throw error;
        }
      }

      const selectedPrice = getSelectedPrice(inquiryPayload);
      payload.quotedPrice = selectedPrice > 0 ? selectedPrice : null;
      payload.quoteBreakdown = selectedPrice > 0 ? `Fixed price selected: PHP ${selectedPrice.toLocaleString('en-PH')}` : 'Accepted as selected service';
      const text = `INQUIRY_RESPONSE::${JSON.stringify({
        inquiryMessageId: String(messageId),
        decision: 'accepted',
        serviceCategory: inquiryPayload?.serviceCategory || 'other',
        quotedPrice: selectedPrice,
        currency: 'PHP',
        inclusions: [],
        breakdown: selectedPrice > 0 ? `Fixed price selected: PHP ${selectedPrice.toLocaleString('en-PH')}` : 'Accepted as selected service',
      })}`;
      const created = await apiRequest(`/api/conversations/${activeConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setMessages((current) => [...current, created]);
      loadConversations(activeConvo._id);
      toast.success('Inquiry accepted and added to queue');
    } catch (error) {
      const message = String(error.message || '');
      if (message.includes('COLLISION_DETECTED')) {
        toast.error('Schedule collision detected. Please coordinate another time.');
      } else if (message.includes('OUTSIDE_PROVIDER_AVAILABILITY')) {
        toast.error('Inquiry schedule falls on your off-day. Update your availability or ask client to reschedule.');
      } else if (message.includes('OUTSIDE_PROVIDER_WORKING_HOURS')) {
        toast.error('Inquiry time is outside your working hours. Update schedule or ask client to adjust time.');
      } else {
        toast.error(error.message || 'Could not accept inquiry');
      }
    } finally {
      setActionBusyId('');
    }
  };

  const submitAcceptedInquiry = async () => {
    if (!activeConvo?._id || !quoteModal.inquiry || !quoteModal.messageId) return;
    const price = Number(quoteForm.price);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Please enter a valid price.');
      return;
    }
    if (!quoteForm.inclusions.trim() || !quoteForm.breakdown.trim() || !quoteForm.description.trim()) {
      toast.error('Please fill in inclusions, breakdown, and description.');
      return;
    }

    setQuoteBusy(true);
    try {
      const inquiry = quoteModal.inquiry;
      const payload = {
        clientUserId: activeConvo.customerUserId || activeConvo.customer?.id,
        providerId: activeConvo.provider?.id || activeConvo.providerId || activeConvo.providerObjectId || activeConvo.providerKey,
        serviceCategory: inquiry.serviceCategory || 'other',
        bookingDate: inquiry.bookingDate,
        bookingTime: inquiry.bookingTime,
        address: inquiry.address,
        notes: inquiry.notes || '',
        inquiryMessageId: String(quoteModal.messageId),
        conversationId: activeConvo._id,
        inquiryPayload: inquiry,
        quotedPrice: price,
        quoteBreakdown: quoteForm.breakdown.trim(),
        quoteInclusions: quoteForm.inclusions.split('\n').map((line) => line.trim()).filter(Boolean),
        quoteDescription: quoteForm.description.trim(),
      };
      if (!payload.clientUserId || !payload.providerId) {
        throw new Error('Missing client/provider reference. Please refresh this conversation and try again.');
      }

      let jobAccepted = false;
      try {
        await apiRequest('/api/v1/jobs/accept-inquiry', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        jobAccepted = true;
      } catch (error) {
        const errorText = String(error.message || '');
        if (errorText.includes('Cannot POST')) {
          await apiRequest('/api/jobs/accept-inquiry', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          jobAccepted = true;
        } else if (errorText.includes('DUPLICATE_INQUIRY_ACCEPT')) {
          jobAccepted = true;
        } else {
          throw error;
        }
      }

      const text = `INQUIRY_RESPONSE::${JSON.stringify({
        inquiryMessageId: quoteModal.messageId,
        decision: 'accepted',
        serviceCategory: inquiry.serviceCategory || 'other',
        quotedPrice: price,
        currency: 'PHP',
        inclusions: payload.quoteInclusions,
        breakdown: quoteForm.breakdown.trim(),
        description: quoteForm.description.trim(),
      })}`;
      const created = await apiRequest(`/api/conversations/${activeConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setMessages((current) => [...current, created]);
      setQuoteModal({ open: false, messageId: '', inquiry: null });
      loadConversations(activeConvo._id);
      toast.success(jobAccepted ? 'Inquiry accepted and quote sent' : 'Quote sent');
    } catch (error) {
      const message = String(error.message || '');
      if (message.includes('COLLISION_DETECTED')) {
        toast.error('Schedule collision detected. Please coordinate another time.');
      } else if (message.includes('OUTSIDE_PROVIDER_AVAILABILITY')) {
        toast.error('Inquiry schedule falls on your off-day. Update your availability or ask client to reschedule.');
      } else if (message.includes('OUTSIDE_PROVIDER_WORKING_HOURS')) {
        toast.error('Inquiry time is outside your working hours. Update schedule or ask client to adjust time.');
      } else {
        toast.error(error.message || 'Could not accept inquiry');
      }
    } finally {
      setQuoteBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit flex flex-col">
      <NearMeNav />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="font-black text-2xl uppercase tracking-tighter text-bauhaus-ink">Messages</div>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider hover:bg-bauhaus-canvas"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        </div>

        <div className="flex border-4 border-bauhaus-ink shadow-bauhaus-lg overflow-hidden bg-white" style={{ height: 'calc(100vh - 240px)', minHeight: 500 }}>
          <div className={`w-full sm:w-72 lg:w-80 border-r-4 border-bauhaus-ink bg-white flex-shrink-0 overflow-y-auto ${mobileView === 'chat' ? 'hidden sm:flex flex-col' : 'flex flex-col'}`}>
            <div className="px-4 py-3 border-b-4 border-bauhaus-ink bg-bauhaus-canvas">
              <div className="font-black text-xs uppercase tracking-widest text-bauhaus-ink/50">All Conversations</div>
            </div>

            {loading && (
              <ConversationListSkeleton count={6} />
            )}

            {!loading && conversations.length === 0 && (
              <div className="p-6 text-center">
                <MessageSquareText className="h-9 w-9 mx-auto text-bauhaus-ink/25" />
                <div className="mt-3 font-black text-sm uppercase tracking-tight text-bauhaus-ink">No conversations yet</div>
                <div className="mt-1 font-medium text-xs text-bauhaus-ink/50">Open a provider profile and click Message to start one.</div>
              </div>
            )}

            {conversations.map((conversation) => {
              const peer = peerFor(conversation, currentUser);
              const isActive = activeConvo?._id === conversation._id;
              const unread = (conversation.unreadBy || []).includes(currentUser.id);
              const conversationStatus = getConversationDisplayStatus(conversation);

              return (
                <button
                  key={conversation._id}
                  onClick={() => { setActiveConvo(conversation); setMobileView('chat'); }}
                  className={`w-full flex items-start gap-3 px-4 py-4 border-b-2 border-bauhaus-ink/10 text-left transition-colors duration-200 ${isActive ? 'bg-bauhaus-yellow/30 border-l-4 border-l-bauhaus-red' : 'hover:bg-bauhaus-canvas'}`}
                >
                  <div className="w-10 h-10 border-2 border-bauhaus-ink bg-bauhaus-yellow flex items-center justify-center overflow-hidden shrink-0 font-black text-xs uppercase">
                    {peer.avatar ? <img src={peer.avatar} alt={peer.name} className="h-full w-full object-cover" /> : (peer.name || 'U').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink truncate">{peer.name}</div>
                      <div className="font-medium text-[9px] text-bauhaus-ink/40 shrink-0">{formatTime(conversation.lastMessageAt || conversation.updatedAt)}</div>
                    </div>
                    <StatusBadge status={conversationStatus} />
                    <div className="font-medium text-xs text-bauhaus-ink/50 mt-1 truncate">{conversationPreviewText(conversation.lastMessage)}</div>
                  </div>
                  {unread && <div className="w-3 h-3 bg-bauhaus-red rounded-full shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>

          <div className={`flex-1 flex flex-col bg-bauhaus-canvas ${mobileView === 'list' ? 'hidden sm:flex' : 'flex'}`}>
            {activeConvo ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3 bg-white border-b-4 border-bauhaus-ink">
                  <button onClick={() => setMobileView('list')} className="sm:hidden p-1 hover:text-bauhaus-red transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  {activeConvo.provider?.id ? (
                    <Link to={`/provider/${activeConvo.provider.id}`} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90">
                      <div className="w-9 h-9 border-2 border-bauhaus-ink bg-bauhaus-yellow flex items-center justify-center overflow-hidden shrink-0 font-black text-xs uppercase">
                        {activePeer.avatar ? <img src={activePeer.avatar} alt={activePeer.name} className="h-full w-full object-cover" /> : (activePeer.name || 'U').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink truncate">{activePeer.name}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[10px] text-bauhaus-ink/50">{activePeer.service || activePeer.email || 'Conversation'}</span>
                          <StatusBadge status={activeConversationStatus} />
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <>
                      <div className="w-9 h-9 border-2 border-bauhaus-ink bg-bauhaus-yellow flex items-center justify-center overflow-hidden shrink-0 font-black text-xs uppercase">
                        {activePeer.avatar ? <img src={activePeer.avatar} alt={activePeer.name} className="h-full w-full object-cover" /> : (activePeer.name || 'U').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink truncate">{activePeer.name}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[10px] text-bauhaus-ink/50">{activePeer.service || activePeer.email || 'Conversation'}</span>
                          <StatusBadge status={activeConversationStatus} />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 border-2 border-bauhaus-ink/20 hover:border-bauhaus-ink transition-colors">
                      <MoreVertical className="h-4 w-4 text-bauhaus-ink/50" />
                    </button>
                  </div>
                </div>

                {Boolean(activeJob) && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-bauhaus-yellow border-b-2 border-bauhaus-ink">
                    <AlertCircle className="h-3.5 w-3.5 text-bauhaus-ink shrink-0" />
                    <span className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink">Active booking conversation</span>
                    {activeJob?.status === 'Pending Payment' && (
                      <Link to={`/pay/${activeJob._id}`} className="ml-auto px-3 py-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[9px] uppercase tracking-wider">
                        Pay Now
                      </Link>
                    )}
                    {activeJob?.status === 'Completed' && (
                      <Link to={`/pay/${activeJob._id}`} className="ml-auto px-3 py-1 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[9px] uppercase tracking-wider">
                        Leave Review
                      </Link>
                    )}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                  {loading && (
                    <div className="space-y-3">
                      <SkeletonBlock className="h-16 w-3/4" />
                      <SkeletonBlock className="h-14 w-1/2 ml-auto" />
                      <SkeletonBlock className="h-16 w-2/3" />
                    </div>
                  )}
                  {messages.map((msg) => {
                    const isUser = String(msg.senderId) === String(currentUser.id);
                    const inquiryPayload = parseInquiryCard(msg.text || '');
                    const responsePayload = parseInquiryResponseCard(msg.text || '');
                    const workProofPayload = parseWorkProofReceiptCard(msg.text || '') || parseLegacyWorkProof(msg.text || '');
                    const inquiryResponse = inquiryPayload
                      ? messages
                        .map((messageItem) => parseInquiryResponseCard(messageItem.text || ''))
                        .find((response) => response && String(response.inquiryMessageId || '') === String(msg._id || ''))
                      : null;
                    const alreadyResponded = inquiryPayload
                      ? Boolean(inquiryResponse)
                      : false;
                    const canActOnInquiry = Boolean(
                      inquiryPayload
                      && !isUser
                      && String(currentUser?.role || '').toLowerCase() === 'provider'
                      && !alreadyResponded
                    );
                    const responseLinkedJob = responsePayload
                      ? jobs
                        .filter((job) => String(job.conversationId || '') === String(activeConvo?._id || ''))
                        .find((job) => (
                          String(job.inquiryMessageId || '') === String(responsePayload.inquiryMessageId || '')
                        ))
                      : null;
                    const isClientViewer = String(currentUser?.role || '').toLowerCase() !== 'provider';
                    return (
                      <div key={msg._id || msg.createdAt} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2`}>
                        {!isUser && (
                          <div className="w-7 h-7 border-2 border-bauhaus-ink bg-bauhaus-yellow shrink-0 flex items-center justify-center text-[9px] font-black uppercase overflow-hidden mt-0.5">
                            {getMessageAvatar(msg, false) ? (
                              <img src={getMessageAvatar(msg, false)} alt={msg.senderName || activePeer.name || 'User'} className="h-full w-full object-cover" />
                            ) : (
                              (msg.senderName || activePeer.name || 'U').slice(0, 2)
                            )}
                          </div>
                        )}
                        <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          {inquiryPayload ? (
                            <div className="space-y-2">
                              <InquiryCardMessage payload={inquiryPayload} />
                              {alreadyResponded && (
                                <span className={`inline-flex items-center px-2 py-0.5 border-2 border-bauhaus-ink font-black text-[9px] uppercase tracking-wider ${inquiryResponse?.decision === 'accepted' ? 'bg-bauhaus-blue text-white' : 'bg-bauhaus-red text-white'}`}>
                                  {inquiryResponse?.decision === 'accepted' ? 'Accepted' : 'Rejected'}
                                </span>
                              )}
                              {canActOnInquiry && (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={actionBusyId === String(msg._id)}
                                    onClick={() => {
                                      if (!isFixedOrBundleSelection(inquiryPayload)) {
                                        openAcceptModal(msg._id, inquiryPayload);
                                        return;
                                      }
                                      acceptInquiryDirect(msg._id, inquiryPayload);
                                    }}
                                    className="px-3 py-1.5 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionBusyId === String(msg._id)}
                                    onClick={() => handleRejectInquiry(msg._id, inquiryPayload)}
                                    className="px-3 py-1.5 bg-white text-bauhaus-red border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : responsePayload ? (
                            <div className="max-w-[75%] border-2 border-bauhaus-ink bg-white shadow-[2px_2px_0px_0px_#121212] p-3">
                              <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-red">Inquiry Response</div>
                              <div className="mt-1 font-bold text-xs uppercase text-bauhaus-ink">{responsePayload.decision === 'accepted' ? 'Accepted' : 'Rejected'}</div>
                              {responsePayload.decision === 'accepted' && (
                                <div className="mt-2 text-xs font-medium text-bauhaus-ink/75 space-y-1">
                                  <div><span className="font-black text-bauhaus-ink">Price:</span> PHP {Number(responsePayload.quotedPrice || 0).toLocaleString('en-PH')}</div>
                                  <div><span className="font-black text-bauhaus-ink">Breakdown:</span> {responsePayload.breakdown || '-'}</div>
                                  {responsePayload.description && (
                                    <div><span className="font-black text-bauhaus-ink">Description:</span> {responsePayload.description}</div>
                                  )}
                                  {Array.isArray(responsePayload.inclusions) && responsePayload.inclusions.length > 0 && (
                                    <div>
                                      <span className="font-black text-bauhaus-ink">Inclusions:</span> {responsePayload.inclusions.join(', ')}
                                    </div>
                                  )}
                                </div>
                              )}
                              {isClientViewer && (
                                (String(responseLinkedJob?.status || activeJob?.status || '').toLowerCase() === 'pending payment')
                                && (responseLinkedJob?._id || activeJob?._id)
                              ) && (
                                <div className="mt-3">
                                  <Link
                                    to={`/pay/${responseLinkedJob?._id || activeJob?._id}`}
                                    className="inline-flex items-center px-3 py-1.5 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
                                  >
                                    Pay Now
                                  </Link>
                                </div>
                              )}
                            </div>
                          ) : workProofPayload ? (
                            <WorkProofReceiptMessage payload={workProofPayload} />
                          ) : (
                            <div className={`px-4 py-3 border-2 border-bauhaus-ink text-sm font-medium leading-relaxed shadow-[2px_2px_0px_0px_#121212] ${isUser ? 'bg-bauhaus-red text-white' : 'bg-white text-bauhaus-ink'}`}>
                              {msg.text}
                            </div>
                          )}
                          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 w-full max-w-[360px]">
                              {msg.attachments.map((src, index) => (
                                <a
                                  key={`${msg._id || msg.createdAt}-attachment-${index}`}
                                  href={src}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block border-2 border-bauhaus-ink bg-white overflow-hidden"
                                >
                                  <img
                                    src={src}
                                    alt={`Attachment ${index + 1}`}
                                    className="h-28 w-full object-cover"
                                    loading="lazy"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                          <div className={`flex items-center gap-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                            <span className="font-medium text-[9px] text-bauhaus-ink/30">{formatTime(msg.createdAt)}</span>
                            {isUser && <CheckCheck className="h-3 w-3 text-bauhaus-blue" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center">
                      <div>
                        <MessageSquareText className="h-10 w-10 mx-auto text-bauhaus-ink/25" />
                        <div className="mt-3 font-black text-sm uppercase tracking-tight text-bauhaus-ink">Start the conversation</div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {pendingImages.length > 0 && (
                  <div className="px-3 pt-3 bg-white border-t-2 border-bauhaus-ink/20">
                    <div className="flex flex-wrap gap-2">
                      {pendingImages.map((file, index) => (
                        <div key={`pending-image-${index}`} className="relative w-20 h-20 border-2 border-bauhaus-ink bg-bauhaus-canvas overflow-hidden">
                          <img src={file.previewUrl} alt={`Selected ${index + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setPendingImages((current) => {
                                const target = current[index];
                                if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
                                return current.filter((_, idx) => idx !== index);
                              });
                            }}
                            className="absolute top-0 right-0 p-1 bg-bauhaus-red text-white border-l-2 border-b-bauhaus-ink"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t-4 border-bauhaus-ink bg-white px-3 py-3 flex items-center gap-2">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleSelectImages}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={sendingMessage}
                    className="w-10 h-10 bg-white border-2 border-bauhaus-ink flex items-center justify-center shadow-[2px_2px_0px_0px_black] transition-all duration-200 hover:bg-bauhaus-canvas active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Attach images"
                  >
                    <ImagePlus className="h-4 w-4 text-bauhaus-ink" />
                  </button>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue transition-colors"
                  />
                  <button
                    onClick={send}
                    disabled={(!input.trim() && pendingImages.length === 0) || sendingMessage}
                    className="w-10 h-10 bg-bauhaus-red border-2 border-bauhaus-ink flex items-center justify-center shadow-[2px_2px_0px_0px_black] transition-all duration-200 hover:bg-bauhaus-red/90 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4 text-white" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div>
                  <MessageSquareText className="h-12 w-12 mx-auto text-bauhaus-ink/25" />
                  <div className="mt-3 font-black text-sm uppercase tracking-tight text-bauhaus-ink">Select a conversation</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {quoteModal.open && (
        <div className="fixed inset-0 z-50 bg-bauhaus-ink/70 flex items-center justify-center px-4">
          <div className="w-full max-w-xl bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-5">
            <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">Accept Custom Inquiry</div>
            <div className="mt-2 text-xs font-medium text-bauhaus-ink/70">
              <div><span className="font-black text-bauhaus-ink">Category:</span> {quoteModal.inquiry?.serviceCategory || 'other'}</div>
              <div><span className="font-black text-bauhaus-ink">Schedule:</span> {quoteModal.inquiry?.bookingDate} {quoteModal.inquiry?.bookingTime}</div>
              <div><span className="font-black text-bauhaus-ink">Address:</span> {quoteModal.inquiry?.address || '-'}</div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Quoted Price (PHP)</span>
                <input
                  value={quoteForm.price}
                  onChange={(e) => setQuoteForm((current) => ({ ...current, price: e.target.value.replace(/[^\d]/g, '') }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink font-bold text-sm outline-none"
                  placeholder="e.g., 1200"
                />
              </label>
              <label className="block">
                <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Inclusions (one per line)</span>
                <textarea
                  rows={4}
                  value={quoteForm.inclusions}
                  onChange={(e) => setQuoteForm((current) => ({ ...current, inclusions: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink font-medium text-sm outline-none resize-none"
                />
              </label>
              <label className="block">
                <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Price Breakdown</span>
                <textarea
                  rows={3}
                  value={quoteForm.breakdown}
                  onChange={(e) => setQuoteForm((current) => ({ ...current, breakdown: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink font-medium text-sm outline-none resize-none"
                />
              </label>
              <label className="block">
                <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Scope Description</span>
                <textarea
                  rows={2}
                  value={quoteForm.description}
                  onChange={(e) => setQuoteForm((current) => ({ ...current, description: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-bauhaus-ink font-medium text-sm outline-none resize-none"
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setQuoteModal({ open: false, messageId: '', inquiry: null })}
                className="flex-1 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={quoteBusy}
                onClick={submitAcceptedInquiry}
                className="flex-1 px-3 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60"
              >
                {quoteBusy ? 'Submitting...' : 'Submit Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

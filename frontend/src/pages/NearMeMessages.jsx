import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCheck, MessageSquareText, MoreVertical, Send } from 'lucide-react';
import { toast } from 'sonner';
import NearMeNav from '../components/nearme/NearMeNav';
import { apiRequest, getStoredToken } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getStoredNearMeUser } from '../lib/providerAccess';

function StatusBadge({ status }) {
  const map = {
    'Active Job': 'bg-bauhaus-yellow text-bauhaus-ink',
    Inquiry: 'bg-bauhaus-blue text-white',
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

const peerFor = (conversation, currentUser) => {
  if (currentUser?.role === 'provider') {
    return conversation.customer || { name: 'Customer', avatar: '' };
  }
  return conversation.provider || { name: 'Provider', avatar: '', service: 'Service' };
};

export default function NearMeMessages() {
  const [searchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState(() => getStoredNearMeUser());
  const [authToken, setAuthToken] = useState(() => getStoredToken());
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState('list');
  const bottomRef = useRef(null);

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
      const providerId = searchParams.get('provider');

      if (providerId) {
        const created = await apiRequest('/api/conversations', {
          method: 'POST',
          body: JSON.stringify({ providerId }),
        });
        nextConversations = [created, ...nextConversations.filter((conversation) => conversation._id !== created._id)];
      }

      setConversations(nextConversations);
      const selected = nextConversations.find((conversation) => conversation._id === preferredId)
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

  if (!currentUser || !authToken) return <Navigate to="/login" replace />;

  const send = async () => {
    if (!input.trim() || !activeConvo?._id) return;

    const text = input.trim();
    setInput('');

    try {
      const created = await apiRequest(`/api/conversations/${activeConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setMessages((current) => [...current, created]);
      loadConversations(activeConvo._id);
    } catch (error) {
      setInput(text);
      toast.error(error.message || 'Could not send message');
    }
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit flex flex-col">
      <NearMeNav />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="font-black text-2xl uppercase tracking-tighter text-bauhaus-ink mb-5">Messages</div>

        <div className="flex border-4 border-bauhaus-ink shadow-bauhaus-lg overflow-hidden bg-white" style={{ height: 'calc(100vh - 240px)', minHeight: 500 }}>
          <div className={`w-full sm:w-72 lg:w-80 border-r-4 border-bauhaus-ink bg-white flex-shrink-0 overflow-y-auto ${mobileView === 'chat' ? 'hidden sm:flex flex-col' : 'flex flex-col'}`}>
            <div className="px-4 py-3 border-b-4 border-bauhaus-ink bg-bauhaus-canvas">
              <div className="font-black text-xs uppercase tracking-widest text-bauhaus-ink/50">All Conversations</div>
            </div>

            {loading && (
              <div className="p-5 font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">Loading conversations...</div>
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
                    <StatusBadge status={conversation.status} />
                    <div className="font-medium text-xs text-bauhaus-ink/50 mt-1 truncate">{conversation.lastMessage || 'No messages yet'}</div>
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
                  <div className="w-9 h-9 border-2 border-bauhaus-ink bg-bauhaus-yellow flex items-center justify-center overflow-hidden shrink-0 font-black text-xs uppercase">
                    {activePeer.avatar ? <img src={activePeer.avatar} alt={activePeer.name} className="h-full w-full object-cover" /> : (activePeer.name || 'U').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink truncate">{activePeer.name}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[10px] text-bauhaus-ink/50">{activePeer.service || activePeer.email || 'Conversation'}</span>
                      <StatusBadge status={activeConvo.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeConvo.provider?.id && (
                      <Link to={`/provider/${activeConvo.provider.id}`} className="px-3 py-1.5 bg-bauhaus-red text-white font-bold text-[9px] uppercase tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-red/90 transition-colors">
                        Profile
                      </Link>
                    )}
                    <button className="p-1.5 border-2 border-bauhaus-ink/20 hover:border-bauhaus-ink transition-colors">
                      <MoreVertical className="h-4 w-4 text-bauhaus-ink/50" />
                    </button>
                  </div>
                </div>

                {activeConvo.status === 'Active Job' && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-bauhaus-yellow border-b-2 border-bauhaus-ink">
                    <AlertCircle className="h-3.5 w-3.5 text-bauhaus-ink shrink-0" />
                    <span className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink">Active booking conversation</span>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                  {messages.map((msg) => {
                    const isUser = String(msg.senderId) === String(currentUser.id);
                    return (
                      <div key={msg._id || msg.createdAt} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                        {!isUser && (
                          <div className="w-7 h-7 border-2 border-bauhaus-ink bg-bauhaus-yellow shrink-0 flex items-center justify-center text-[9px] font-black uppercase">
                            {(msg.senderName || activePeer.name || 'U').slice(0, 2)}
                          </div>
                        )}
                        <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className={`px-4 py-3 border-2 border-bauhaus-ink text-sm font-medium leading-relaxed shadow-[2px_2px_0px_0px_#121212] ${isUser ? 'bg-bauhaus-red text-white' : 'bg-white text-bauhaus-ink'}`}>
                            {msg.text}
                          </div>
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

                <div className="border-t-4 border-bauhaus-ink bg-white px-3 py-3 flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue transition-colors"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim()}
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
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft, MessageSquareText, ArrowRight } from 'lucide-react';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import { apiRequest, getStoredToken } from '../lib/api';
import { getStoredNearMeUser } from '../lib/providerAccess';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function NearMeClientChatHistory() {
  const [user] = useState(() => getStoredNearMeUser());
  const [token] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    let mounted = true;
    apiRequest('/api/conversations')
      .then((data) => {
        if (!mounted) return;
        setConversations(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
    [conversations]
  );

  if (!user || !token) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/settings" className="inline-flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-bauhaus-ink/50 hover:text-bauhaus-red transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back To Profile
        </Link>

        <div className="mt-5 border-b-4 border-bauhaus-ink pb-4">
          <h1 className="font-black text-2xl sm:text-3xl uppercase tracking-tighter text-bauhaus-ink">Chat History</h1>
          <p className="mt-1 font-medium text-sm text-bauhaus-ink/50">Review your past provider conversations.</p>
        </div>

        <section className="mt-6 bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg">
          <div className="px-5 py-4 border-b-2 border-bauhaus-ink bg-bauhaus-canvas">
            <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Conversations</div>
          </div>

          <div className="p-4 space-y-3">
            {loading && (
              <div className="border-2 border-bauhaus-ink bg-white p-4 font-bold text-xs uppercase tracking-wider text-bauhaus-ink/45">
                Loading chat history...
              </div>
            )}

            {!loading && sortedConversations.length === 0 && (
              <div className="border-2 border-dashed border-bauhaus-ink bg-white p-6 text-center">
                <MessageSquareText className="h-8 w-8 mx-auto text-bauhaus-ink/30" />
                <div className="mt-2 font-black text-xs uppercase tracking-wider text-bauhaus-ink/45">No conversations yet</div>
              </div>
            )}

            {sortedConversations.map((conversation) => (
              <Link
                key={conversation._id}
                to={`/messages?conversation=${encodeURIComponent(conversation._id)}`}
                className="block border-2 border-bauhaus-ink bg-white hover:bg-bauhaus-canvas p-4 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink truncate">
                    {conversation.provider?.name || conversation.customer?.name || 'Conversation'}
                  </div>
                  <div className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/45">
                    {formatTime(conversation.lastMessageAt || conversation.updatedAt)}
                  </div>
                </div>
                <div className="mt-1 font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink/45">
                  {conversation.provider?.service || 'General Service'}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-medium text-xs text-bauhaus-ink/65">{conversation.lastMessage || 'No messages yet'}</p>
                  <span className="inline-flex items-center gap-1 font-black text-[10px] uppercase tracking-wider text-bauhaus-blue shrink-0">
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <NearMeFooter />
    </div>
  );
}


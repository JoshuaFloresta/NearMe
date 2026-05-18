import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Paperclip, CheckCheck, ArrowLeft, MoreVertical, Phone, Video, MapPin, AlertCircle } from 'lucide-react';
import NearMeNav from '../components/nearme/NearMeNav';
import { MOCK_PROVIDERS, MOCK_MESSAGES } from '../lib/nearMeData';

const CONVERSATIONS = MOCK_PROVIDERS.slice(0, 4).map((p, i) => ({
  provider: p,
  lastMsg: MOCK_MESSAGES[i % MOCK_MESSAGES.length]?.text || '',
  lastTime: `${10 + i}:${30 + i * 5} AM`,
  unread: i === 0 ? 2 : 0,
  status: ['Active Job', 'Inquiry', 'Completed', 'Inquiry'][i],
}));

function StatusBadge({ status }) {
  const map = {
    'Active Job': 'bg-bauhaus-yellow text-bauhaus-ink',
    'Inquiry': 'bg-bauhaus-blue text-white',
    'Completed': 'bg-bauhaus-ink text-white',
  };
  return (
    <span className={`px-2 py-0.5 ${map[status] || 'bg-bauhaus-canvas text-bauhaus-ink'} font-bold text-[9px] uppercase tracking-wider border border-bauhaus-ink`}>
      {status}
    </span>
  );
}

export default function NearMeMessages() {
  const [activeConvo, setActiveConvo] = useState(CONVERSATIONS[0]);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    setMessages([...messages, { id: Date.now(), from: 'user', text: input, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInput('');
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, from: 'provider', text: 'yes po babi 🥺🍆', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit flex flex-col">
      <NearMeNav />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="font-black text-2xl uppercase tracking-tighter text-bauhaus-ink mb-5">Messages</div>

        <div className="flex border-4 border-bauhaus-ink shadow-bauhaus-lg overflow-hidden" style={{ height: 'calc(100vh - 240px)', minHeight: 500 }}>
          {/* Conversation list */}
          <div className={`w-full sm:w-72 lg:w-80 border-r-4 border-bauhaus-ink bg-white flex-shrink-0 overflow-y-auto ${mobileView === 'chat' ? 'hidden sm:flex flex-col' : 'flex flex-col'}`}>
            <div className="px-4 py-3 border-b-4 border-bauhaus-ink bg-bauhaus-canvas">
              <div className="font-black text-xs uppercase tracking-widest text-bauhaus-ink/50">All Conversations</div>
            </div>
            {CONVERSATIONS.map((c, i) => (
              <button
                key={i}
                onClick={() => { setActiveConvo(c); setMobileView('chat'); }}
                className={`w-full flex items-start gap-3 px-4 py-4 border-b-2 border-bauhaus-ink/10 text-left transition-colors duration-200 ${activeConvo.provider.id === c.provider.id ? 'bg-bauhaus-yellow/30 border-l-4 border-l-bauhaus-red' : 'hover:bg-bauhaus-canvas'}`}
              >
                <div className="relative shrink-0">
                  <img src={c.provider.avatar} alt={c.provider.name} className="w-10 h-10 object-cover border-2 border-bauhaus-ink" />
                  {c.provider.available && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-bauhaus-yellow border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div className="font-black text-xs uppercase tracking-tight text-bauhaus-ink truncate">{c.provider.name}</div>
                    <div className="font-medium text-[9px] text-bauhaus-ink/40 shrink-0">{c.lastTime}</div>
                  </div>
                  <StatusBadge status={c.status} />
                  <div className="font-medium text-xs text-bauhaus-ink/50 mt-1 truncate">{c.lastMsg}</div>
                </div>
                {c.unread > 0 && (
                  <div className="w-5 h-5 bg-bauhaus-red rounded-full flex items-center justify-center font-black text-[9px] text-white shrink-0">{c.unread}</div>
                )}
              </button>
            ))}
          </div>

          {/* Chat window */}
          <div className={`flex-1 flex flex-col bg-bauhaus-canvas ${mobileView === 'list' ? 'hidden sm:flex' : 'flex'}`}>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b-4 border-bauhaus-ink">
              <button
                onClick={() => setMobileView('list')}
                className="sm:hidden p-1 hover:text-bauhaus-red transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <img src={activeConvo.provider.avatar} alt={activeConvo.provider.name} className="w-9 h-9 object-cover border-2 border-bauhaus-ink" />
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink truncate">{activeConvo.provider.name}</div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${activeConvo.provider.available ? 'bg-bauhaus-yellow' : 'bg-bauhaus-ink/20'}`} />
                  <span className="font-medium text-[10px] text-bauhaus-ink/50">{activeConvo.provider.service}</span>
                  <StatusBadge status={activeConvo.status} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/provider/${activeConvo.provider.id}`}
                  className="px-3 py-1.5 bg-bauhaus-red text-white font-bold text-[9px] uppercase tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-red/90 transition-colors"
                >
                  Profile
                </Link>
                <button className="p-1.5 border-2 border-bauhaus-ink/20 hover:border-bauhaus-ink transition-colors">
                  <MoreVertical className="h-4 w-4 text-bauhaus-ink/50" />
                </button>
              </div>
            </div>

            {/* Job status notice */}
            <div className="flex items-center gap-2 px-4 py-2 bg-bauhaus-yellow border-b-2 border-bauhaus-ink">
              <AlertCircle className="h-3.5 w-3.5 text-bauhaus-ink shrink-0" />
              <span className="font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink">Active Booking — Plumbing Service, May 20, 2026 2:00 PM</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
              {messages.map((msg) => {
                const isUser = msg.from === 'user';
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                    {!isUser && (
                      <img src={activeConvo.provider.avatar} alt="" className="w-7 h-7 object-cover border-2 border-bauhaus-ink shrink-0" />
                    )}
                    <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className={`px-4 py-3 border-2 border-bauhaus-ink text-sm font-medium leading-relaxed shadow-[2px_2px_0px_0px_#121212] ${isUser ? 'bg-bauhaus-red text-white' : 'bg-white text-bauhaus-ink'}`}>
                        {msg.text}
                      </div>
                      <div className={`flex items-center gap-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                        <span className="font-medium text-[9px] text-bauhaus-ink/30">{msg.time}</span>
                        {isUser && <CheckCheck className="h-3 w-3 text-bauhaus-blue" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t-4 border-bauhaus-ink bg-white px-3 py-3 flex items-center gap-2">
              <button className="p-2 border-2 border-bauhaus-ink/30 hover:border-bauhaus-ink transition-colors">
                <Paperclip className="h-4 w-4 text-bauhaus-ink/50" />
              </button>
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
          </div>
        </div>
      </div>
    </div>
  );
}
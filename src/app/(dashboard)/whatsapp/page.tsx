'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '../../../lib/lang-context';
import { API_BASE as API } from '@/lib/config';
const token = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

interface Conversation {
  phone: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
}

function fmtTime(s: string, isAr: boolean) {
  const d = new Date(s);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 86_400_000) return d.toLocaleTimeString(isAr ? 'ar-EG' : 'en-EG', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-EG', { day: 'numeric', month: 'short' });
}

export default function WhatsAppPage() {
  const { isAr } = useLang();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await fetch(`${API}/whatsapp/conversations`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setConversations(Array.isArray(json) ? json : (json.data ?? []));
    } catch { setConversations([]); }
    finally { setLoadingConvs(false); }
  }, []);

  const loadMessages = useCallback(async (phone: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`${API}/whatsapp/conversations/${encodeURIComponent(phone)}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setMessages(Array.isArray(json) ? json : (json.messages ?? json.data ?? []));
    } catch { setMessages([]); }
    finally { setLoadingMsgs(false); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (selectedPhone) loadMessages(selectedPhone);
    else setMessages([]);
  }, [selectedPhone, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredConvs = conversations.filter((c) =>
    c.phone.toLowerCase().includes(search.toLowerCase()),
  );

  async function sendMessage() {
    if (!selectedPhone || !body.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/whatsapp/send`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ phone: selectedPhone, body: body.trim(), companyId: 'company-001' }),
      });
      setBody('');
      await loadMessages(selectedPhone);
    } catch { /* non-critical */ }
    finally { setSending(false); }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <div style={{
        width: '280px', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '0.875rem 1rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
        }}>
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)' }}>
            {isAr ? 'المحادثات' : 'Conversations'}
          </h2>
          <button className="btn btn-primary btn-sm">{isAr ? 'رسالة جديدة' : 'New Message'}</button>
        </div>

        {/* Search */}
        <div style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
          <input
            className="input"
            placeholder={isAr ? 'بحث برقم الهاتف…' : 'Search by phone…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs ? (
            <p style={{ padding: '1.5rem 1rem', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
              {isAr ? 'جارٍ التحميل…' : 'Loading…'}
            </p>
          ) : filteredConvs.length === 0 ? (
            <p style={{ padding: '1.5rem 1rem', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
              {isAr ? 'لا توجد محادثات.' : 'No conversations.'}
            </p>
          ) : (
            filteredConvs.map((c) => {
              const active = selectedPhone === c.phone;
              return (
                <button
                  key={c.phone}
                  onClick={() => setSelectedPhone(c.phone)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border)',
                    background: active ? 'var(--surface-2)' : 'transparent',
                    cursor: 'pointer',
                    border: 'none',
                    borderLeft: active ? '3px solid var(--tab-active)' : '3px solid transparent',
                    display: 'block',
                    transition: 'background 120ms',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-1)' }}>
                      {c.phone}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                      {fmtTime(c.lastMessageAt, isAr)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                    <span style={{
                      fontSize: '0.75rem', color: 'var(--text-3)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {c.lastMessage}
                    </span>
                    {c.unreadCount > 0 && (
                      <span style={{
                        background: 'var(--primary)', color: '#fff',
                        borderRadius: '9999px', fontSize: '0.625rem', fontWeight: 700,
                        padding: '0.1rem 0.4rem', marginLeft: '0.5rem', flexShrink: 0,
                      }}>
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Main panel ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        {!selectedPhone ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '0.75rem', color: 'var(--text-3)',
          }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ opacity: 0.25 }}>
              <rect x="2" y="4" width="40" height="30" rx="6" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 38l5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M13 18h18M13 24h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{isAr ? 'اختر محادثة' : 'Select a conversation'}</p>
            <p style={{ fontSize: '0.8125rem' }}>{isAr ? 'اختر جهة اتصال من الشريط الجانبي' : 'Choose a contact from the sidebar'}</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{
              padding: '0.75rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0,
            }}>
              <div style={{
                width: '2.25rem', height: '2.25rem', borderRadius: '9999px',
                background: 'var(--primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
              }}>
                WA
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)', lineHeight: 1.2 }}>
                  {selectedPhone}
                </p>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{isAr ? 'واتساب' : 'WhatsApp'}</p>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '1rem 1.25rem',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
            }}>
              {loadingMsgs ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>{isAr ? 'جارٍ تحميل الرسائل…' : 'Loading messages…'}</p>
              ) : messages.length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>{isAr ? 'لا توجد رسائل بعد.' : 'No messages yet.'}</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} style={{
                    display: 'flex',
                    justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '68%',
                      background: m.direction === 'outbound'
                        ? 'color-mix(in srgb, var(--primary) 14%, var(--surface))'
                        : 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: m.direction === 'outbound'
                        ? '12px 12px 2px 12px'
                        : '12px 12px 12px 2px',
                      padding: '0.5rem 0.75rem',
                      boxShadow: '0 1px 2px oklch(0 0 0 / 0.06)',
                    }}>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-1)', lineHeight: 1.5 }}>
                        {m.body}
                      </p>
                      <p style={{ fontSize: '0.625rem', color: 'var(--text-3)', marginTop: '0.25rem', textAlign: 'right' }}>
                        {fmtTime(m.createdAt, isAr)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex', gap: '0.75rem', alignItems: 'flex-end',
              flexShrink: 0,
            }}>
              <textarea
                className="textarea"
                style={{ flex: 1, minHeight: '2.5rem', maxHeight: '8rem', resize: 'vertical' }}
                placeholder={isAr ? 'اكتب رسالة… (Enter للإرسال، Shift+Enter لسطر جديد)' : 'Type a message… (Enter to send, Shift+Enter for newline)'}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                rows={1}
              />
              <button
                className="btn btn-primary"
                onClick={sendMessage}
                disabled={!body.trim() || sending}
                style={{ flexShrink: 0 }}
              >
                {sending ? '…' : (isAr ? 'إرسال' : 'Send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

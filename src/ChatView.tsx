/**
 * ChatView.tsx
 * Dedicated Gemini-Style AI Assistant for Chronos.
 * Chats with the user just like Gemini, extracts schedule tasks instantly,
 * and automatically applies them directly to the Master Schedule with zero manual steps.
 */

import { useState, useRef, useEffect } from 'react';
import type { ScheduleEvent, UserProfile, ToastMsg } from './App';
import { sendChatMessage, type ChatMessage } from './chatbotService';
import { loadAISettings } from './aiScheduleExtractor';

interface ChatViewProps {
  events: ScheduleEvent[];
  onApplySchedule: (newEvents: ScheduleEvent[]) => void;
  userProfile: UserProfile;
  toast: (msg: string, type?: ToastMsg['type']) => void;
  onViewCalendar: () => void;
  onBackToDashboard: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  academic: '#4a6fa5',
  spiritual: '#D4AF37',
  engineering: '#7c5cbf',
  meeting: '#4a8a5c',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ChatView({
  events,
  onApplySchedule,
  userProfile,
  toast,
  onViewCalendar,
  onBackToDashboard,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('chronos_chat_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const aiSettings = loadAISettings();

  useEffect(() => {
    localStorage.setItem('chronos_chat_history', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleApplyDraftEvents = (draftEvents: ScheduleEvent[]) => {
    const combined = [...events];
    draftEvents.forEach(draft => {
      const existsIdx = combined.findIndex(e => e.day === draft.day && e.hour === draft.hour && e.minute === draft.minute);
      if (existsIdx >= 0) {
        combined[existsIdx] = draft;
      } else {
        combined.push(draft);
      }
    });

    onApplySchedule(combined);
    toast(`Automatically added ${draftEvents.length} event(s) to your Master Schedule with alarms armed!`, 'success');
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const assistantMsg = await sendChatMessage(text, messages, events, userProfile);
      setMessages(prev => [...prev, assistantMsg]);

      // AUTOMATICALLY APPLY IMMEDIATELY - Zero friction, zero download required!
      if (assistantMsg.draftEvents && assistantMsg.draftEvents.length > 0) {
        handleApplyDraftEvents(assistantMsg.draftEvents);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `I encountered an issue processing that: ${err.message || 'Please check your connection'}. You can try again or check Settings.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionType: 'info',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Clear chat conversation?')) {
      setMessages([]);
      localStorage.removeItem('chronos_chat_history');
      toast('Chat history cleared');
    }
  };

  const suggestions = [
    'I have DSP Lab on Friday at 5:00 PM',
    'Create a balanced weekly engineering study plan',
    'Add Math on Monday 9:00 AM to 11:00 AM',
    'What do I have scheduled for Friday?',
  ];

  return (
    <div className="chat-layout fade-in">
      {/* Top Navigation & Status Bar */}
      <div className="chat-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-outline"
            onClick={onBackToDashboard}
            style={{ padding: '5px 10px', fontSize: '11.5px' }}
            title="Return to Dashboard"
          >
            ← Back to Dashboard
          </button>
          <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="brand-icon" style={{ width: 28, height: 28 }}>
              <span style={{ fontSize: 14 }}>✨</span>
            </div>
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                Gemini Schedule Assistant
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                {aiSettings.apiKey ? 'Connected to Gemini 1.5 Flash' : 'Instant AI Extractor Active'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-gold"
            onClick={onViewCalendar}
            style={{ padding: '5px 12px', fontSize: '11.5px' }}
            title="View your Master Schedule calendar"
          >
            📅 View Master Schedule
          </button>

          {messages.length > 0 && (
            <button
              className="btn-outline"
              onClick={handleClearChat}
              style={{ padding: '5px 8px', fontSize: '11px', color: 'var(--text-muted)' }}
              title="Clear chat"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Messages Area */}
      <div className="chat-messages-container">
        {messages.length === 0 ? (
          /* Gemini Empty State Hero */
          <div style={{ textAlign: 'center', margin: 'auto 0', padding: '30px 16px' }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.05) 100%)',
              border: '1px solid rgba(212,175,55,0.3)',
              margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px var(--gold-glow)'
            }}>
              <span style={{ fontSize: 26 }}>✨</span>
            </div>

            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Hello, {userProfile.name.split(' ')[0]}
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 24px', lineHeight: '1.55' }}>
              Chat with Gemini just like a real assistant. Tell me what classes or tasks you have, and I will <strong>extract them and place them on your calendar with precision alarms armed immediately</strong>.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', maxWidth: '640px', margin: '0 auto', textAlign: 'left' }}>
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSend(s)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  }}
                >
                  <span style={{ color: 'var(--gold)', marginRight: '6px' }}>💬</span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`chat-message-row ${isUser ? 'chat-row-user' : 'chat-row-assistant'}`}>
                {!isUser && (
                  <div className="chat-avatar-assistant">
                    ✨
                  </div>
                )}

                <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                  <div className="chat-bubble-text" style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>

                  {/* Immediate Extracted Schedule Confirmation */}
                  {msg.draftEvents && msg.draftEvents.length > 0 && (
                    <div className="chat-schedule-card">
                      <div className="chat-schedule-header">
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#78d28e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="status-dot-green" />
                          Live on Your Calendar ({msg.draftEvents.length} events)
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600 }}>
                          Alarms Armed 🔔
                        </span>
                      </div>

                      <div className="chat-schedule-list">
                        {msg.draftEvents.map((ev, i) => {
                          const h12 = ev.hour === 0 ? 12 : ev.hour > 12 ? ev.hour - 12 : ev.hour;
                          const ampm = ev.hour >= 12 ? 'PM' : 'AM';
                          const timeStr = `${h12}:${String(ev.minute).padStart(2, '0')} ${ampm}`;
                          return (
                            <div key={i} className="chat-schedule-item">
                              <div className="chat-item-dot" style={{ background: CATEGORY_COLORS[ev.category] || 'var(--gold)' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {ev.title}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {DAY_NAMES[ev.day]} · {timeStr} ({ev.duration}m) {ev.subtitle ? `· ${ev.subtitle}` : ''}
                                </div>
                              </div>
                              <span className="cat-tag" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                                {ev.category}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                        <button
                          className="btn-gold"
                          onClick={onViewCalendar}
                          style={{ padding: '5px 12px', fontSize: '11.5px' }}
                        >
                          📅 Open Master Schedule →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Google Doc confirmation pill */}
                  {msg.googleDocUrl && (
                    <div style={{ marginTop: '10px' }}>
                      <a
                        href={msg.googleDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-gold"
                        style={{ display: 'inline-flex', padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}
                      >
                        📄 Open Google Doc →
                      </a>
                    </div>
                  )}

                  <div className="chat-bubble-time">{msg.timestamp}</div>
                </div>

                {isUser && (
                  <div className="chat-avatar-user">
                    {userProfile.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            );
          })
        )}

        {isTyping && (
          <div className="chat-message-row chat-row-assistant">
            <div className="chat-avatar-assistant">✨</div>
            <div className="chat-bubble chat-bubble-assistant" style={{ padding: '12px 16px' }}>
              <div className="chat-typing-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips (when chat has messages) */}
      {messages.length > 0 && (
        <div className="chat-chips-scroll">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              className="chat-suggestion-chip"
              onClick={() => handleSend(s)}
              disabled={isTyping}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Floating Prompt Input Bar */}
      <div className="chat-input-bar">
        <input
          className="chat-input-field"
          placeholder="Message Gemini... e.g. 'I have DSP Lab on Friday at 5:00 PM and Math on Monday at 9:00 AM'"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isTyping}
          autoFocus
        />
        <button
          className="btn-gold"
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          Send →
        </button>
      </div>
    </div>
  );
}

/**
 * ChatView.tsx
 * Conversational Chatbot view for Chronos.
 * Enables conversing with Gemini/Local AI to build schedules,
 * modify events, ask timetable questions, and export directly to Google Drive/Docs.
 */

import { useState, useRef, useEffect } from 'react';
import type { ScheduleEvent, UserProfile, ToastMsg } from './App';
import { sendChatMessage, type ChatMessage } from './chatbotService';
import {
  isGoogleDriveConnected,
  loadGoogleDriveConfig,
  createGoogleDocWithSchedule,
  downloadScheduleDocument,
  requestGoogleDriveAccess,
} from './googleDriveService';
import { loadAISettings } from './aiScheduleExtractor';

interface ChatViewProps {
  events: ScheduleEvent[];
  onApplySchedule: (newEvents: ScheduleEvent[]) => void;
  userProfile: UserProfile;
  toast: (msg: string, type?: ToastMsg['type']) => void;
  onOpenSettings: () => void;
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
  onOpenSettings,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('chronos_chat_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hi **${userProfile.name}**! I'm your **Chronos AI Assistant**.\n\nYou can talk to me just like Gemini. Tell me what classes or tasks you want to schedule, and I'll place them on your calendar, arm your alarms, or create a Google Document for you in Google Drive.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionType: 'info',
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [driveConnected, setDriveConnected] = useState(isGoogleDriveConnected());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const aiSettings = loadAISettings();
  const driveConfig = loadGoogleDriveConfig();

  useEffect(() => {
    localStorage.setItem('chronos_chat_history', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `I encountered an error: ${err.message || 'Unable to connect to AI'}. Please check your connection or API settings.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionType: 'info',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleApplyDraft = (draftEvents: ScheduleEvent[]) => {
    // Merge or replace
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
    toast(`Applied ${draftEvents.length} events to your Master Schedule with alarms armed!`, 'success');
  };

  const handleCreateGoogleDoc = async (draftEvents?: ScheduleEvent[]) => {
    const targetEvents = draftEvents || events;
    if (targetEvents.length === 0) {
      toast('No schedule events to export yet', 'info');
      return;
    }

    if (!isGoogleDriveConnected()) {
      if (!driveConfig.clientId) {
        toast('Please enter your Google Client ID in Settings → Google Drive Integration', 'info');
        onOpenSettings();
        return;
      }
      requestGoogleDriveAccess(
        driveConfig.clientId,
        async (token) => {
          setDriveConnected(true);
          try {
            const title = `${userProfile.name}'s Chronos Timetable`;
            const { docUrl } = await createGoogleDocWithSchedule(title, targetEvents, undefined, token);
            window.open(docUrl, '_blank');
            toast('Google Doc created and opened!', 'success');
          } catch (e: any) {
            toast(`Drive Error: ${e.message}`, 'info');
          }
        },
        (err) => toast(`Google Sign-In failed: ${err}`, 'info')
      );
      return;
    }

    try {
      toast('Creating Google Document in your Google Drive...', 'info');
      const title = `${userProfile.name}'s Chronos Timetable - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
      const { docUrl } = await createGoogleDocWithSchedule(title, targetEvents);
      window.open(docUrl, '_blank');
      toast('Google Document created successfully!', 'success');
    } catch (err: any) {
      toast(`Error creating Google Doc: ${err.message}`, 'info');
    }
  };

  const handleDownloadDoc = (draftEvents?: ScheduleEvent[]) => {
    const targetEvents = draftEvents || events;
    downloadScheduleDocument(`${userProfile.name}_Chronos_Schedule`, targetEvents);
    toast('Schedule document downloaded', 'success');
  };

  const handleClearChat = () => {
    if (confirm('Clear chat conversation?')) {
      const welcome: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `Conversation cleared. Tell me what you'd like to schedule, or ask a question!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionType: 'info',
      };
      setMessages([welcome]);
      localStorage.removeItem('chronos_chat_history');
      toast('Chat history cleared');
    }
  };

  const suggestions = [
    'Create an engineering study schedule for me',
    'Add Friday 5:00 PM: Project Review',
    'Create a Google Doc for my schedule',
    'What do I have scheduled for Friday?',
  ];

  return (
    <div className="chat-layout fade-in">
      {/* Header bar */}
      <div className="chat-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-icon" style={{ width: 34, height: 34 }}>
            <span style={{ fontSize: 16 }}>✨</span>
          </div>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
              Chronos AI Assistant
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {aiSettings.apiKey ? 'Powered by Google Gemini 1.5 Flash' : 'Powered by Chronos Intelligent Assistant Engine'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {driveConnected ? (
            <span className="status-pill status-pill-active" title="Connected to Google Drive">
              <span className="status-dot-green" />
              Drive Connected
            </span>
          ) : (
            <button
              className="btn-outline"
              onClick={onOpenSettings}
              style={{ padding: '4px 10px', fontSize: '11px' }}
              title="Connect your Google Drive in Settings"
            >
              <span>Connect Drive</span>
            </button>
          )}

          <button
            className="btn-outline"
            onClick={handleClearChat}
            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-muted)' }}
            title="Clear Chat History"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Suggestion Chips */}
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

      {/* Messages Thread */}
      <div className="chat-messages-container">
        {messages.map((msg) => {
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

                {/* Interactive Schedule Block Card */}
                {msg.draftEvents && msg.draftEvents.length > 0 && (
                  <div className="chat-schedule-card">
                    <div className="chat-schedule-header">
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gold)' }}>
                        🗓️ Extracted Schedule ({msg.draftEvents.length} events)
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        Precision Alarms Ready
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

                    <div className="chat-schedule-actions">
                      <button
                        className="btn-gold"
                        onClick={() => handleApplyDraft(msg.draftEvents!)}
                        style={{ padding: '6px 12px', fontSize: '11.5px', flex: 1, justifyContent: 'center' }}
                      >
                        ✓ Apply to Calendar & Arm Alarms
                      </button>

                      <button
                        className="btn-outline"
                        onClick={() => handleCreateGoogleDoc(msg.draftEvents)}
                        style={{ padding: '6px 10px', fontSize: '11.5px' }}
                        title="Create a Google Document in your Google Drive"
                      >
                        📁 Save to Google Drive
                      </button>

                      <button
                        className="btn-outline"
                        onClick={() => handleDownloadDoc(msg.draftEvents)}
                        style={{ padding: '6px 8px', fontSize: '11.5px' }}
                        title="Download as HTML / Markdown document"
                      >
                        ⬇
                      </button>
                    </div>
                  </div>
                )}

                {/* Google Doc URL confirmation pill */}
                {msg.googleDocUrl && (
                  <div style={{ marginTop: '10px' }}>
                    <a
                      href={msg.googleDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gold"
                      style={{ display: 'inline-flex', padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}
                    >
                      📄 Open Document in Google Docs →
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
        })}

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

      {/* Input bar */}
      <div className="chat-input-bar">
        <input
          className="chat-input-field"
          placeholder="Ask Chronos AI or say: 'Create a schedule for Monday 9am Math and Friday 5pm Review'..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isTyping}
        />
        <button
          className="btn-gold"
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

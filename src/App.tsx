import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { readFileText } from './scheduleParser';
import {
  extractScheduleWithAI,
  loadAISettings,
  saveAISettings,
  getLocalTimeZone,
  type AISettings,
} from './aiScheduleExtractor';

// ─── SVG Icons ──────────────────────────────────────────────────────────────
type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

const IconClock = ({ size = 16, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconBell = ({ size = 16, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconCalendar = ({ size = 16, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconGrid = ({ size = 16, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconSettings = ({ size = 16, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconUpload = ({ size = 32, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const IconCheck = ({ size = 16, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconChevronLeft = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconChevronRight = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconX = ({ size = 16, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconPlus = ({ size = 16, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconZap = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconTrash = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IconVolume = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);
const IconUser = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconSparkles = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>
  </svg>
);
const IconLogOut = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconDownload = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconCpu = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
  </svg>
);
const IconPhone = ({ size = 14, className = '', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);

// ─── Types ───────────────────────────────────────────────────────────────────
type NavView = 'dashboard' | 'calendar' | 'alarms' | 'settings';
type Category = 'academic' | 'spiritual' | 'engineering' | 'meeting';
type AlarmMode = 'sound' | 'popup';

export interface UserProfile {
  name: string;
  department: string;
  year: string;
  role: string;
  email?: string;
  phoneWebhook?: string;
  joinedAt: string;
}

export interface ScheduleEvent {
  id: string;
  day: number; // 0=Mon … 6=Sun
  hour: number;
  minute: number;
  duration: number; // minutes
  title: string;
  subtitle: string;
  category: Category;
  alarmEnabled: boolean;
}

// ─── Helpers: Initials & Names ────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || 'CH').toUpperCase();
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

// ─── Audio Chime, Spoken Voice & Mobile Notifications ─────────────────────────
function playAlarmChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Harmonic golden chime: D5 (587Hz), A5 (880Hz), D6 (1174Hz)
    const freqs = [587.33, 880.0, 1174.66];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.24, now + idx * 0.14 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 1.3);
    });
  } catch (e) {
    console.warn('Audio chime playback warning:', e);
  }
}

/** Spoken voice reminder reading out the task name and time */
function speakAlarmAnnouncement(taskTitle: string, timeStr: string) {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `Attention. It is ${timeStr}. Time for ${taskTitle}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.warn('Speech synthesis warning:', e);
  }
}

function triggerMobileVibration() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([400, 200, 400, 200, 800]);
    }
  } catch (e) {
    console.warn('Vibration not supported:', e);
  }
}

function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendDesktopNotification(title: string, body: string, webhookUrl?: string) {
  // 1. Browser / Mobile notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/chronos-icon.svg' });
    } catch (e) {
      console.warn('Notification warning:', e);
    }
  }

  // 2. Mobile Webhook trigger (Pushover, Telegram bot, or Webhook alert)
  if (webhookUrl && webhookUrl.trim().startsWith('http')) {
    try {
      fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message: body, timestamp: new Date().toISOString() }),
        mode: 'no-cors',
      }).catch(err => console.warn('Mobile alert webhook push failed:', err));
    } catch (err) {
      console.warn('Webhook dispatch error:', err);
    }
  }
}

// ─── Clean Initial State (ZERO Placeholders) ──────────────────────────────────
const INITIAL_EVENTS: ScheduleEvent[] = [];

const CATEGORY_DOT_COLORS: Record<Category, string> = {
  academic:    '#4a6fa5',
  spiritual:   '#D4AF37',
  engineering: '#7c5cbf',
  meeting:     '#4a8a5c',
};

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

let _nextId = 1000;
const newId = () => `e${_nextId++}`;

// ─── Format Helpers ───────────────────────────────────────────────────────────
function formatHour(h: number) {
  if (h === 0)  return '12 AM';
  if (h < 12)   return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function fmt12(h: number, m: number) {
  const suffix = h < 12 ? 'AM' : 'PM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

function CatTag({ category }: { category: Category }) {
  const labels: Record<Category, string> = {
    academic: 'Academic', spiritual: 'Spiritual',
    engineering: 'Engineering', meeting: 'Meeting',
  };
  return <span className={`cat-tag cat-${category}`}>{labels[category]}</span>;
}

// ─── Upcoming Alarms Calculation ──────────────────────────────────────────────
export interface UpcomingAlarmItem {
  id: string;
  event: ScheduleEvent;
  targetDate: Date;
  secondsRemaining: number;
  formattedTime: string;
  dayLabel: string;
}

export function computeUpcomingAlarms(events: ScheduleEvent[], now = new Date()): UpcomingAlarmItem[] {
  const currentChronosDay = (now.getDay() + 6) % 7; // 0=Mon ... 6=Sun
  const enabled = events.filter(e => e.alarmEnabled);

  const items: UpcomingAlarmItem[] = enabled.map(e => {
    let dayDiff = (e.day - currentChronosDay + 7) % 7;
    let target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayDiff, e.hour, e.minute, 0, 0);

    if (target.getTime() <= now.getTime()) {
      target = new Date(target.getTime() + 7 * 24 * 3600 * 1000);
    }
    const secondsRemaining = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
    const dayLabel = dayDiff === 0 && target.getDate() === now.getDate() ? 'Today' : DAYS[e.day];

    return {
      id: e.id,
      event: e,
      targetDate: target,
      secondsRemaining,
      formattedTime: fmt12(e.hour, e.minute),
      dayLabel,
    };
  });

  return items.sort((a, b) => a.secondsRemaining - b.secondsRemaining);
}

function formatCountdown(sec: number): string {
  if (sec <= 0) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Toast System ─────────────────────────────────────────────────────────────
interface ToastMsg { id: number; text: string; type?: 'success' | 'info' }
let _toastId = 0;

function ToastContainer({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 200, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
      {toasts.map(t => (
        <div key={t.id}
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
            borderLeft: `3px solid ${t.type === 'success' ? 'var(--green)' : 'var(--gold)'}`,
            borderRadius: 'var(--radius-sm)', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: '10px',
            fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.2s ease',
            maxWidth: '340px',
          }}
        >
          <IconCheck size={14} style={{ color: t.type === 'success' ? 'var(--green)' : 'var(--gold)', flexShrink: 0 }} />
          <span>{t.text}</span>
          <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto', lineHeight: 1 }}>
            <IconX size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const push = useCallback((text: string, type: ToastMsg['type'] = 'success') => {
    const id = _toastId++;
    setToasts(p => [...p, { id, text, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, push, dismiss };
}

// ─── Sign Up / Onboarding View ────────────────────────────────────────────────
function SignUpView({
  onSignUp,
  initialData,
}: {
  onSignUp: (profile: UserProfile) => void;
  initialData?: UserProfile | null;
}) {
  const [name, setName] = useState(initialData?.name || '');
  const [department, setDepartment] = useState(initialData?.department || '');
  const [year, setYear] = useState(initialData?.year || 'Year 1');
  const [email, setEmail] = useState(initialData?.email || '');
  const [error, setError] = useState('');
  const userTimezone = getLocalTimeZone();

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    const role = department.trim() ? `${department.trim()} · ${year}` : year;
    onSignUp({
      name: name.trim(),
      department: department.trim() || 'Schedule Master',
      year,
      role,
      email: email.trim(),
      joinedAt: initialData?.joinedAt || new Date().toISOString(),
    });
  };

  return (
    <div className="signup-wrapper fade-in">
      <div className="signup-card">
        {/* Brand */}
        <div className="signup-brand-header">
          <div className="brand-icon" style={{ width: '40px', height: '40px' }}>
            <IconClock size={20} style={{ color: '#0a0800' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)' }}>
              Chronos
            </div>
            <div style={{ fontSize: '11px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
              AI Timetable & Precision Alarms
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            {initialData ? 'Edit Profile' : 'Create Your Chronos Account'}
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Sign up below. Next, upload your schedule document and Chronos AI will automatically extract your timetable and activate your phone alarms.
          </p>
        </div>

        {/* Feature Highlights */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span className="signup-pill">
            <IconCpu size={11} style={{ color: 'var(--gold)' }} /> LLM Schedule Extraction
          </span>
          <span className="signup-pill">
            <IconClock size={11} style={{ color: 'var(--blue)' }} /> {userTimezone}
          </span>
          <span className="signup-pill">
            <IconPhone size={11} style={{ color: 'var(--green)' }} /> Phone Alarms & Alerts
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="modal-label">Your Full Name *</label>
            <input
              className="modal-input"
              placeholder="e.g. John Doe, Sarah Smith"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <span style={{ color: '#e05252', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>{error}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '10px' }}>
            <div>
              <label className="modal-label">Major / Field / Profession</label>
              <input
                className="modal-input"
                placeholder="e.g. Engineering, Medicine, Law"
                value={department}
                onChange={e => setDepartment(e.target.value)}
              />
            </div>
            <div>
              <label className="modal-label">Level / Title</label>
              <select
                className="modal-input"
                value={year}
                onChange={e => setYear(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="Year 1">Year 1</option>
                <option value="Year 2">Year 2</option>
                <option value="Year 3">Year 3</option>
                <option value="Year 4">Year 4</option>
                <option value="Final Year">Final Year</option>
                <option value="Postgraduate">Postgraduate</option>
                <option value="Professional">Professional</option>
              </select>
            </div>
          </div>

          <div>
            <label className="modal-label">Email Address (Optional)</label>
            <input
              type="email"
              className="modal-input"
              placeholder="user@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="submit"
              className="btn-gold"
              style={{ flex: 1, justifyContent: 'center', padding: '11px 16px', fontSize: '13px' }}
            >
              <IconCheck size={14} />
              <span>{initialData ? 'Save Changes' : 'Start Workspace & Upload Schedule →'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  view,
  setView,
  userProfile,
  alarmCount,
  onOpenProfile,
  onInstallApp,
  isInstalled,
  focusStreak,
}: {
  view: NavView;
  setView: (v: NavView) => void;
  userProfile: UserProfile;
  alarmCount: number;
  onOpenProfile: () => void;
  onInstallApp: () => void;
  isInstalled: boolean;
  focusStreak: number;
}) {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <IconClock size={16} style={{ color: '#0a0800' }} />
        </div>
        <div>
          <div className="brand-name">Chronos</div>
          <div className="brand-sub">Schedule & Alarms</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>

        <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
          <IconGrid size={16} className="nav-icon" />
          <span>Dashboard</span>
        </div>

        <div className={`nav-item ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
          <IconCalendar size={16} className="nav-icon" />
          <span>Master Schedule</span>
        </div>

        <div className={`nav-item ${view === 'alarms' ? 'active' : ''}`}
          onClick={() => { setView('alarms'); }}>
          <IconBell size={16} className="nav-icon" />
          <span>Alarms</span>
          {alarmCount > 0 && <span className="nav-badge">{alarmCount}</span>}
        </div>

        <div className="nav-section-label">System</div>

        <div className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <IconSettings size={16} className="nav-icon" />
          <span>Settings</span>
        </div>
      </nav>

      {/* Real Focus Streak */}
      <div className="sidebar-streak">
        <div className="streak-header">
          <span className="streak-label">Focus Streak</span>
          <IconZap size={13} style={{ color: 'var(--gold)' }} />
        </div>
        <div className="streak-count">{focusStreak}</div>
        <div className="streak-sub">days active</div>
        <div className="streak-bar">
          <div className="streak-fill" style={{ width: `${Math.min(100, Math.max(15, focusStreak * 14))}%` }} />
        </div>
      </div>

      {/* Install App Button */}
      {!isInstalled && (
        <div style={{ margin: '0 10px 10px' }}>
          <button
            onClick={onInstallApp}
            className="btn-outline"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '7px 8px',
              fontSize: '11px',
              borderColor: 'rgba(212,175,55,0.3)',
              background: 'rgba(212,175,55,0.06)',
              color: 'var(--gold)',
              fontWeight: 600,
            }}
            title="Install Chronos as a standalone desktop PC or mobile application"
          >
            <IconDownload size={13} />
            <span>Install App (PC/Mobile)</span>
          </button>
        </div>
      )}

      {/* Profile */}
      <div className="sidebar-profile" onClick={onOpenProfile} title="Click to view and edit profile">
        <div className="profile-avatar">{getInitials(userProfile.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="profile-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {userProfile.name}
          </div>
          <div className="profile-role" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {userProfile.role}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({
  title,
  onOpenAlarm,
  alarmCount,
  onTestAlarm,
  userProfile,
  onOpenProfile,
}: {
  title: string;
  onOpenAlarm: () => void;
  alarmCount: number;
  onTestAlarm: () => void;
  userProfile: UserProfile;
  onOpenProfile: () => void;
}) {
  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">
        {alarmCount > 0 && (
          <button
            onClick={onTestAlarm}
            className="btn-outline"
            style={{ padding: '4px 10px', fontSize: '11.5px', height: '30px' }}
            title="Play alarm sound and trigger overlay"
          >
            <IconVolume size={13} style={{ color: 'var(--gold)' }} />
            <span>Test Alarm</span>
          </button>
        )}

        <div className={`topbar-btn${alarmCount > 0 ? ' alarm-active' : ''}`} onClick={onOpenAlarm} title="Active Alarms" style={{ position: 'relative' }}>
          <IconBell size={15} />
          {alarmCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              width: '14px', height: '14px', background: 'var(--gold)',
              borderRadius: '50%', fontSize: '8px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#0a0800',
            }}>{alarmCount}</span>
          )}
        </div>

        <div
          className="profile-avatar"
          onClick={onOpenProfile}
          title={`Signed in as ${userProfile.name} - Click to edit`}
          style={{ width: '28px', height: '28px', fontSize: '11px', cursor: 'pointer', border: '1px solid var(--border-strong)' }}
        >
          {getInitials(userProfile.name)}
        </div>
      </div>
    </div>
  );
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────
function Dropzone({
  file,
  setFile,
  isProcessing,
  processingStep,
}: {
  file: File | null;
  setFile: (f: File | null) => void;
  isProcessing: boolean;
  processingStep: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const accept = ['.docx', '.md', '.txt'];

  const handleFile = (f: File) => {
    const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
    if (accept.includes(ext)) {
      setFile(f);
      requestNotificationPermission();
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  return (
    <div
      className={`dropzone${drag ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => !file && !isProcessing && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".docx,.md,.txt" style={{ display: 'none' }}
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

      {file ? (
        <>
          {!isProcessing && (
            <button className="file-clear" onClick={e => { e.stopPropagation(); setFile(null); }}>
              <IconX size={14} />
            </button>
          )}
          <div className="file-success">
            {isProcessing ? (
              <IconCpu size={24} style={{ color: 'var(--gold)', animation: 'pulse-ring 1.5s infinite' }} />
            ) : (
              <IconCheck size={22} className="file-success-icon" />
            )}
            <div>
              <div className="file-success-name">{file.name}</div>
              <div className="file-success-size">
                {isProcessing ? processingStep : `${fmtSize(file.size)} · Automatically synced to calendar & alarms armed`}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="dropzone-icon"><IconUpload size={28} /></div>
          <div className="dropzone-title">Upload your schedule document</div>
          <div className="dropzone-sub">Click or drag & drop your timetable (.docx, .md, .txt)</div>
          <div className="dropzone-types">
            {accept.map(t => <span key={t} className="type-badge">{t}</span>)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dashboard quick-stat card ────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card card-sm" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '22px', fontWeight: 700, color: color ?? 'var(--gold)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
  onViewCalendar,
  events,
  setEvents,
  alarmMode,
  setAlarmMode,
  onOpenAlarmWithEvent,
  userProfile,
  focusStreak,
  completedIds,
  toast,
}: {
  onViewCalendar: () => void;
  events: ScheduleEvent[];
  setEvents: React.Dispatch<React.SetStateAction<ScheduleEvent[]>>;
  alarmMode: AlarmMode;
  setAlarmMode: (m: AlarmMode) => void;
  onOpenAlarmWithEvent: (ev: ScheduleEvent) => void;
  userProfile: UserProfile;
  focusStreak: number;
  completedIds: Set<string>;
  toast: (msg: string, type?: ToastMsg['type']) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [now, setNow] = useState(new Date());

  const userTimezone = getLocalTimeZone();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const upcomingAlarms = useMemo(() => computeUpcomingAlarms(events, now), [events, now]);
  const nextAlarm = upcomingAlarms[0];

  const todayIdx = (now.getDay() + 6) % 7; // 0=Mon
  const todayEvents = events.filter(e => e.day === todayIdx);
  const enabledAlarms = events.filter(e => e.alarmEnabled);

  const completedTodayCount = todayEvents.filter(e => completedIds.has(e.id)).length;
  const progressPercent = todayEvents.length > 0 ? Math.round((completedTodayCount / todayEvents.length) * 100) : 0;

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Handle schedule document upload and automatic extraction & placement
  const processDocumentText = async (text: string, sourceName: string) => {
    setIsProcessing(true);
    setProcessingStep('Analyzing timetable structure with AI...');
    try {
      const aiSettings = loadAISettings();
      setProcessingStep(`Extracting schedule & aligning to ${userTimezone}...`);

      const result = await extractScheduleWithAI(text, aiSettings);

      if (result.events.length === 0) {
        toast(`No schedule events found in ${sourceName}. Check your file formatting.`, 'info');
        return;
      }

      setProcessingStep('Arming precision alarms and building calendar grid...');

      // Convert to ScheduleEvent objects with alarmEnabled = true
      const newScheduleEvents: ScheduleEvent[] = result.events.map(ev => ({
        id: ev.id || newId(),
        day: ev.day,
        hour: ev.hour,
        minute: ev.minute,
        duration: ev.duration || 60,
        title: ev.title,
        subtitle: ev.subtitle || `${userTimezone} · Scheduled Block`,
        category: ev.category,
        alarmEnabled: true,
      }));

      // Automatically place on calendar & set up alarms!
      setEvents(newScheduleEvents);
      localStorage.setItem('chronos_events', JSON.stringify(newScheduleEvents));

      // Trigger soft chime for confirmation
      if (alarmMode === 'sound') {
        playAlarmChime();
      }

      const engineLabel = result.source === 'gemini' ? 'Gemini AI' : result.source === 'openai' ? 'OpenAI' : 'Chronos AI Engine';
      toast(`Extracted & placed ${newScheduleEvents.length} events on your calendar via ${engineLabel} with all alarms armed!`, 'success');
    } catch (err: any) {
      console.error('Schedule extraction error:', err);
      toast(`AI Extraction Error: ${err.message || 'Failed to process document'}`, 'info');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Triggered when file state changes
  useEffect(() => {
    if (!file) return;
    readFileText(file)
      .then(text => processDocumentText(text, file.name))
      .catch(err => {
        console.error(err);
        toast(`Could not read file: ${err.message}`, 'info');
      });
  }, [file]);

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    setPasteModalOpen(false);
    processDocumentText(pastedText, 'Pasted Text');
    setPastedText('');
  };

  const handleClearSchedule = () => {
    if (confirm('Clear all schedule events and reset alarms?')) {
      setEvents([]);
      setFile(null);
      localStorage.removeItem('chronos_events');
      toast('Schedule cleared', 'info');
    }
  };

  return (
    <div className="content-columns">
      {/* ── Main column ── */}
      <div className="col-main">
        {/* Header card with user's name */}
        <div className="card">
          <div className="dash-header">
            <div>
              <div className="dash-date">{dateStr} · {userTimezone}</div>
              <div className="dash-welcome">{greeting}, {getFirstName(userProfile.name)}</div>
              <div className="dash-sub">
                {userProfile.department} · {events.length === 0 ? 'Upload your schedule document below to start.' : `${todayEvents.length} scheduled events today · ${enabledAlarms.length} alarms armed`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {events.length > 0 && (
                <button className="btn-outline" onClick={handleClearSchedule} style={{ color: '#e05252', borderColor: 'rgba(224,82,82,0.25)', fontSize: '12px' }}>
                  <IconTrash size={12} /> Clear
                </button>
              )}
              <button className="btn-gold" onClick={onViewCalendar}>
                <IconCalendar size={13} />
                View Schedule
              </button>
            </div>
          </div>
        </div>

        {/* Quick stats (No Placeholders) */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <StatCard
            label="Today's Events"
            value={todayEvents.length}
            sub={events.length === 0 ? "No schedule loaded" : todayEvents.length === 1 ? "1 event today" : `${todayEvents.length} events today`}
            color="var(--gold)"
          />
          <StatCard
            label="Armed Alarms"
            value={enabledAlarms.length}
            sub={enabledAlarms.length === 0 ? "No active alarms" : `${enabledAlarms.length} reminders ready`}
            color="#7baad4"
          />
          <StatCard
            label="Focus Streak"
            value={`${focusStreak}d`}
            sub="days active"
            color="#b09de0"
          />
          <StatCard
            label="Daily Progress"
            value={todayEvents.length > 0 ? `${progressPercent}%` : "0%"}
            sub={todayEvents.length > 0 ? `${completedTodayCount}/${todayEvents.length} complete` : "No events today"}
            color="#7ec49a"
          />
        </div>

        {/* Dropzone */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div className="card-title" style={{ marginBottom: 0 }}>Upload Schedule Document</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                AI auto-extracts your timetable and arms all alarms automatically.
              </div>
            </div>
            <button
              onClick={() => setPasteModalOpen(true)}
              className="btn-outline"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              title="Paste your timetable text directly"
            >
              <IconSparkles size={12} style={{ color: 'var(--gold)' }} />
              <span>Paste Schedule Text</span>
            </button>
          </div>

          <Dropzone
            file={file}
            setFile={setFile}
            isProcessing={isProcessing}
            processingStep={processingStep}
          />
        </div>

        {/* Extracted Schedule Card */}
        <div className="card">
          <div className="parser-header">
            <div className="parser-dot" />
            <div className="parser-title">Active Schedule & Timetable</div>
            <span className="parser-status">
              {isProcessing ? 'AI Processing...' : events.length > 0 ? `${events.length} Events Active` : 'No Schedule'}
            </span>
          </div>

          {events.length > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  Current timetable placed in your calendar ({events.length} blocks):
                </span>
                <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600 }}>
                  All Alarms Armed
                </span>
              </div>

              <div className="parsed-list">
                {events.map((b) => (
                  <div key={b.id} className="parsed-item">
                    <div className="parsed-item-dot" style={{ background: CATEGORY_DOT_COLORS[b.category] }} />
                    <div className="parsed-item-info">
                      <div className="parsed-item-name">{b.title}</div>
                      <div className="parsed-item-time">
                        {DAYS[b.day]} · {fmt12(b.hour, b.minute)} ({b.duration} min) {b.subtitle ? `· ${b.subtitle}` : ''}
                      </div>
                    </div>
                    <CatTag category={b.category} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(212,175,55,0.08)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCpu size={22} style={{ color: 'var(--gold)' }} />
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Your Schedule is Empty
              </div>
              <div style={{ fontSize: '12px', maxWidth: '380px', margin: '0 auto', lineHeight: '1.5' }}>
                Upload your course syllabus, class timetable, or schedule document (.docx, .txt, .md) above.
                Chronos AI will automatically extract your classes and set alarms for your local time.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right column ── */}
      <div className="col-right">
        <div className="alarm-heading">Upcoming Alarms</div>

        {/* Live Countdown */}
        <div className="countdown-card">
          <div className="countdown-label">Next Alarm In</div>
          <div className="countdown-time">
            {nextAlarm ? formatCountdown(nextAlarm.secondsRemaining) : '--:--:--'}
          </div>
          <div className="countdown-event">
            {nextAlarm ? `${nextAlarm.event.title} · ${nextAlarm.dayLabel} ${nextAlarm.formattedTime}` : 'No active alarms'}
          </div>
        </div>

        {/* Real Dynamic Alarm Ticker */}
        <div className="ticker-list">
          {upcomingAlarms.slice(0, 6).map((item, idx) => (
            <div
              key={item.id}
              className={`ticker-item${idx === 0 ? ' next' : ''}`}
              onClick={() => onOpenAlarmWithEvent(item.event)}
              title="Click to view alarm details"
            >
              <div className="ticker-dot" style={{ background: CATEGORY_DOT_COLORS[item.event.category] }} />
              <div className="ticker-time">{item.formattedTime}</div>
              <div className="ticker-name">{item.event.title}</div>
              {idx === 0 && (
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--gold)', background: 'rgba(212,175,55,0.12)', borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>NEXT</span>
              )}
            </div>
          ))}

          {upcomingAlarms.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', lineHeight: '1.4' }}>
              No upcoming alarms.<br/>Upload your timetable to arm alerts.
            </div>
          )}
        </div>

        {/* Alarm mode */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Alarm Mode</div>
          <div className="segmented">
            <button className={`seg-btn${alarmMode === 'sound' ? ' active' : ''}`} onClick={() => setAlarmMode('sound')}>Sound + Popup</button>
            <button className={`seg-btn${alarmMode === 'popup' ? ' active' : ''}`} onClick={() => setAlarmMode('popup')}>Popup Only</button>
          </div>
        </div>

        {/* Real Daily Progress */}
        <div className="progress-section">
          <div className="progress-label">Daily Progress</div>
          <div className="progress-bar-wrap">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="progress-stats">
            <span>{todayEvents.length > 0 ? `${completedTodayCount} of ${todayEvents.length} complete` : 'No events today'}</span>
            <span>{progressPercent}%</span>
          </div>
        </div>

        {/* Category legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>Categories</div>
          {(['academic', 'spiritual', 'engineering', 'meeting'] as Category[]).map(c => {
            const count = events.filter(e => e.category === c).length;
            return (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: CATEGORY_DOT_COLORS[c], flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize', flex: 1 }}>{c}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paste Modal */}
      {pasteModalOpen && (
        <div className="modal-backdrop fade-in" onClick={e => e.target === e.currentTarget && setPasteModalOpen(false)}>
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div className="modal-row">
              <div className="modal-title">Paste Schedule / Syllabus Text</div>
              <button className="modal-close" onClick={() => setPasteModalOpen(false)}><IconX size={16} /></button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Paste your raw schedule, syllabus dates, or class timetable below. Chronos AI will extract the events and arm alarms.
            </p>
            <textarea
              className="modal-input"
              rows={8}
              placeholder="e.g.&#10;Monday&#10;9:00 AM - 10:30 AM: Machine Learning (LT1)&#10;2:00 PM: Project Meeting&#10;&#10;Tuesday 11:00 AM: Physics Lab"
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setPasteModalOpen(false)}>Cancel</button>
              <button
                className="btn-gold"
                onClick={handlePasteSubmit}
                disabled={!pastedText.trim()}
                style={{ opacity: pastedText.trim() ? 1 : 0.5 }}
              >
                <IconZap size={13} /> Extract & Set Alarms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Event create / edit modal ────────────────────────────────────────────────
const BLANK_EVENT: Omit<ScheduleEvent, 'id'> = {
  day: 0, hour: 9, minute: 0, duration: 60,
  title: '', subtitle: '', category: 'academic', alarmEnabled: true,
};

function EventModal({ event, onSave, onClose, onDelete }: {
  event: Partial<ScheduleEvent> & { id?: string };
  onSave: (e: ScheduleEvent) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const isEdit = !!event.id;
  const [draft, setDraft] = useState<Omit<ScheduleEvent, 'id'>>({
    ...BLANK_EVENT,
    ...event,
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const valid = draft.title.trim().length > 0;
  const catOptions: Category[] = ['academic', 'spiritual', 'engineering', 'meeting'];

  return (
    <div className="modal-backdrop fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-row">
          <div className="modal-title">{isEdit ? 'Edit Event' : 'Add Event'}</div>
          <button className="modal-close" onClick={onClose}><IconX size={16} /></button>
        </div>

        {/* Title */}
        <div className="modal-section">
          <label className="modal-label">Title</label>
          <input className="modal-input" autoFocus placeholder="Event title"
            value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
        </div>

        {/* Subtitle */}
        <div className="modal-section">
          <label className="modal-label">Subtitle / Location</label>
          <input className="modal-input" placeholder="e.g. Room 204, Zoom, Office"
            value={draft.subtitle} onChange={e => setDraft(d => ({ ...d, subtitle: e.target.value }))} />
        </div>

        {/* Day + Time row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div className="modal-section">
            <label className="modal-label">Day</label>
            <select className="modal-input" style={{ cursor: 'pointer' }}
              value={draft.day} onChange={e => setDraft(d => ({ ...d, day: +e.target.value }))}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="modal-section">
            <label className="modal-label">Start hour</label>
            <select className="modal-input" style={{ cursor: 'pointer' }}
              value={draft.hour} onChange={e => setDraft(d => ({ ...d, hour: +e.target.value }))}>
              {HOURS.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
            </select>
          </div>
          <div className="modal-section">
            <label className="modal-label">Duration</label>
            <select className="modal-input" style={{ cursor: 'pointer' }}
              value={draft.duration} onChange={e => setDraft(d => ({ ...d, duration: +e.target.value }))}>
              {[30, 45, 60, 90, 120, 150, 180].map(v => (
                <option key={v} value={v}>{v < 60 ? `${v} min` : `${v / 60}h${v % 60 ? ` ${v % 60}m` : ''}`}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category */}
        <div className="modal-section">
          <label className="modal-label">Category</label>
          <div className="segmented">
            {catOptions.map(c => (
              <button key={c} className={`seg-btn${draft.category === c ? ' active' : ''}`}
                onClick={() => setDraft(d => ({ ...d, category: c }))}
                style={{ textTransform: 'capitalize', fontSize: '11px' }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Alarm toggle */}
        <div className="toggle-row">
          <span className="toggle-label">Enable Alarm Notification</span>
          <div className={`toggle${draft.alarmEnabled ? ' on' : ''}`}
            onClick={() => setDraft(d => ({ ...d, alarmEnabled: !d.alarmEnabled }))}>
            <div className="toggle-thumb" />
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          {isEdit && onDelete && event.id && (
            <button className="btn-outline" style={{ marginRight: 'auto', color: '#e05252', borderColor: 'rgba(224,82,82,0.25)' }}
              onClick={() => { onDelete(event.id!); onClose(); }}>
              <IconTrash size={13} /> Delete
            </button>
          )}
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-gold" disabled={!valid} style={{ opacity: valid ? 1 : 0.45 }}
            onClick={() => valid && onSave({ ...draft, id: event.id ?? newId() })}>
            <IconCheck size={13} /> {isEdit ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarView({ events, setEvents, onOpenAlarmWithEvent: _onOpenAlarmWithEvent, toast }: {
  events: ScheduleEvent[];
  setEvents: React.Dispatch<React.SetStateAction<ScheduleEvent[]>>;
  onOpenAlarmWithEvent?: (ev: ScheduleEvent) => void;
  toast: (msg: string, type?: ToastMsg['type']) => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [calView, setCalView]       = useState<'week' | 'month'>('week');
  const [editing, setEditing]       = useState<ScheduleEvent | null>(null);
  const [creating, setCreating]     = useState<Partial<ScheduleEvent> | null>(null);

  const today    = new Date();
  const dow      = today.getDay(); // 0=Sun
  const monDelta = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + monDelta + weekOffset * 7);

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const isToday = (d: Date) => d.toDateString() === today.toDateString();
  const monthLabel = weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleSave = (ev: ScheduleEvent) => {
    setEvents(p => p.some(e => e.id === ev.id) ? p.map(e => e.id === ev.id ? ev : e) : [...p, ev]);
    toast(editing ? 'Event updated' : 'Event added');
    setEditing(null);
    setCreating(null);
  };

  const handleDelete = (id: string) => {
    setEvents(p => p.filter(e => e.id !== id));
    toast('Event deleted', 'info');
  };

  return (
    <div className="calendar-view">
      {/* Header */}
      <div className="cal-header">
        <div className="cal-title">{monthLabel}</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-gold" style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setCreating({ day: (today.getDay() + 6) % 7, hour: 9 })}>
            <IconPlus size={12} /> Add Event
          </button>
          <div className="segmented" style={{ width: 'auto' }}>
            <button className={`seg-btn${calView === 'week' ? ' active' : ''}`}
              onClick={() => setCalView('week')} style={{ padding: '4px 12px' }}>Week</button>
            <button className={`seg-btn${calView === 'month' ? ' active' : ''}`}
              onClick={() => setCalView('month')} style={{ padding: '4px 12px' }}>Month</button>
          </div>
          <div className="cal-nav-btn" onClick={() => setWeekOffset(w => w - 1)}><IconChevronLeft /></div>
          <div className="cal-nav-btn"
            onClick={() => setWeekOffset(0)}
            style={{ fontSize: '11px', width: 'auto', padding: '0 8px', fontWeight: 600, color: 'var(--text-muted)' }}>
            Today
          </div>
          <div className="cal-nav-btn" onClick={() => setWeekOffset(w => w + 1)}><IconChevronRight /></div>
        </div>
      </div>

      {events.length === 0 && (
        <div style={{ padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--text-muted)' }}>
          Your calendar is currently empty. Upload your schedule document on the Dashboard or click "+ Add Event" above to add items.
        </div>
      )}

      {/* Week grid */}
      {calView === 'week' && (
        <div className="cal-grid-wrap">
          <div className="cal-grid">
            <div className="cal-time-gutter-header" />
            {weekDates.map((d, i) => (
              <div key={i} className="cal-day-header">
                <div className="cal-day-name">{DAYS[i]}</div>
                <div className={`cal-day-num${isToday(d) ? ' today today-circle' : ''}`}>{d.getDate()}</div>
              </div>
            ))}

            {HOURS.map(hour => (
              <React.Fragment key={hour}>
                <div className="cal-time-cell">{formatHour(hour)}</div>
                {DAYS.map((_, dayIdx) => {
                  const cellEvents = events.filter(e => e.day === dayIdx && e.hour === hour);
                  return (
                    <div key={dayIdx} className="cal-day-col"
                      onDoubleClick={() => setCreating({ day: dayIdx, hour })}>
                      {cellEvents.map(ev => (
                        <div key={ev.id} className={`sched-card ${ev.category}`} onClick={() => setEditing(ev)}>
                          <div className="sched-card-time">{fmt12(ev.hour, ev.minute)}</div>
                          <div className="sched-card-title">
                            {ev.title}
                            {ev.alarmEnabled && (
                              <span className="sched-alarm-icon">
                                <IconBell size={9} style={{ color: 'var(--gold)', opacity: 0.8 }} />
                              </span>
                            )}
                          </div>
                          {ev.subtitle && <div className="sched-card-sub">{ev.subtitle}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Month view */}
      {calView === 'month' && (
        <MonthView events={events} weekOffset={weekOffset} onEditEvent={setEditing} />
      )}

      {/* Modals */}
      {editing && (
        <EventModal event={editing} onSave={handleSave} onClose={() => setEditing(null)} onDelete={handleDelete} />
      )}
      {creating && (
        <EventModal event={creating} onSave={handleSave} onClose={() => setCreating(null)} />
      )}
    </div>
  );
}

// ─── Month view ───────────────────────────────────────────────────────────────
function MonthView({ events, weekOffset, onEditEvent }: {
  events: ScheduleEvent[];
  weekOffset: number;
  onEditEvent: (e: ScheduleEvent) => void;
}) {
  const today = new Date();
  const dow = today.getDay();
  const monDelta = dow === 0 ? -6 : 1 - dow;

  const gridStart = new Date(today);
  gridStart.setDate(today.getDate() + monDelta + weekOffset * 7 - 14);

  const weeks = Array.from({ length: 5 }, (_, w) =>
    Array.from({ length: 7 }, (__, d) => {
      const dt = new Date(gridStart);
      dt.setDate(gridStart.getDate() + w * 7 + d);
      return dt;
    })
  );

  return (
    <div className="cal-grid-wrap">
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        minWidth: '560px',
      }}>
        {DAYS.map(d => (
          <div key={d} style={{
            background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)',
            borderRight: '1px solid var(--border)', padding: '8px',
            fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.5px', color: 'var(--text-muted)', textAlign: 'center',
          }}>{d}</div>
        ))}
        {weeks.flat().map((dt, i) => {
          const dayIdx = i % 7;
          const dayEvents = events.filter(e => e.day === dayIdx);
          const isCurrentToday = dt.toDateString() === new Date().toDateString();
          return (
            <div key={i} style={{
              background: 'var(--bg-base)', borderRight: i % 7 === 6 ? 'none' : '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              padding: '6px', minHeight: '80px', verticalAlign: 'top',
              borderColor: isCurrentToday ? 'rgba(212,175,55,0.2)' : undefined,
            }}>
              <div style={{
                fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                marginBottom: '4px', textAlign: 'right',
                color: isCurrentToday ? 'var(--gold)' : 'var(--text-muted)',
              }}>{dt.getDate()}</div>
              {dayEvents.slice(0, 3).map(ev => (
                <div key={ev.id}
                  onClick={() => onEditEvent(ev)}
                  className={`sched-card ${ev.category}`}
                  style={{ marginBottom: '2px', padding: '2px 5px', cursor: 'pointer' }}>
                  <div className="sched-card-title" style={{ fontSize: '10px' }}>{ev.title}</div>
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Alarms Management View ───────────────────────────────────────────────────
function AlarmsView({ events, setEvents, onOpenAlarmWithEvent, toast }: {
  events: ScheduleEvent[];
  setEvents: React.Dispatch<React.SetStateAction<ScheduleEvent[]>>;
  onOpenAlarmWithEvent: (ev: ScheduleEvent) => void;
  toast: (msg: string, type?: ToastMsg['type']) => void;
}) {
  const alarmed = events.filter(e => e.alarmEnabled);
  const muted   = events.filter(e => !e.alarmEnabled);

  const toggle = (id: string) => {
    setEvents(p => p.map(e => e.id === id ? { ...e, alarmEnabled: !e.alarmEnabled } : e));
    toast('Alarm updated', 'info');
  };

  const nextAlarm = useMemo(() => computeUpcomingAlarms(events)[0], [events]);

  const AlarmRow = ({ ev }: { ev: ScheduleEvent }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '11px 14px', background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      marginBottom: '6px',
    }}>
      <div className="parsed-item-dot" style={{ width: 9, height: 9, borderRadius: '50%', background: CATEGORY_DOT_COLORS[ev.category], flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{DAYS[ev.day]} · {fmt12(ev.hour, ev.minute)} {ev.subtitle ? `· ${ev.subtitle}` : ''}</div>
      </div>
      <CatTag category={ev.category} />
      <button
        onClick={() => onOpenAlarmWithEvent(ev)}
        className="btn-outline"
        style={{ padding: '3px 8px', fontSize: '11px' }}
      >
        Trigger
      </button>
      <div className={`toggle${ev.alarmEnabled ? ' on' : ''}`} onClick={() => toggle(ev.id)} style={{ flexShrink: 0 }}>
        <div className="toggle-thumb" />
      </div>
    </div>
  );

  return (
    <div className="col-main" style={{ paddingTop: 22 }}>
      {nextAlarm && (
        <div className="card" style={{ borderColor: 'rgba(212,175,55,0.25)', background: 'rgba(212,175,55,0.05)', cursor: 'pointer' }}
          onClick={() => onOpenAlarmWithEvent(nextAlarm.event)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="alarm-pulse-ring" style={{ width: 44, height: 44, flexShrink: 0 }}>
              <IconBell size={18} style={{ color: 'var(--gold)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                Next Active Alarm: {nextAlarm.event.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {nextAlarm.dayLabel} at {nextAlarm.formattedTime} · In {formatCountdown(nextAlarm.secondsRemaining)}
              </div>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', background: 'rgba(212,175,55,0.12)', borderRadius: 'var(--radius-sm)', padding: '4px 10px' }}>
              Test / Ring Now →
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Active Scheduled Alarms</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'Manrope, sans-serif', fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}>{alarmed.length}</span>
        </div>
        {alarmed.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
            No alarms armed. Upload your schedule document on Dashboard to set up alarms.
          </div>
        ) : alarmed.map(ev => <AlarmRow key={ev.id} ev={ev} />)}
      </div>

      {muted.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Muted Events (Alarms Off)</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'Manrope, sans-serif', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>{muted.length}</span>
          </div>
          {muted.map(ev => <AlarmRow key={ev.id} ev={ev} />)}
        </div>
      )}
    </div>
  );
}

// ─── Settings view ────────────────────────────────────────────────────────────
function SettingsView({
  alarmMode,
  setAlarmMode,
  userProfile,
  onUpdateProfile,
  onSignOut,
  onInstallApp,
  isInstalled,
  toast,
}: {
  alarmMode: AlarmMode;
  setAlarmMode: (m: AlarmMode) => void;
  userProfile: UserProfile;
  onUpdateProfile: (p: UserProfile) => void;
  onSignOut: () => void;
  onInstallApp: () => void;
  isInstalled: boolean;
  toast: (msg: string) => void;
}) {
  const [snoozeDur, setSnoozeDur] = useState(5);
  const [username, setUsername] = useState(userProfile.name);
  const [department, setDepartment] = useState(userProfile.department);
  const [year, setYear] = useState(userProfile.year);
  const [phoneWebhook, setPhoneWebhook] = useState(userProfile.phoneWebhook || '');

  // AI LLM Extractor Settings
  const [aiSettings, setAiSettings] = useState<AISettings>(loadAISettings);

  const userTimezone = getLocalTimeZone();

  const SettingsSection = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--gold)' }}>{icon}</span>
        <div className="card-title" style={{ marginBottom: 0 }}>{title}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>{children}</div>
    </div>
  );

  const Row = ({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {sub && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>}
      </div>
      {right}
    </div>
  );

  const handleSaveProfile = () => {
    if (!username.trim()) return;
    const updated: UserProfile = {
      ...userProfile,
      name: username.trim(),
      department: department.trim(),
      year,
      role: department.trim() ? `${department.trim()} · ${year}` : year,
      phoneWebhook: phoneWebhook.trim(),
    };
    onUpdateProfile(updated);
    toast('Profile updated successfully');
  };

  const handleSaveAI = () => {
    saveAISettings(aiSettings);
    toast('AI LLM extractor settings saved');
  };

  const handleTestChime = () => {
    playAlarmChime();
    triggerMobileVibration();
    toast('Playing golden chime & mobile vibration');
  };

  return (
    <div className="col-main" style={{ paddingTop: 22, maxWidth: '640px' }}>
      {/* User Profile */}
      <SettingsSection title="User Profile" icon={<IconUser size={15} />}>
        <Row label="Full Name" sub="Displayed across greetings & badges"
          right={
            <input className="modal-input" style={{ maxWidth: '220px' }} value={username}
              onChange={e => setUsername(e.target.value)}
              onBlur={handleSaveProfile} />
          } />
        <Row label="Major / Field" sub="Your focus area or program"
          right={
            <input className="modal-input" style={{ maxWidth: '220px' }} value={department}
              onChange={e => setDepartment(e.target.value)}
              onBlur={handleSaveProfile} />
          } />
        <Row label="Level / Title" sub="Progression level"
          right={
            <select
              className="modal-input"
              style={{ width: '130px', cursor: 'pointer' }}
              value={year}
              onChange={e => {
                setYear(e.target.value);
                const updated: UserProfile = {
                  ...userProfile,
                  year: e.target.value,
                  role: department.trim() ? `${department} · ${e.target.value}` : e.target.value,
                };
                onUpdateProfile(updated);
                toast('Level updated');
              }}
            >
              <option value="Year 1">Year 1</option>
              <option value="Year 2">Year 2</option>
              <option value="Year 3">Year 3</option>
              <option value="Year 4">Year 4</option>
              <option value="Final Year">Final Year</option>
              <option value="Postgraduate">Postgraduate</option>
              <option value="Professional">Professional</option>
            </select>
          } />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <button className="btn-outline" onClick={onSignOut} style={{ color: '#e05252', borderColor: 'rgba(224,82,82,0.25)' }}>
            <IconLogOut size={13} />
            <span>Switch Profile / Sign Out</span>
          </button>
        </div>
      </SettingsSection>

      {/* AI LLM Schedule Extractor Engine */}
      <SettingsSection title="AI LLM Schedule Extraction Engine" icon={<IconCpu size={15} />}>
        <Row
          label="AI Model Engine"
          sub="Select the LLM that parses your timetable files"
          right={
            <select
              className="modal-input"
              style={{ width: '170px', cursor: 'pointer' }}
              value={aiSettings.provider}
              onChange={e => setAiSettings(s => ({ ...s, provider: e.target.value as any }))}
            >
              <option value="auto">Auto / Local AI</option>
              <option value="gemini">Google Gemini API</option>
              <option value="openai">OpenAI / OpenRouter</option>
            </select>
          }
        />

        {aiSettings.provider === 'gemini' && (
          <div>
            <label className="modal-label">Google Gemini API Key</label>
            <input
              type="password"
              className="modal-input"
              placeholder="AIzaSy..."
              value={aiSettings.apiKey || ''}
              onChange={e => setAiSettings(s => ({ ...s, apiKey: e.target.value }))}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Used to send your raw timetable document to Gemini 1.5 Flash for high-accuracy parsing into calendar slots.
            </div>
          </div>
        )}

        {aiSettings.provider === 'openai' && (
          <div>
            <label className="modal-label">OpenAI / OpenRouter API Key</label>
            <input
              type="password"
              className="modal-input"
              placeholder="sk-..."
              value={aiSettings.apiKey || ''}
              onChange={e => setAiSettings(s => ({ ...s, apiKey: e.target.value }))}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            Timezone: <strong style={{ color: 'var(--gold)' }}>{userTimezone}</strong>
          </span>
          <button className="btn-gold" onClick={handleSaveAI} style={{ padding: '6px 14px' }}>
            <IconCheck size={13} /> Save AI Settings
          </button>
        </div>
      </SettingsSection>

      {/* Alarms, Phone Vibrations & Notifications */}
      <SettingsSection title="Phone Alarms & Notifications" icon={<IconBell size={15} />}>
        <Row label="Alarm Mode" sub="How alarms are delivered"
          right={
            <div className="segmented" style={{ width: 'auto' }}>
              <button className={`seg-btn${alarmMode === 'sound' ? ' active' : ''}`}
                onClick={() => { setAlarmMode('sound'); toast('Alarm mode: Sound + Popup'); }} style={{ padding: '4px 10px' }}>
                Sound + Popup
              </button>
              <button className={`seg-btn${alarmMode === 'popup' ? ' active' : ''}`}
                onClick={() => { setAlarmMode('popup'); toast('Alarm mode: Popup Only'); }} style={{ padding: '4px 10px' }}>
                Popup Only
              </button>
            </div>
          } />

        <Row label="Test Chime & Vibration" sub="Verify Web Audio API chime and phone vibration"
          right={
            <button className="btn-outline" onClick={handleTestChime} style={{ padding: '4px 10px' }}>
              <IconVolume size={13} /> Test Sound
            </button>
          } />

        <Row label="Desktop / Mobile OS Alerts" sub="Native alerts when phone/laptop tab is in background"
          right={
            <button className="btn-outline" onClick={() => { requestNotificationPermission(); toast('Notification permission requested'); }} style={{ padding: '4px 10px' }}>
              Enable Alerts
            </button>
          } />

        <div>
          <label className="modal-label">Mobile Webhook Alert URL (Optional)</label>
          <input
            className="modal-input"
            placeholder="https://api.pushover.net/... or webhook URL"
            value={phoneWebhook}
            onChange={e => setPhoneWebhook(e.target.value)}
            onBlur={handleSaveProfile}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Trigger real-time push alerts to your phone via Pushover, Telegram, or custom webhook when alarms ring.
          </div>
        </div>

        <Row label="Snooze Duration" sub="Minutes to delay when snoozed"
          right={
            <select className="modal-input" style={{ width: '100px', cursor: 'pointer' }}
              value={snoozeDur} onChange={e => { setSnoozeDur(+e.target.value); toast('Preference saved'); }}>
              {[5, 10, 15, 20, 30].map(v => <option key={v} value={v}>{v} minutes</option>)}
            </select>
          } />
      </SettingsSection>

      {/* Native App & Cloud Deployment */}
      <SettingsSection title="Native App & Cloud Deployment" icon={<IconDownload size={15} />}>
        <Row
          label="Standalone Desktop & Mobile App"
          sub={isInstalled ? "Chronos is currently running as an installed standalone app." : "Install Chronos to your PC desktop or phone home screen for offline access & native alerts."}
          right={
            <button
              className="btn-gold"
              onClick={onInstallApp}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <IconDownload size={13} />
              <span>{isInstalled ? 'App Installed' : 'Install App'}</span>
            </button>
          }
        />

        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Deploy via Render (Free Static Site)</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--gold)', background: 'rgba(212,175,55,0.12)', padding: '2px 8px', borderRadius: '4px' }}>render.yaml Ready</span>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '10px' }}>
            Deploy Chronos live on Render with automatic HTTPS and global CDN. Push this repository to GitHub, then create a new <strong>Static Site</strong> on Render.
          </p>
          <div style={{ background: '#0d0d0f', padding: '10px 12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', color: '#c5c2be', border: '1px solid var(--border-strong)', lineHeight: '1.6', userSelect: 'all' }}>
            <span style={{ color: 'var(--gold)' }}># 1. Add your GitHub remote</span><br/>
            git remote add origin https://github.com/&lt;your-username&gt;/chronos.git<br/>
            <span style={{ color: 'var(--gold)' }}># 2. Push to GitHub</span><br/>
            git push -u origin main
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

// ─── Active Alarm Overlay ─────────────────────────────────────────────────────
function AlarmOverlay({
  event,
  onClose,
  onSnooze,
}: {
  event: ScheduleEvent | null;
  onClose: () => void;
  onSnooze: (minutes: number) => void;
}) {
  const [snoozed, setSnoozed] = useState(false);
  const [snoozeCount, setSnoozeCount] = useState(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSnooze = () => {
    setSnoozed(true);
    setSnoozeCount(c => c + 1);
    onSnooze(5);
  };

  const title = event?.title || 'Scheduled Event';
  const subtitle = event?.subtitle || 'Active Alarm Reminder';
  const category = event?.category || 'academic';
  const timeStr = event ? fmt12(event.hour, event.minute) : 'Alarm Due';
  const durationStr = event ? `${event.duration} min scheduled block` : 'Notification';
  const nextRingTime = new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="alarm-overlay fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="alarm-card">
        <div className="alarm-pulse-ring">
          <IconBell size={30} style={{ color: 'var(--gold)' }} />
        </div>

        <div className="alarm-status-row">
          <div className="alarm-status-dot" />
          <div className="alarm-status-text">Alarm Active</div>
        </div>

        <div className="alarm-time">{timeStr}</div>

        <div className="alarm-category">
          <CatTag category={category} />
        </div>

        <div className="alarm-task">{title}</div>
        <div className="alarm-duration">{subtitle} · {durationStr}</div>

        {snoozed && (
          <div className="alarm-snooze-msg fade-in">
            Snoozed for 5 minutes · Rings at {nextRingTime}
          </div>
        )}

        <div className="alarm-actions">
          <button className="alarm-btn-primary alarm-btn-snooze" onClick={handleSnooze}>
            <IconBell size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            {snoozed ? `Snooze Again (+5m #${snoozeCount})` : 'Snooze 5 mins'}
          </button>
          <button className="alarm-btn-primary alarm-btn-complete" onClick={onClose}>
            <IconCheck size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Mark Complete
          </button>
          <button className="alarm-btn-primary alarm-btn-dismiss" onClick={onClose}>
            Dismiss Notification
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]             = useState<NavView>('dashboard');
  const [alarmOpen, setAlarmOpen]   = useState(false);
  const [activeAlarmEvent, setActiveAlarmEvent] = useState<ScheduleEvent | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Focus streak tracking
  const [focusStreak] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('chronos_focus_streak');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 1;
  });

  // PWA App Installation hook
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches ||
             (window.navigator as any).standalone === true;
    }
    return false;
  });

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
    };
  }, []);

  // User Profile state (loaded from localStorage or null to trigger Sign Up)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('chronos_user_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse user profile', e);
    }
    return null;
  });

  // Schedule Events state (Clean, no placeholders!)
  const [events, setEvents] = useState<ScheduleEvent[]>(() => {
    try {
      const saved = localStorage.getItem('chronos_events');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved events:', e);
    }
    return INITIAL_EVENTS;
  });

  const [alarmMode, setAlarmMode] = useState<AlarmMode>(() => {
    return (localStorage.getItem('chronos_alarm_mode') as AlarmMode) || 'sound';
  });

  const { toasts, push: toast, dismiss } = useToast();

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('chronos_user_profile', JSON.stringify(userProfile));
    } else {
      localStorage.removeItem('chronos_user_profile');
    }
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('chronos_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('chronos_alarm_mode', alarmMode);
  }, [alarmMode]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const triggerAlarm = useCallback((ev: ScheduleEvent) => {
    setActiveAlarmEvent(ev);
    setAlarmOpen(true);

    if (alarmMode === 'sound') {
      playAlarmChime();
      speakAlarmAnnouncement(ev.title, fmt12(ev.hour, ev.minute));
    }
    triggerMobileVibration();

    sendDesktopNotification(
      `Chronos Alarm: ${ev.title}`,
      `${fmt12(ev.hour, ev.minute)} · ${ev.subtitle || 'Scheduled Event'}`,
      userProfile?.phoneWebhook
    );
  }, [alarmMode, userProfile]);

  const lastFiredMinute = useRef<string>('');
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentDay = (now.getDay() + 6) % 7; // 0=Mon
      const h = now.getHours();
      const m = now.getMinutes();
      const currentMinuteKey = `${currentDay}-${h}:${m}`;

      if (lastFiredMinute.current !== currentMinuteKey) {
        const dueEvent = events.find(e => e.alarmEnabled && e.day === currentDay && e.hour === h && e.minute === m);
        if (dueEvent) {
          lastFiredMinute.current = currentMinuteKey;
          triggerAlarm(dueEvent);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [events, triggerAlarm]);

  const alarmCount = events.filter(e => e.alarmEnabled).length;

  const titles: Record<NavView, string> = {
    dashboard: 'Dashboard',
    calendar:  'Master Schedule',
    alarms:    'Alarms',
    settings:  'Settings',
  };

  const handleTestAlarm = () => {
    const sampleEvent = events.find(e => e.alarmEnabled) || events[0] || {
      id: 'test', day: (new Date().getDay() + 6) % 7, hour: new Date().getHours(), minute: new Date().getMinutes(), duration: 60,
      title: 'Active Schedule Reminder', subtitle: 'Chronos Precision Alarm',
      category: 'academic', alarmEnabled: true,
    };
    triggerAlarm(sampleEvent);
    toast('Test alarm triggered! Chime ringing, vibration active & overlay displayed.');
  };

  const handleSignUpComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    setIsEditingProfile(false);
    toast(`Welcome to Chronos, ${getFirstName(profile.name)}! Please upload your schedule document.`);
  };

  const handleSignOut = () => {
    setUserProfile(null);
    toast('Signed out. Please create or select a profile.', 'info');
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          toast('Installing Chronos as desktop application...', 'success');
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    } else {
      toast('Click the (⊕ Install) button in your browser address bar to install as PC App!', 'info');
    }
  };

  // If user has not signed up yet, show the Sign Up view!
  if (!userProfile || isEditingProfile) {
    return (
      <>
        <SignUpView onSignUp={handleSignUpComplete} initialData={userProfile} />
        <ToastContainer toasts={toasts} dismiss={dismiss} />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={setView}
        userProfile={userProfile}
        alarmCount={alarmCount}
        onOpenProfile={() => setIsEditingProfile(true)}
        onInstallApp={handleInstallApp}
        isInstalled={isInstalled}
        focusStreak={focusStreak}
      />

      <div className="main-area">
        <Topbar
          title={titles[view]}
          onOpenAlarm={() => {
            const first = events.find(e => e.alarmEnabled) || events[0];
            setActiveAlarmEvent(first || null);
            setAlarmOpen(true);
          }}
          alarmCount={alarmCount}
          onTestAlarm={handleTestAlarm}
          userProfile={userProfile}
          onOpenProfile={() => setIsEditingProfile(true)}
        />

        {view === 'dashboard' && (
          <Dashboard
            onViewCalendar={() => setView('calendar')}
            events={events}
            setEvents={setEvents}
            alarmMode={alarmMode}
            setAlarmMode={setAlarmMode}
            onOpenAlarmWithEvent={ev => {
              setActiveAlarmEvent(ev);
              setAlarmOpen(true);
            }}
            userProfile={userProfile}
            focusStreak={focusStreak}
            completedIds={completedIds}
            toast={toast}
          />
        )}

        {view === 'calendar' && (
          <CalendarView
            events={events}
            setEvents={setEvents}
            onOpenAlarmWithEvent={ev => {
              setActiveAlarmEvent(ev);
              setAlarmOpen(true);
            }}
            toast={toast}
          />
        )}

        {view === 'alarms' && (
          <AlarmsView
            events={events}
            setEvents={setEvents}
            onOpenAlarmWithEvent={ev => {
              setActiveAlarmEvent(ev);
              setAlarmOpen(true);
            }}
            toast={toast}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            alarmMode={alarmMode}
            setAlarmMode={setAlarmMode}
            userProfile={userProfile}
            onUpdateProfile={setUserProfile}
            onSignOut={handleSignOut}
            onInstallApp={handleInstallApp}
            isInstalled={isInstalled}
            toast={toast}
          />
        )}
      </div>

      {alarmOpen && (
        <AlarmOverlay
          event={activeAlarmEvent}
          onClose={() => {
            if (activeAlarmEvent) {
              setCompletedIds(prev => new Set([...prev, activeAlarmEvent.id]));
            }
            setAlarmOpen(false);
          }}
          onSnooze={mins => {
            toast(`Snoozed "${activeAlarmEvent?.title || 'Alarm'}" for ${mins} minutes`);
          }}
        />
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

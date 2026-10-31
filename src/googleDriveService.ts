/**
 * googleDriveService.ts
 * Integrates Google Drive & Google Docs creation with Chronos.
 * Supports Google Identity Services (GIS) OAuth token flow,
 * creating Google Docs with schedule tables, and offline fallback exports.
 */

import type { ScheduleEvent } from './App';
import { DAY_NAMES } from './scheduleParser';

export interface GoogleDriveConfig {
  clientId: string;
  accessToken?: string;
  userEmail?: string;
  userName?: string;
  expiresAt?: number;
}

const STORAGE_KEY = 'chronos_google_drive_config';

/**
 * Load Google Drive configuration from localStorage
 */
export function loadGoogleDriveConfig(): GoogleDriveConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load Google Drive config:', e);
  }
  return {
    clientId: (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '',
  };
}

/**
 * Save Google Drive configuration to localStorage
 */
export function saveGoogleDriveConfig(config: GoogleDriveConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Check if the user currently has an active, non-expired Google access token
 */
export function isGoogleDriveConnected(): boolean {
  const config = loadGoogleDriveConfig();
  if (!config.accessToken) return false;
  if (config.expiresAt && Date.now() > config.expiresAt) return false;
  return true;
}

/**
 * Disconnect Google Drive
 */
export function disconnectGoogleDrive(): void {
  const config = loadGoogleDriveConfig();
  config.accessToken = undefined;
  config.userEmail = undefined;
  config.userName = undefined;
  config.expiresAt = undefined;
  saveGoogleDriveConfig(config);
}

/**
 * Request Google Drive OAuth Token via Google Identity Services
 */
export function requestGoogleDriveAccess(
  clientId: string,
  onSuccess: (token: string, email?: string) => void,
  onError: (error: string) => void
): void {
  if (typeof window === 'undefined') return;

  // Check if GIS script is loaded
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    // Dynamically inject Google Identity Services script if not present
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initTokenClient(clientId, onSuccess, onError);
    };
    script.onerror = () => {
      onError('Failed to load Google Identity Services library');
    };
    document.head.appendChild(script);
  } else {
    initTokenClient(clientId, onSuccess, onError);
  }
}

function initTokenClient(
  clientId: string,
  onSuccess: (token: string, email?: string) => void,
  onError: (error: string) => void
) {
  try {
    const google = (window as any).google;
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      callback: async (resp: any) => {
        if (resp.error) {
          onError(resp.error_description || resp.error);
          return;
        }
        if (resp.access_token) {
          let email = '';
          try {
            // Fetch basic profile email
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${resp.access_token}` },
            });
            if (res.ok) {
              const data = await res.json();
              email = data.email || '';
            }
          } catch {}

          const expiresAt = Date.now() + (parseInt(resp.expires_in, 10) || 3600) * 1000;
          saveGoogleDriveConfig({
            clientId,
            accessToken: resp.access_token,
            userEmail: email,
            expiresAt,
          });

          onSuccess(resp.access_token, email);
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (err: any) {
    onError(err.message || 'Google Auth Initialization Error');
  }
}

/**
 * Format schedule events into formatted HTML for Google Docs
 */
export function formatScheduleAsHtml(
  title: string,
  events: ScheduleEvent[],
  notes?: string
): string {
  const sortedEvents = [...events].sort((a, b) => a.day - b.day || a.hour - b.hour || a.minute - b.minute);

  const daysGrouped: Record<number, ScheduleEvent[]> = {};
  for (let d = 0; d < 7; d++) daysGrouped[d] = [];
  sortedEvents.forEach(ev => {
    if (daysGrouped[ev.day]) daysGrouped[ev.day].push(ev);
  });

  let html = `
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Arial', sans-serif; color: #1f2937; line-height: 1.6; padding: 24px; }
          h1 { color: #111827; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; }
          .meta { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
          .day-title { font-size: 18px; color: #92400e; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f9fafb; text-align: left; padding: 10px; border: 1px solid #e5e7eb; font-size: 13px; font-weight: 600; color: #374151; }
          td { padding: 9px 10px; border: 1px solid #e5e7eb; font-size: 13px; }
          .cat-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
          .cat-academic { background: #dbeafe; color: #1e40af; }
          .cat-engineering { background: #f3e8ff; color: #6b21a8; }
          .cat-spiritual { background: #fef3c7; color: #92400e; }
          .cat-meeting { background: #dcfce7; color: #166534; }
          .notes { background: #f8fafc; border-left: 4px solid #D4AF37; padding: 12px 16px; margin-top: 20px; font-style: italic; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">
          Generated automatically by Chronos AI Schedule & Alarms · ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
  `;

  if (notes) {
    html += `<div class="notes"><strong>AI Assistant Notes:</strong> ${notes}</div>`;
  }

  for (let d = 0; d < 7; d++) {
    const dayEvents = daysGrouped[d];
    if (dayEvents.length === 0) continue;

    html += `<div class="day-title">${DAY_NAMES[d]} (${dayEvents.length} scheduled blocks)</div>`;
    html += `
      <table>
        <thead>
          <tr>
            <th style="width: 130px;">Time Slot</th>
            <th>Course / Task</th>
            <th>Details & Room</th>
            <th style="width: 100px;">Category</th>
            <th style="width: 90px;">Alarm</th>
          </tr>
        </thead>
        <tbody>
    `;

    dayEvents.forEach(e => {
      const startH = e.hour === 0 ? 12 : e.hour > 12 ? e.hour - 12 : e.hour;
      const startAmPm = e.hour >= 12 ? 'PM' : 'AM';
      const timeStr = `${startH}:${String(e.minute).padStart(2, '0')} ${startAmPm}`;

      html += `
        <tr>
          <td><strong>${timeStr}</strong> (${e.duration}m)</td>
          <td><strong>${e.title}</strong></td>
          <td>${e.subtitle || '—'}</td>
          <td><span class="cat-badge cat-${e.category}">${e.category.toUpperCase()}</span></td>
          <td>${e.alarmEnabled ? '🔔 Armed' : 'Disabled'}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
  }

  html += `
      <div style="margin-top: 30px; font-size: 11px; color: #9ca3af; text-align: center;">
        Created with Chronos AI Timetable & Alarms Engine
      </div>
    </body>
    </html>
  `;

  return html;
}

/**
 * Create a new Google Document in the user's Google Drive containing their schedule
 */
export async function createGoogleDocWithSchedule(
  docTitle: string,
  events: ScheduleEvent[],
  notes?: string,
  accessTokenOverride?: string
): Promise<{ docId: string; docUrl: string }> {
  const config = loadGoogleDriveConfig();
  const token = accessTokenOverride || config.accessToken;

  if (!token) {
    throw new Error('Google Drive is not connected. Please connect your Google account in Settings.');
  }

  const htmlContent = formatScheduleAsHtml(docTitle, events, notes);

  // Use Google Drive Multipart Upload to create a Google Docs native document
  const metadata = {
    name: docTitle,
    mimeType: 'application/vnd.google-apps.document',
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/html\r\n\r\n' +
    htmlContent +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const docId = data.id;
  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

  return { docId, docUrl };
}

/**
 * Offline fallback: Download schedule document directly as Markdown or HTML
 */
export function downloadScheduleDocument(
  title: string,
  events: ScheduleEvent[],
  notes?: string
): void {
  const html = formatScheduleAsHtml(title, events, notes);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9_-]/gi, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

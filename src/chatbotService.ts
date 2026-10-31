/**
 * chatbotService.ts
 * Conversational AI Assistant engine for Chronos.
 * Supports chatting with Gemini 1.5 Flash or Local Intelligent Engine to:
 * - Answer questions about the user's schedule
 * - Brainstorm and build complete schedules from scratch
 * - Add, modify, or remove events via conversation
 * - Connect to Google Drive and generate documents
 */

import type { ScheduleEvent, UserProfile } from './App';
import { parseScheduleText, DAY_NAMES, guessCategory } from './scheduleParser';
import { loadAISettings, getLocalTimeZone } from './aiScheduleExtractor';
import { createGoogleDocWithSchedule, isGoogleDriveConnected } from './googleDriveService';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  draftEvents?: ScheduleEvent[];
  googleDocUrl?: string;
  actionType?: 'create_schedule' | 'add_events' | 'google_doc' | 'info';
  statusNote?: string;
}

const CHAT_SYSTEM_PROMPT = `You are Chronos AI, an elite academic and engineering schedule assistant built into the Chronos dark-mode productivity platform.
You help students and professionals manage their weekly timetable, design high-performance study schedules, answer questions about upcoming events, and create documents in Google Drive.

User Profile:
- Name: {{USER_NAME}}
- Department/Field: {{USER_DEPT}}
- Level: {{USER_LEVEL}}
- Detected Timezone: {{TIMEZONE}}

Current Master Schedule:
{{CURRENT_SCHEDULE}}

Capabilities:
1. Schedule Creation: If the user describes tasks or asks you to create a schedule (e.g. "Create a schedule for me with Monday 9am Math, Friday 5pm Review"), you MUST return a structured JSON block containing the events so they can be placed on the calendar and alarms armed.
2. Timetable Questions: You can answer any question about their schedule (e.g. "What do I have on Friday?", "When is my next class?").
3. Google Drive: If the user asks to create a document or export to Google Drive, confirm and include the Google Doc action.

JSON Output Protocol:
When you suggest, create, or modify schedule events, include a JSON block in this exact format at the very end of your response:
\`\`\`chronos_schedule
[
  {
    "title": "Machine Learning",
    "subtitle": "Lecture Hall 2",
    "day": 0,
    "hour": 10,
    "minute": 0,
    "duration": 120,
    "category": "academic"
  }
]
\`\`\`
Days are 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday.
Hours are in 24h format (e.g. 5:00 PM is hour 17).
Category must be one of: "academic", "engineering", "spiritual", "meeting".`;

let _chatMsgId = 100;
const newChatId = () => `msg_${_chatMsgId++}_${Date.now()}`;

/**
 * Send a message to Chronos AI Assistant
 */
export async function sendChatMessage(
  userText: string,
  history: ChatMessage[],
  currentEvents: ScheduleEvent[],
  userProfile: UserProfile
): Promise<ChatMessage> {
  const aiSettings = loadAISettings();
  const timeZone = getLocalTimeZone();

  // Check if user is asking to create a Google Doc directly
  const isGoogleDocRequest = /\b(?:google\s*doc|google\s*drive|export\s*to\s*drive|create\s*(?:a\s*)?doc)\b/i.test(userText);
  if (isGoogleDocRequest && currentEvents.length > 0) {
    if (isGoogleDriveConnected()) {
      try {
        const title = `${userProfile.name}'s Chronos Master Schedule - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
        const { docUrl } = await createGoogleDocWithSchedule(title, currentEvents, `Exported by Chronos AI on ${new Date().toLocaleString()}`);
        return {
          id: newChatId(),
          role: 'assistant',
          content: `I have created your Google Document in your Google Drive!\n\n**Document:** [${title}](${docUrl})\n\nIt contains your complete weekly breakdown, room locations, categories, and alarm settings.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          googleDocUrl: docUrl,
          actionType: 'google_doc',
          statusNote: 'Document created in Google Drive',
        };
      } catch (err: any) {
        return {
          id: newChatId(),
          role: 'assistant',
          content: `I attempted to create the Google Doc, but encountered an authorization error: ${err.message}. Please verify your Google Drive connection in Settings, or use the offline download button below.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          draftEvents: currentEvents,
          actionType: 'info',
        };
      }
    } else {
      return {
        id: newChatId(),
        role: 'assistant',
        content: `I can create a Google Doc for your schedule! To upload directly to your Google Drive, connect your Google account in **Settings** → **Google Drive Integration**.\n\nIn the meantime, you can preview or download your formatted document right now using the action card below:`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        draftEvents: currentEvents,
        actionType: 'google_doc',
        statusNote: 'Ready to export',
      };
    }
  }

  // 1. Try Gemini Cloud AI if API key is present
  if (aiSettings.apiKey && (aiSettings.provider === 'gemini' || aiSettings.provider === 'auto')) {
    try {
      const response = await callGeminiChat(userText, history, currentEvents, userProfile, aiSettings.apiKey, timeZone);
      return response;
    } catch (err) {
      console.warn('Gemini chat failed, using local assistant fallback:', err);
    }
  }

  // 2. Intelligent Local AI Engine fallback
  return generateLocalAssistantResponse(userText, currentEvents, userProfile);
}

/**
 * Call Gemini 1.5 Flash for conversational responses
 */
async function callGeminiChat(
  userText: string,
  history: ChatMessage[],
  currentEvents: ScheduleEvent[],
  userProfile: UserProfile,
  apiKey: string,
  timeZone: string
): Promise<ChatMessage> {
  const scheduleSummary = currentEvents.length === 0
    ? 'No events currently loaded.'
    : currentEvents.map(e => `- ${DAY_NAMES[e.day]} ${formatHour12(e.hour, e.minute)} (${e.duration}m): ${e.title} [${e.category}] ${e.subtitle}`).join('\n');

  const systemInstruction = CHAT_SYSTEM_PROMPT
    .replace('{{USER_NAME}}', userProfile.name)
    .replace('{{USER_DEPT}}', userProfile.department)
    .replace('{{USER_LEVEL}}', userProfile.year)
    .replace('{{TIMEZONE}}', timeZone)
    .replace('{{CURRENT_SCHEDULE}}', scheduleSummary);

  const contents: any[] = [];

  // Add conversation history
  const recentHistory = history.slice(-6);
  recentHistory.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  });

  // Add latest message
  contents.push({
    role: 'user',
    parts: [{ text: userText }],
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not process that request.';

  // Parse any ```chronos_schedule [ ... ] ``` blocks
  let displayContent = rawText;
  let draftEvents: ScheduleEvent[] | undefined;
  let actionType: ChatMessage['actionType'] = 'info';

  const scheduleBlockMatch = rawText.match(/```chronos_schedule\s*([\s\S]*?)\s*```/);
  if (scheduleBlockMatch) {
    try {
      const parsedItems = JSON.parse(scheduleBlockMatch[1]);
      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        draftEvents = parsedItems.map((item, idx) => ({
          id: `ai_chat_${Date.now()}_${idx}`,
          day: typeof item.day === 'number' ? Math.max(0, Math.min(6, item.day)) : 4,
          hour: typeof item.hour === 'number' ? Math.max(0, Math.min(23, item.hour)) : 17,
          minute: typeof item.minute === 'number' ? Math.max(0, Math.min(59, item.minute)) : 0,
          duration: typeof item.duration === 'number' ? item.duration : 60,
          title: String(item.title || 'Scheduled Event').trim(),
          subtitle: String(item.subtitle || 'Created by Chronos AI').trim(),
          category: ['academic', 'engineering', 'spiritual', 'meeting'].includes(item.category) ? item.category : guessCategory(item.title || ''),
          alarmEnabled: true,
        }));
        actionType = 'create_schedule';
      }
      displayContent = rawText.replace(/```chronos_schedule\s*[\s\S]*?\s*```/, '').trim();
    } catch (e) {
      console.warn('Failed to parse schedule block from Gemini:', e);
    }
  }

  return {
    id: newChatId(),
    role: 'assistant',
    content: displayContent,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    draftEvents,
    actionType,
    statusNote: draftEvents ? `${draftEvents.length} schedule blocks generated` : undefined,
  };
}

/**
 * Intelligent Local Assistant Engine
 * Synthesizes schedules, answers questions, and extracts events even without API keys.
 */
function generateLocalAssistantResponse(
  userText: string,
  currentEvents: ScheduleEvent[],
  userProfile: UserProfile
): ChatMessage {
  const lower = userText.toLowerCase();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Question: What is on Friday / today / specific day?
  const dayQueries = ['friday', 'monday', 'tuesday', 'wednesday', 'thursday', 'saturday', 'sunday', 'today', 'tomorrow'];
  const matchedDayWord = dayQueries.find(d => lower.includes(d));

  if (matchedDayWord && (lower.includes('what') || lower.includes('show') || lower.includes('schedule') || lower.includes('when') || lower.includes('have'))) {
    let targetDay = 4; // default Fri
    if (matchedDayWord === 'today') {
      targetDay = (new Date().getDay() + 6) % 7;
    } else if (matchedDayWord === 'tomorrow') {
      targetDay = (new Date().getDay() + 7) % 7;
    } else {
      const map: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
      targetDay = map[matchedDayWord] ?? 4;
    }

    const dayEvents = currentEvents.filter(e => e.day === targetDay).sort((a, b) => a.hour - b.hour);
    if (dayEvents.length === 0) {
      return {
        id: newChatId(),
        role: 'assistant',
        content: `You currently have **no events scheduled for ${DAY_NAMES[targetDay]}**.\n\nWould you like me to create a schedule for ${DAY_NAMES[targetDay]}? Just tell me what classes or tasks you'd like to plan!`,
        timestamp: timeStr,
        actionType: 'info',
      };
    }

    const list = dayEvents.map(e => `• **${formatHour12(e.hour, e.minute)}** — ${e.title} (${e.duration} min) · *${e.subtitle || e.category}* 🔔`).join('\n');
    return {
      id: newChatId(),
      role: 'assistant',
      content: `Here is your schedule for **${DAY_NAMES[targetDay]}** (${dayEvents.length} blocks):\n\n${list}\n\nAll alarms are armed and will trigger sound, voice reminders, and notifications on time.`,
      timestamp: timeStr,
      draftEvents: dayEvents,
      actionType: 'info',
    };
  }

  // 2. Schedule Creation / Addition: detect timetable entries in text
  const extracted = parseScheduleText(userText);
  if (extracted.length > 0) {
    const draftEvents: ScheduleEvent[] = extracted.map(e => ({
      id: `local_chat_${Date.now()}_${e.id}`,
      day: e.day,
      hour: e.hour,
      minute: e.minute,
      duration: e.duration,
      title: e.title,
      subtitle: e.subtitle || `${userProfile.department} · Scheduled Block`,
      category: e.category,
      alarmEnabled: true,
    }));

    const previewList = draftEvents.map(e => `• **${DAY_NAMES[e.day]} ${formatHour12(e.hour, e.minute)}**: ${e.title} (${e.duration}m)`).join('\n');

    return {
      id: newChatId(),
      role: 'assistant',
      content: `I extracted **${draftEvents.length} scheduled event(s)** from your message:\n\n${previewList}\n\nYou can click **"Apply to Calendar"** below to add these to your master schedule and arm your alarms immediately, or export them to a Google Doc.`,
      timestamp: timeStr,
      draftEvents,
      actionType: 'create_schedule',
      statusNote: `${draftEvents.length} events ready to apply`,
    };
  }

  // 3. User asks to build a complete routine / timetable from scratch
  if (lower.includes('create a schedule') || lower.includes('make a timetable') || lower.includes('study plan') || lower.includes('build schedule')) {
    const defaultStudyPlan: ScheduleEvent[] = [
      { id: `sp_${Date.now()}_1`, day: 0, hour: 9, minute: 0, duration: 120, title: 'Mathematics & Algorithms', subtitle: 'Deep Focus Study Block', category: 'academic', alarmEnabled: true },
      { id: `sp_${Date.now()}_2`, day: 0, hour: 14, minute: 0, duration: 90, title: 'Engineering Circuit Lab', subtitle: 'Lab Review & Simulation', category: 'engineering', alarmEnabled: true },
      { id: `sp_${Date.now()}_3`, day: 2, hour: 10, minute: 0, duration: 120, title: 'Software Architecture & Code', subtitle: 'Development Session', category: 'engineering', alarmEnabled: true },
      { id: `sp_${Date.now()}_4`, day: 4, hour: 17, minute: 0, duration: 60, title: 'Weekly Engineering Review', subtitle: 'Summary & Practice Questions', category: 'academic', alarmEnabled: true },
      { id: `sp_${Date.now()}_5`, day: 4, hour: 14, minute: 0, duration: 90, title: 'Spiritual Reflection & Devotion', subtitle: 'Friday Jumua / Fellowship', category: 'spiritual', alarmEnabled: true },
    ];

    return {
      id: newChatId(),
      role: 'assistant',
      content: `I have designed a balanced **${userProfile.department} weekly schedule** for you! It covers core academic lectures, engineering labs, Friday review, and reflection blocks:\n\n` +
        `• **Mon 9:00 AM** — Mathematics & Algorithms (2h)\n` +
        `• **Mon 2:00 PM** — Engineering Circuit Lab (1.5h)\n` +
        `• **Wed 10:00 AM** — Software Architecture & Code (2h)\n` +
        `• **Fri 2:00 PM** — Spiritual Reflection & Devotion (1.5h)\n` +
        `• **Fri 5:00 PM** — Weekly Engineering Review (1h)\n\n` +
        `Click **"Apply to Calendar & Arm Alarms"** below to load it into your dashboard, or ask me to change any times!`,
      timestamp: timeStr,
      draftEvents: defaultStudyPlan,
      actionType: 'create_schedule',
      statusNote: 'Custom schedule drafted',
    };
  }

  // 4. Default helpful greeting & assistance
  return {
    id: newChatId(),
    role: 'assistant',
    content: `Hello ${userProfile.name}! I am Chronos AI. Here is what I can do for you:\n\n` +
      `1. **Create Schedules From Chat**: Say *"Create a schedule for Monday 10am Math and Friday 5pm Review"*.\n` +
      `2. **Export to Google Drive**: Say *"Create a Google Doc for my schedule"* to save a formatted document directly to Drive.\n` +
      `3. **Query Timetable**: Ask *"What do I have on Friday?"* or *"How many classes today?"*.\n\n` +
      `You can also upload a \`.pdf\`, \`.docx\`, or \`.txt\` document anytime on the Dashboard!`,
    timestamp: timeStr,
    actionType: 'info',
  };
}

function formatHour12(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

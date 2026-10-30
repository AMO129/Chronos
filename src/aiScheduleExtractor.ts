/**
 * aiScheduleExtractor.ts
 * AI / LLM Schedule Extractor for Chronos
 * Connects to Gemini API, OpenAI-compatible API, or local intelligent NLP with timezone alignment.
 */

import { parseScheduleText, type ParsedEvent } from './scheduleParser';

export interface ExtractionResult {
  events: ParsedEvent[];
  source: 'gemini' | 'openai' | 'local_nlp';
  tokensUsed?: number;
  timeZone: string;
}

export interface AISettings {
  provider: 'gemini' | 'openai' | 'custom' | 'auto';
  apiKey?: string;
  customEndpoint?: string;
  modelName?: string;
}

/**
 * Get the user's system detected timezone.
 */
export function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Load AI settings from localStorage
 */
export function loadAISettings(): AISettings {
  try {
    const saved = localStorage.getItem('chronos_ai_settings');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load AI settings', e);
  }
  return {
    provider: 'auto',
    apiKey: '',
    modelName: 'gemini-1.5-flash',
  };
}

/**
 * Save AI settings to localStorage
 */
export function saveAISettings(settings: AISettings): void {
  localStorage.setItem('chronos_ai_settings', JSON.stringify(settings));
}

const AI_SYSTEM_PROMPT = `You are Chronos Timetable AI, a high-precision schedule and alarms extraction engine.
Analyze the provided document text (which could be a course syllabus, university timetable, daily planner, or study schedule) and extract every recurring or scheduled event.

User Timezone: {{TIMEZONE}}

For each event found, return a JSON array of objects with EXACTLY these fields:
- "title": (string) Clean event or course name without redundant codes.
- "subtitle": (string) Course code, location, lecturer, or details (e.g. "MAT 301 - LT2", "Zoom Room A").
- "day": (integer) Day of week: 0 = Monday, 1 = Tuesday, 2 = Wednesday, 3 = Thursday, 4 = Friday, 5 = Saturday, 6 = Sunday.
- "hour": (integer) 24-hour format start hour (0 to 23).
- "minute": (integer) Start minute (0 to 59).
- "duration": (integer) Duration of the event in minutes (e.g. 60, 90, 120). Default to 60 if not specified.
- "category": (string) Must be one of: "academic", "spiritual", "engineering", "meeting".

Rules:
1. If an event occurs on multiple days (e.g. "Mon, Wed", "Daily", "Tuesdays and Thursdays"), output a separate object for EACH day.
2. Ensure hours are in 24h format (e.g. 2:00 PM is hour 14, 8:00 AM is hour 8).
3. Do NOT make up fake events. Only extract events actually present or implied by the document.
4. Output STRICT JSON ONLY. Wrap the array in [ ... ] with no markdown backticks, no markdown code blocks, and no introductory text.`;

/**
 * Extract schedule using Google Gemini API
 */
async function extractWithGemini(
  text: string,
  apiKey: string,
  model = 'gemini-1.5-flash',
  timeZone: string
): Promise<ParsedEvent[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = `${AI_SYSTEM_PROMPT.replace('{{TIMEZONE}}', timeZone)}

Document text to extract:
---
${text.slice(0, 40000)}
---

JSON response:`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawContent) {
    throw new Error('Gemini API returned empty content');
  }

  return parseLLMJsonOutput(rawContent);
}

/**
 * Extract schedule using OpenAI / OpenRouter-compatible endpoint
 */
async function extractWithOpenAI(
  text: string,
  apiKey: string,
  endpoint = 'https://api.openai.com/v1/chat/completions',
  model = 'gpt-4o-mini',
  timeZone: string
): Promise<ParsedEvent[]> {
  const prompt = AI_SYSTEM_PROMPT.replace('{{TIMEZONE}}', timeZone);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Document content:\n${text.slice(0, 40000)}` },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('LLM returned empty message');
  }

  return parseLLMJsonOutput(rawContent);
}

/**
 * Sanitize and parse LLM JSON output into ParsedEvent array
 */
function parseLLMJsonOutput(raw: string): ParsedEvent[] {
  let cleaned = raw.trim();
  // Strip ```json ... ``` wrapper if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error('AI output was not a JSON array of events');
  }

  let pid = Date.now();
  return parsed.map((item: any) => ({
    id: `ai_${pid++}_${Math.random().toString(36).substring(2, 6)}`,
    day: typeof item.day === 'number' ? Math.max(0, Math.min(6, item.day)) : 0,
    hour: typeof item.hour === 'number' ? Math.max(0, Math.min(23, item.hour)) : 9,
    minute: typeof item.minute === 'number' ? Math.max(0, Math.min(59, item.minute)) : 0,
    duration: typeof item.duration === 'number' && item.duration > 0 ? item.duration : 60,
    title: String(item.title || 'Untitled Event').trim(),
    subtitle: String(item.subtitle || '').trim(),
    category: ['academic', 'spiritual', 'engineering', 'meeting'].includes(item.category)
      ? item.category
      : 'academic',
    alarmEnabled: true,
    raw: JSON.stringify(item),
  }));
}

/**
 * Main AI Schedule Extraction function
 * Automatically falls back to high-accuracy local NLP if no API key is set or if the network fails.
 */
export async function extractScheduleWithAI(
  documentText: string,
  settings?: AISettings
): Promise<ExtractionResult> {
  const currentSettings = settings || loadAISettings();
  const timeZone = getLocalTimeZone();

  // If user provided a Gemini API Key
  if (currentSettings.apiKey && (currentSettings.provider === 'gemini' || currentSettings.provider === 'auto')) {
    try {
      const events = await extractWithGemini(
        documentText,
        currentSettings.apiKey,
        currentSettings.modelName || 'gemini-1.5-flash',
        timeZone
      );
      if (events.length > 0) {
        return { events, source: 'gemini', timeZone };
      }
    } catch (err) {
      console.warn('Gemini extraction failed, falling back to local NLP engine:', err);
    }
  }

  // If user provided an OpenAI / Custom Key
  if (currentSettings.apiKey && currentSettings.provider === 'openai') {
    try {
      const endpoint = currentSettings.customEndpoint || 'https://api.openai.com/v1/chat/completions';
      const events = await extractWithOpenAI(
        documentText,
        currentSettings.apiKey,
        endpoint,
        currentSettings.modelName || 'gpt-4o-mini',
        timeZone
      );
      if (events.length > 0) {
        return { events, source: 'openai', timeZone };
      }
    } catch (err) {
      console.warn('OpenAI extraction failed, falling back to local NLP engine:', err);
    }
  }

  // Fallback to client-side rule-based NLP parser
  const localEvents = parseScheduleText(documentText);
  return {
    events: localEvents,
    source: 'local_nlp',
    timeZone,
  };
}

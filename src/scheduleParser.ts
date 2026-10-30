/**
 * scheduleParser.ts
 * Reads uploaded .txt / .md / .docx files and extracts ScheduleEvent objects.
 */

// @ts-ignore – mammoth ships its own types bundled but the ESM path varies
import mammoth from 'mammoth/mammoth.browser';

export type Category = 'academic' | 'spiritual' | 'engineering' | 'meeting';

export interface ParsedEvent {
  id: string;
  day: number;      // 0 = Mon … 6 = Sun
  hour: number;
  minute: number;
  duration: number; // minutes
  title: string;
  subtitle: string;
  category: Category;
  alarmEnabled: boolean;
  raw: string;      // original line for debugging
}

// ─── Day helpers ──────────────────────────────────────────────────────────────
const DAY_MAP: Record<string, number> = {
  monday: 0,    mon: 0,    m: 0,
  tuesday: 1,   tue: 1,    tues: 1,   t: 1,
  wednesday: 2, wed: 2,    w: 2,
  thursday: 3,  thu: 3,    thur: 3,   thurs: 3,  th: 3,
  friday: 4,    fri: 4,    f: 4,
  saturday: 5,  sat: 5,    sa: 5,
  sunday: 6,    sun: 6,    su: 6,
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function getDayName(dayIdx: number): string {
  return DAY_NAMES[dayIdx] ?? 'Day';
}

/**
 * Detect days in a text fragment, handling lists ("Mon, Wed"), ranges ("Sat-Sun", "Mon-Fri"),
 * and keywords ("Daily", "Weekdays", "Weekends").
 */
function extractDays(text: string): number[] {
  const lower = text.toLowerCase();

  if (/\bdaily\b|\bevery\s*day\b/i.test(lower)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  if (/\bweekdays\b|\bmon(?:day)?\s*[-–—to]+\s*fri(?:day)?\b/i.test(lower)) {
    return [0, 1, 2, 3, 4];
  }
  if (/\bweekends?\b|\bsat(?:urday)?\s*[-–—&and/]+\s*sun(?:day)?\b/i.test(lower)) {
    return [5, 6];
  }

  // Check ranges like "Sat-Sun" or "Mon-Wed"
  const rangeMatch = lower.match(/\b(mon|tue|wed|thu|fri|sat|sun)\s*[-–—to]+\s*(mon|tue|wed|thu|fri|sat|sun)\b/i);
  if (rangeMatch) {
    const start = DAY_MAP[rangeMatch[1]];
    const end = DAY_MAP[rangeMatch[2]];
    if (start !== undefined && end !== undefined) {
      const days: number[] = [];
      let cur = start;
      while (true) {
        days.push(cur);
        if (cur === end) break;
        cur = (cur + 1) % 7;
        if (days.length > 7) break;
      }
      return days;
    }
  }

  // Check comma or slash separated: "Mon, Wed", "Tue/Thu", "Monday, Wednesday, Friday"
  const tokens = lower.split(/[,/&+\s]+/);
  const found = new Set<number>();
  for (const token of tokens) {
    const cleaned = token.replace(/[^a-z]/g, '');
    if (cleaned && DAY_MAP[cleaned] !== undefined) {
      found.add(DAY_MAP[cleaned]);
    }
  }

  return Array.from(found);
}

// ─── Time helpers ─────────────────────────────────────────────────────────────
interface ParsedTime { hour: number; minute: number }

/**
 * Try to parse a time string like "8:00 AM", "14:30", "8am", "9:00am", "4pm".
 */
function parseTime(s: string): ParsedTime | null {
  const clean = s.trim().toLowerCase();
  // 12h: 8:00 AM, 8am, 10:30pm
  const m12 = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const suf = m12[3];
    if (suf === 'pm' && h !== 12) h += 12;
    if (suf === 'am' && h === 12) h = 0;
    return { hour: h, minute: min };
  }
  // 24h: 08:00, 14:30
  const m24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (h >= 0 && h < 24 && min >= 0 && min < 60) {
      return { hour: h, minute: min };
    }
  }
  return null;
}

/** Scan a string and return the first time token found, plus its char index. */
function extractFirstTime(text: string): (ParsedTime & { index: number; raw: string }) | null {
  const patterns = [
    /\b(\d{1,2}:\d{2}\s*(?:am|pm))\b/gi,   // 8:00 AM
    /\b(\d{1,2}\s*(?:am|pm))\b/gi,         // 8 AM / 4pm
    /\b(\d{1,2}:\d{2})\b/g,                // 14:30 or 08:00
  ];
  let best: (ParsedTime & { index: number; raw: string }) | null = null;
  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const parsed = parseTime(match[1]);
      if (parsed && (best === null || match.index < best.index)) {
        best = { ...parsed, index: match.index, raw: match[1] };
      }
    }
    if (best) return best;
  }
  return null;
}

/** Parse duration string: "2 hours", "90 min", "1h30m" */
function parseDuration(s: string): number | null {
  const h = s.match(/(\d+)\s*h(?:our|r)?s?/i);
  const m = s.match(/(\d+)\s*m(?:in(?:ute)?)?s?/i);
  if (h || m) {
    return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
  }
  return null;
}

// ─── Category classifier ──────────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  spiritual: [
    'prayer', 'quran', 'salah', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha',
    'jumua', "jumu'ah", 'jumu', 'dhikr', 'worship', 'mosque', 'islamic',
    'hadith', 'tafsir', 'seerah', 'sunna', 'masjid', 'bible', 'devotion',
    'chapel', 'church', 'meditation',
  ],
  engineering: [
    'lab', 'circuit', 'signal', 'control', 'digital', 'analog', 'microcontroller',
    'eee', 'ece', 'cpe', 'elec', 'embedded', 'firmware', 'pcb', 'vhdl',
    'fpga', 'dsp', 'sensor', 'datasheet', 'oscilloscope', 'design', 'schematic',
    'sen', 'sen 292', 'sen292', 'engineering', 'hardware', 'code', 'coding',
    'software', 'robotics', 'cad', 'project review',
  ],
  academic: [
    'lecture', 'class', 'tutorial', 'seminar', 'exam', 'quiz', 'assignment',
    'csc', 'mat', 'phy', 'chm', 'bio', 'mth', 'sta', 'algebra', 'calculus',
    'thermodynamics', 'algorithms', 'structures', 'physics', 'chemistry',
    'mathematics', 'statistics', 'linear', 'differential', 'discrete', 'study',
    'review session', 'reading', 'homework',
  ],
  meeting: [
    'meeting', 'sync', 'standup', 'stand-up', 'call', 'zoom', 'teams',
    'advisor', 'office hours', 'seminar', 'conference', 'discussion',
    'presentation', 'group project', 'group work', 'team sync',
  ],
};

function guessCategory(title: string, subtitle = ''): Category {
  const haystack = (title + ' ' + subtitle).toLowerCase();
  for (const cat of ['spiritual', 'engineering', 'meeting', 'academic'] as Category[]) {
    if (CATEGORY_KEYWORDS[cat].some(kw => haystack.includes(kw))) return cat;
  }
  return 'academic';
}

// ─── Core parser ──────────────────────────────────────────────────────────────
let _pid = 1000;

/**
 * Parse plain text (from .txt, .md, or extracted .docx) into ParsedEvents.
 */
export function parseScheduleText(text: string): ParsedEvent[] {
  const results: ParsedEvent[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let currentHeadingDays: number[] = [0]; // default Mon

  for (const line of lines) {
    // Strip markdown formatting & table bars
    const cleanLine = line
      .replace(/\|/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\*+/g, '')
      .replace(/#+\s*/g, '')
      .trim();

    // Check if line is a day heading (e.g. "Monday", "## Tuesday", "Monday - Wednesday:")
    const daysFromLine = extractDays(cleanLine);
    const hasTimeInLine = extractFirstTime(cleanLine) !== null;

    if (!hasTimeInLine && daysFromLine.length > 0 && cleanLine.length < 35) {
      currentHeadingDays = daysFromLine;
      continue;
    }

    if (!hasTimeInLine) continue;

    // Time found in line
    const timeMatch = extractFirstTime(cleanLine)!;
    const targetDays = daysFromLine.length > 0 ? daysFromLine : currentHeadingDays;

    // Text before and after the time match
    const beforeTime = cleanLine.slice(0, timeMatch.index).trim();
    const afterTime = cleanLine.slice(timeMatch.index + timeMatch.raw.length)
      .replace(/^\s*[-–—:to]+\s*/i, '')
      .trim();

    // Look for second time token (end time)
    let duration = 60; // default 1 hour
    const endTimeMatch = extractFirstTime(afterTime);
    let remainder = afterTime;

    if (endTimeMatch) {
      const startMins = timeMatch.hour * 60 + timeMatch.minute;
      const endMins = endTimeMatch.hour * 60 + endTimeMatch.minute;
      if (endMins > startMins) {
        duration = endMins - startMins;
      }
      remainder = afterTime.slice(endTimeMatch.index + endTimeMatch.raw.length)
        .replace(/^\s*[-–—:]\s*/, '')
        .trim();
    } else {
      const dur = parseDuration(afterTime);
      if (dur) duration = dur;
    }

    // Determine title & subtitle
    let candidateTitle = (remainder.length >= 2 ? remainder : beforeTime)
      .replace(/\b(daily|weekdays|weekends|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, '')
      .replace(/\d{1,2}(?::\d{2})?\s*(?:am|pm)/gi, '')
      .replace(/\d+\s*(?:hour|hr|h|minute|min|m)s?\b/gi, '')
      .replace(/[-–—•·]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (candidateTitle.length < 2 && beforeTime.length >= 2) {
      candidateTitle = beforeTime
        .replace(/\b(daily|weekdays|weekends|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, '')
        .replace(/[-–—•·]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (candidateTitle.length < 2) continue;

    // Pull parenthetical or dash as subtitle
    let subtitle = '';
    const parenMatch = candidateTitle.match(/^(.*?)\s*[\(\[]([^()\[\]]+)[\)\]]\s*(.*)$/);
    if (parenMatch) {
      candidateTitle = (parenMatch[1] + ' ' + parenMatch[3]).trim();
      subtitle = parenMatch[2].trim();
    } else if (candidateTitle.includes(' - ')) {
      const parts = candidateTitle.split(' - ');
      candidateTitle = parts[0].trim();
      subtitle = parts.slice(1).join(' - ').trim();
    }

    // Capitalize words nicely
    candidateTitle = candidateTitle.replace(/\b\w/g, c => c.toUpperCase());

    // Generate an event for each targeted day (e.g. Mon, Wed)
    for (const d of targetDays) {
      results.push({
        id: `p${_pid++}`,
        day: d,
        hour: timeMatch.hour,
        minute: timeMatch.minute,
        duration,
        title: candidateTitle,
        subtitle: subtitle || `${duration} min block`,
        category: guessCategory(candidateTitle, subtitle),
        alarmEnabled: true,
        raw: cleanLine,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return results.filter(e => {
    const key = `${e.day}-${e.hour}:${e.minute}-${e.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── File reader ──────────────────────────────────────────────────────────────
export async function readFileText(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();

  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value as string;
  }

  // txt / md – FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

export async function parseScheduleFile(file: File): Promise<ParsedEvent[]> {
  const text = await readFileText(file);
  return parseScheduleText(text);
}

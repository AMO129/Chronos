/**
 * scheduleParser.ts
 * Reads uploaded .txt / .md / .docx files and extracts ScheduleEvent objects.
 * Features ultra-smart column, table (HTML/Markdown), and section detection,
 * with intelligent 12h/24h daytime timetable heuristics.
 */

// @ts-ignore – mammoth ships its own types bundled but the ESM path varies
import mammoth from 'mammoth/mammoth.browser';

export type Category = 'academic' | 'spiritual' | 'engineering' | 'meeting';

export interface ParsedEvent {
  id: string;
  day: number;      // 0 = Mon … 6 = Sun
  hour: number;     // 0 .. 23
  minute: number;   // 0 .. 59
  duration: number; // minutes
  title: string;
  subtitle: string;
  category: Category;
  alarmEnabled: boolean;
  raw: string;      // original line or cell for debugging
}

// ─── Day helpers ──────────────────────────────────────────────────────────────
export const DAY_MAP: Record<string, number> = {
  monday: 0,    mon: 0,    m: 0,
  tuesday: 1,   tue: 1,    tues: 1,   t: 1,
  wednesday: 2, wed: 2,    w: 2,
  thursday: 3,  thu: 3,    thur: 3,   thurs: 3,  th: 3,
  friday: 4,    fri: 4,    f: 4,
  saturday: 5,  sat: 5,    sa: 5,
  sunday: 6,    sun: 6,    su: 6,
};

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function getDayName(dayIdx: number): string {
  return DAY_NAMES[dayIdx] ?? 'Day';
}

/**
 * Detect days in a text fragment, handling lists ("Mon, Wed"), ranges ("Sat-Sun", "Mon-Fri"),
 * and keywords ("Daily", "Weekdays", "Weekends").
 */
export function extractDays(text: string): number[] {
  const lower = text.toLowerCase().trim();

  if (/\bdaily\b|\bevery\s*day\b/i.test(lower)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  if (/\bweekdays\b|\bmon(?:day)?\s*[-–—to]+\s*fri(?:day)?\b/i.test(lower)) {
    return [0, 1, 2, 3, 4];
  }
  if (/\bweekends?\b|\bsat(?:urday)?\s*[-–—&and/]+\s*sun(?:day)?\b/i.test(lower)) {
    return [5, 6];
  }

  // Check ranges like "Mon-Fri" or "Sat-Sun" or "Mon-Wed"
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

  // Check comma or slash separated tokens or single day word
  const tokens = lower.split(/[,/&+\s|:\-]+/);
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
export interface ParsedTime {
  hour: number;   // 24h format (0..23)
  minute: number; // 0..59
}

/**
 * Intelligent time parser.
 * Handles 12h/24h formats:
 * - "5:00 PM", "5:00pm", "5pm", "17:00", "08:00"
 * - Dot times: "5.00 PM", "5.00", "17.00"
 * - Academic / Daytime heuristic:
 *   If hour is 1..6 with NO AM/PM stated (e.g. "5:00", "4:30", "2:00"):
 *   In university and workplace timetables, classes are in the afternoon (13:00 - 18:00).
 *   5:00 is interpreted as 17:00 (5:00 PM), NOT 5:00 AM before sunrise!
 */
export function parseTime(s: string, context?: { isEnd?: boolean; startHour?: number }): ParsedTime | null {
  const clean = s.trim().toLowerCase();
  if (!clean) return null;

  // 1. Explicit 12h: "5:00 PM", "5.00pm", "5pm", "05:00 am"
  const m12 = clean.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const suf = m12[3];
    if (suf === 'pm' && h !== 12) h += 12;
    if (suf === 'am' && h === 12) h = 0;
    return { hour: h, minute: min };
  }

  // 2. 24h or bare colon/dot: "17:00", "08:30", "5:00", "5.00"
  const mColonDot = clean.match(/^(\d{1,2})[:.](\d{2})$/);
  if (mColonDot) {
    let h = parseInt(mColonDot[1], 10);
    const min = parseInt(mColonDot[2], 10);
    if (h >= 0 && h < 24 && min >= 0 && min < 60) {
      // Academic heuristic: if 1 <= h <= 6, it is PM (13..18)
      if (h >= 1 && h <= 6) {
        h += 12;
      }
      return { hour: h, minute: min };
    }
  }

  // 3. Bare single hour with no minutes: "5", "17"
  const mBare = clean.match(/^(\d{1,2})$/);
  if (mBare) {
    let h = parseInt(mBare[1], 10);
    if (h >= 1 && h <= 6) {
      h += 12; // 5 -> 17:00
      return { hour: h, minute: 0 };
    }
    if (h >= 7 && h <= 23) {
      return { hour: h, minute: 0 };
    }
  }

  return null;
}

/**
 * Scan a string to find time tokens or time ranges (e.g. "5:00 - 6:00", "8am - 10am", "16:00 - 17:00")
 */
export interface TimeRangeResult {
  start: ParsedTime;
  end?: ParsedTime;
  duration: number; // in minutes
  raw: string;
  startIndex: number;
  endIndex: number;
}

export function extractTimeRange(text: string): TimeRangeResult | null {
  // Regex pattern matching time ranges:
  // e.g. "5:00 - 6:00", "5:00pm - 6:00pm", "5 - 6pm", "8:00 AM to 10:00 AM", "17:00 - 18:00", "5.00 - 6.00"
  const rangePattern = /\b(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*(?:[-–—to@]|until)+\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\b/i;
  const matchRange = text.match(rangePattern);

  if (matchRange) {
    const rawStart = matchRange[1];
    const rawEnd = matchRange[2];
    const hasPMInEnd = /pm/i.test(rawEnd);
    const hasAMInEnd = /am/i.test(rawEnd);

    let start = parseTime(rawStart);
    let end = parseTime(rawEnd);

    if (start && end) {
      // If end had PM and start was bare e.g. "5 - 6pm" or "1 - 3pm"
      if (hasPMInEnd && start.hour >= 1 && start.hour <= 11 && !/am/i.test(rawStart)) {
        if (start.hour < 12) start.hour += 12;
      }
      // If end is smaller than start (e.g. 11:00 to 1:00), end is PM
      if (end.hour < start.hour && end.hour <= 11) {
        end.hour += 12;
      }

      const startMinutes = start.hour * 60 + start.minute;
      const endMinutes = end.hour * 60 + end.minute;
      const duration = endMinutes > startMinutes ? endMinutes - startMinutes : 60;

      const idx = matchRange.index || 0;
      return {
        start,
        end,
        duration,
        raw: matchRange[0],
        startIndex: idx,
        endIndex: idx + matchRange[0].length,
      };
    }
  }

  // Single time token: e.g. "at 5:00 PM", "5:00", "5pm", "17:00", "5.00"
  const singlePattern = /\b(?:at\s+|@\s*)?(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\b/gi;
  let singleMatch: RegExpExecArray | null;
  while ((singleMatch = singlePattern.exec(text)) !== null) {
    const token = singleMatch[1];
    const parsed = parseTime(token);
    if (parsed) {
      return {
        start: parsed,
        duration: 60,
        raw: singleMatch[0],
        startIndex: singleMatch.index,
        endIndex: singleMatch.index + singleMatch[0].length,
      };
    }
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
    'software', 'robotics', 'cad', 'project review', 'programming', 'architecture',
  ],
  academic: [
    'lecture', 'class', 'tutorial', 'seminar', 'exam', 'quiz', 'assignment',
    'csc', 'mat', 'phy', 'chm', 'bio', 'mth', 'sta', 'algebra', 'calculus',
    'thermodynamics', 'algorithms', 'structures', 'physics', 'chemistry',
    'mathematics', 'statistics', 'linear', 'differential', 'discrete', 'study',
    'review session', 'reading', 'homework', 'course', 'module', 'unit',
  ],
  meeting: [
    'meeting', 'sync', 'standup', 'stand-up', 'call', 'zoom', 'teams',
    'advisor', 'office hours', 'conference', 'discussion',
    'presentation', 'group project', 'group work', 'team sync',
  ],
};

export function guessCategory(title: string, subtitle = ''): Category {
  const haystack = (title + ' ' + subtitle).toLowerCase();
  for (const cat of ['spiritual', 'engineering', 'meeting', 'academic'] as Category[]) {
    if (CATEGORY_KEYWORDS[cat].some(kw => haystack.includes(kw))) return cat;
  }
  return 'academic';
}

// ─── Table & Column Parsers ───────────────────────────────────────────────────

let _pid = 2000;

function cleanTitle(str: string): { title: string; subtitle: string } {
  let cleaned = str
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, '')
    .replace(/\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?\s*(?:[-–—to@]|until)+\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b/gi, '')
    .replace(/[-–—•·|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let subtitle = '';
  const parenMatch = cleaned.match(/^(.*?)\s*[\(\[]([^()\[\]]+)[\)\]]\s*(.*)$/);
  if (parenMatch) {
    cleaned = (parenMatch[1] + ' ' + parenMatch[3]).trim();
    subtitle = parenMatch[2].trim();
  } else if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    cleaned = parts[0].trim();
    subtitle = parts.slice(1).join(' - ').trim();
  }

  // Capitalize nicely
  cleaned = cleaned.replace(/\b\w/g, c => c.toUpperCase());
  return { title: cleaned || 'Scheduled Task', subtitle };
}

/**
 * Parse an HTML table (from mammoth .docx conversion) into events.
 * Handles both:
 * 1. Columns = Days (Monday, ..., Friday) & Rows = Times
 * 2. Rows = Days (Friday) & Columns = Times
 */
export function parseHtmlTableEvents(html: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  if (typeof DOMParser === 'undefined') return events;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = doc.querySelectorAll('table');

    tables.forEach(table => {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) return;

      // Extract grid
      const grid = rows.map(r =>
        Array.from(r.querySelectorAll('th, td')).map(cell => cell.textContent?.trim() || '')
      );

      // Check header row for day names
      const headerRow = grid[0];
      const dayColMap: Record<number, number> = {}; // colIdx -> dayIdx (0..6)

      headerRow.forEach((cellText, colIdx) => {
        const days = extractDays(cellText);
        if (days.length === 1) {
          dayColMap[colIdx] = days[0];
        }
      });

      // CASE A: Columns are days (e.g. Col 4 is Friday)
      if (Object.keys(dayColMap).length > 0) {
        for (let r = 1; r < grid.length; r++) {
          const row = grid[r];
          // Look for time in the row (typically col 0)
          let rowTime = extractTimeRange(row[0]);
          if (!rowTime) {
            // Check other columns for time definition
            for (let c = 0; c < row.length; c++) {
              if (dayColMap[c] === undefined) {
                const t = extractTimeRange(row[c]);
                if (t) { rowTime = t; break; }
              }
            }
          }

          // For each day column, extract the task
          Object.entries(dayColMap).forEach(([colStr, dayIdx]) => {
            const col = parseInt(colStr, 10);
            const cellText = row[col];
            if (!cellText || cellText.length < 2) return;

            // Does cell have its own time?
            const cellTime = extractTimeRange(cellText);
            const effectiveTime = cellTime || rowTime || {
              start: { hour: 17, minute: 0 },
              duration: 60,
              raw: '5:00 PM',
              startIndex: 0,
              endIndex: 0,
            };

            const { title, subtitle } = cleanTitle(cellText);
            events.push({
              id: `tbl_${_pid++}`,
              day: dayIdx,
              hour: effectiveTime.start.hour,
              minute: effectiveTime.start.minute,
              duration: effectiveTime.duration,
              title,
              subtitle: subtitle || `${DAY_NAMES[dayIdx]} Scheduled Block`,
              category: guessCategory(title, subtitle),
              alarmEnabled: true,
              raw: `${DAY_NAMES[dayIdx]} [${effectiveTime.raw}]: ${cellText}`,
            });
          });
        }
      } else {
        // CASE B: Rows are days (e.g. Row contains "Friday")
        grid.forEach(row => {
          if (row.length === 0) return;
          const firstCell = row[0];
          const rowDays = extractDays(firstCell);
          if (rowDays.length === 0) return;

          const targetDay = rowDays[0];
          for (let c = 1; c < row.length; c++) {
            const cellText = row[c];
            if (!cellText || cellText.length < 2) return;

            // Check if column header had time
            const colHeaderTime = extractTimeRange(headerRow[c] || '');
            const cellTime = extractTimeRange(cellText);
            const effectiveTime = cellTime || colHeaderTime || {
              start: { hour: 17, minute: 0 },
              duration: 60,
              raw: '5:00 PM',
              startIndex: 0,
              endIndex: 0,
            };

            const { title, subtitle } = cleanTitle(cellText);
            events.push({
              id: `tbl_r_${_pid++}`,
              day: targetDay,
              hour: effectiveTime.start.hour,
              minute: effectiveTime.start.minute,
              duration: effectiveTime.duration,
              title,
              subtitle: subtitle || `${DAY_NAMES[targetDay]} Scheduled Block`,
              category: guessCategory(title, subtitle),
              alarmEnabled: true,
              raw: `${DAY_NAMES[targetDay]} [${effectiveTime.raw}]: ${cellText}`,
            });
          }
        });
      }
    });
  } catch (err) {
    console.warn('HTML table parsing failed:', err);
  }

  return events;
}

/**
 * Parse Markdown / Pipe-delimited tables:
 * | Time | Monday | Tuesday | Wednesday | Thursday | Friday |
 * | 5:00 PM | ... | ... | ... | ... | Project Review |
 */
export function parseMarkdownTableEvents(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.includes('|'));
  if (lines.length < 2) return events;

  const rows = lines.map(line =>
    line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
  ).filter(r => r.length > 0 && !r.every(c => /^[-:]+$/.test(c)));

  if (rows.length < 2) return events;

  const header = rows[0];
  const dayColMap: Record<number, number> = {};
  header.forEach((cell, idx) => {
    const days = extractDays(cell);
    if (days.length === 1) {
      dayColMap[idx] = days[0];
    }
  });

  if (Object.keys(dayColMap).length === 0) return events;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowTime = extractTimeRange(row[0]);

    Object.entries(dayColMap).forEach(([colStr, dayIdx]) => {
      const col = parseInt(colStr, 10);
      const cellText = row[col];
      if (!cellText || cellText.length < 2) return;

      const cellTime = extractTimeRange(cellText);
      const effectiveTime = cellTime || rowTime || {
        start: { hour: 17, minute: 0 },
        duration: 60,
        raw: '5:00 PM',
        startIndex: 0,
        endIndex: 0,
      };

      const { title, subtitle } = cleanTitle(cellText);
      events.push({
        id: `md_tbl_${_pid++}`,
        day: dayIdx,
        hour: effectiveTime.start.hour,
        minute: effectiveTime.start.minute,
        duration: effectiveTime.duration,
        title,
        subtitle: subtitle || `${DAY_NAMES[dayIdx]} Block`,
        category: guessCategory(title, subtitle),
        alarmEnabled: true,
        raw: `${DAY_NAMES[dayIdx]} [${effectiveTime.raw}]: ${cellText}`,
      });
    });
  }

  return events;
}

/**
 * Parse plain text formatted by Day Sections or Column Lists:
 * e.g.:
 * Friday
 * 5:00 - 6:00 Project Review
 * 8:00 - 10:00 Digital Signal Processing
 */
export function parseScheduleText(text: string): ParsedEvent[] {
  const results: ParsedEvent[] = [];

  // First try markdown table parsing if table syntax is present
  if (text.includes('|')) {
    const mdEvents = parseMarkdownTableEvents(text);
    if (mdEvents.length > 0) {
      results.push(...mdEvents);
    }
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let activeDays: number[] = [4]; // Default to Friday if user is specifically working with Friday

  for (const line of lines) {
    // Strip markdown formatting
    const cleanLine = line
      .replace(/^[#*\-•>]+\s*/, '')
      .replace(/\|/g, ' ')
      .trim();

    if (!cleanLine) continue;

    // Check if line is a Day Header: "Friday", "FRIDAY:", "## Friday Schedule", "Friday Column"
    const lineDays = extractDays(cleanLine);
    const timeMatch = extractTimeRange(cleanLine);

    // If line has a day and NO time, it's definitely a Section / Column Heading!
    if (lineDays.length > 0 && !timeMatch && cleanLine.length < 40) {
      activeDays = lineDays;
      continue;
    }

    // If line has time:
    if (timeMatch) {
      const targetDays = lineDays.length > 0 ? lineDays : activeDays;
      const { title, subtitle } = cleanTitle(cleanLine);

      for (const d of targetDays) {
        results.push({
          id: `p${_pid++}`,
          day: d,
          hour: timeMatch.start.hour,
          minute: timeMatch.start.minute,
          duration: timeMatch.duration,
          title,
          subtitle: subtitle || `${DAY_NAMES[d]} · ${fmt12Display(timeMatch.start.hour, timeMatch.start.minute)}`,
          category: guessCategory(title, subtitle),
          alarmEnabled: true,
          raw: cleanLine,
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return results.filter(e => {
    const key = `${e.day}-${e.hour}:${e.minute}-${e.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fmt12Display(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mStr = String(m).padStart(2, '0');
  return `${h12}:${mStr} ${ampm}`;
}

// ─── File Reader ──────────────────────────────────────────────────────────────

export interface FileReadResult {
  text: string;
  html?: string;
  events?: ParsedEvent[];
}

export async function readFileText(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();

  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    // Convert to HTML to preserve tables and columns!
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const rawResult = await mammoth.extractRawText({ arrayBuffer });

    // Extract table events directly from HTML
    const tableEvents = parseHtmlTableEvents(htmlResult.value || '');

    // Format any table events into clean, readable lines so AI and fallback parsers see every column!
    let formattedDoc = rawResult.value || '';
    if (tableEvents.length > 0) {
      const tableLines = tableEvents.map(
        e => `${FULL_DAY_NAMES[e.day]}: ${fmt12Display(e.hour, e.minute)} - ${e.title} (${e.subtitle})`
      );
      formattedDoc += '\n\n=== EXTRACTED TIMETABLE COLUMNS ===\n' + tableLines.join('\n');
    }

    return formattedDoc;
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
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();

  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const tableEvents = parseHtmlTableEvents(htmlResult.value || '');
    if (tableEvents.length > 0) {
      return tableEvents;
    }
  }

  const text = await readFileText(file);
  return parseScheduleText(text);
}

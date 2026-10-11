// House plan descriptions are pasted in as chat-style markdown ("**Ground
// Floor** * **Kitchen:** ..."). This turns that text into floors and rooms so
// the page can show it as a tidy room-by-room guide instead of one block.
// Pure functions, safe in server components. Plain text with no markup falls
// back to paragraphs.

export interface PlanRoom {
  label: string | null;
  text: string;
}

export interface PlanSection {
  title: string;
  rooms: PlanRoom[];
}

export interface ParsedDescription {
  intro: string[];
  sections: PlanSection[];
}

function clean(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/(^|\s)\*([^*\s][^*]*?)\*(?=\s|[.,;:!?)]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .replace(/^[\s*•\-–—]+/, '')
    .trim();
}

function toRooms(body: string): PlanRoom[] {
  const rooms: PlanRoom[] = [];
  const parts = body.split(/(?:^|\s)\*\s+(?=\*\*|[A-Za-z])/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^\*{0,2}\s*([^*:]{2,40}?)\s*:\s*\*{0,2}\s*([\s\S]*)$/) ?? part.match(/^\*\*([^*]{2,40}?)\*\*:?\s*([\s\S]*)$/);
    if (m && m[2].trim()) rooms.push({ label: clean(m[1]), text: clean(m[2]) });
    else {
      const t = clean(part);
      if (t) rooms.push({ label: null, text: t });
    }
  }
  return rooms;
}

export function parseHousePlanDescription(raw: string): ParsedDescription {
  const text = (raw ?? '')
    .replace(/\r/g, '')
    .replace(/\n\s*[-•]\s+/g, ' * ')
    .replace(/\n+/g, ' ')
    .trim();
  if (!text) return { intro: [], sections: [] };

  // A heading is bold text WITHOUT a colon ("**Ground Floor**"); bold with a
  // colon ("**Kitchen:**") is a room label.
  const headingRe = /\*\*(?=[A-Za-z(])([^*:]{2,40}?)(?<=[A-Za-z)])\*\*(?!\s*:)/g;
  const marks: { title: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(text)) !== null) {
    marks.push({ title: clean(m[1]), start: m.index, end: m.index + m[0].length });
  }

  if (marks.length === 0) {
    const sentences = clean(text).split(/(?<=[.!?])\s+(?=[A-Z])/);
    const paras: string[] = [];
    for (let i = 0; i < sentences.length; i += 3) paras.push(sentences.slice(i, i + 3).join(' '));
    return { intro: paras.filter(Boolean), sections: [] };
  }

  const introText = clean(text.slice(0, marks[0].start));
  const sections: PlanSection[] = marks.map((mk, i) => ({
    title: mk.title,
    rooms: toRooms(text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : undefined)),
  }));
  return { intro: introText ? [introText] : [], sections: sections.filter((s) => s.rooms.length > 0) };
}

const ROOM_ICONS: [RegExp, string][] = [
  [/car|porch|outside|lawn|garden|gate|parking/i, '🚗'],
  [/guest|drawing|sitting|living/i, '🛋️'],
  [/family|lounge|tv/i, '📺'],
  [/kitchen/i, '🍳'],
  [/bed/i, '🛏️'],
  [/bath|washroom|toilet/i, '🚿'],
  [/servant|store|quarter/i, '🧰'],
  [/roof|mumty|mumty|tank/i, '☀️'],
  [/terrace|balcon/i, '🌇'],
  [/stair|corridor|hallway/i, '🪜'],
];

export function roomIcon(label: string | null): string {
  if (!label) return '•';
  return ROOM_ICONS.find(([re]) => re.test(label))?.[1] ?? '•';
}

export function sectionIcon(title: string): string {
  if (/ground|lower/i.test(title)) return '🏠';
  if (/roof|mumty|top/i.test(title)) return '☀️';
  if (/basement/i.test(title)) return '⬇️';
  return '⬆️';
}

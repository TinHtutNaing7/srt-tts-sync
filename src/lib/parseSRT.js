/**
 * Parses an SRT subtitle file string into structured entry objects.
 * Handles both comma and dot as millisecond separator.
 */
export function parseSRT(content) {
  const blocks = content.trim().split(/\n\s*\n/);
  const entries = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;

    const timeLine = lines[1];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split(/\s*-->\s*/);
    const start = parseTimecode(startStr.trim());
    const end = parseTimecode(endStr.trim());
    if (isNaN(start) || isNaN(end)) continue;

    // Join remaining lines, strip HTML tags (e.g. <i>, <b>)
    const text = lines.slice(2).join(' ').replace(/<[^>]+>/g, '').trim();
    if (!text) continue;

    entries.push({ index, start, end, text });
  }

  return entries;
}

/**
 * Parses "HH:MM:SS,mmm" or "HH:MM:SS.mmm" into seconds (float).
 */
function parseTimecode(str) {
  const normalized = str.replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length !== 3) return NaN;
  const h = parseFloat(parts[0]);
  const m = parseFloat(parts[1]);
  const s = parseFloat(parts[2]);
  return h * 3600 + m * 60 + s;
}

/**
 * Formats seconds back into SRT timecode "HH:MM:SS,mmm".
 */
export function formatTimecode(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':') + ',' + String(ms).padStart(3, '0');
}

/**
 * Formats seconds as "MM:SS.s" for compact display.
 */
export function formatShort(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}

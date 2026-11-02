// Streak maths. A reading day is a 'YYYY-MM-DD' string. A new reading day starts at 3 AM local time,
// so reading after midnight still counts for the evening before.

export const DAY_START_HOUR = 3;
export const MUSHAF_PAGES = 604;
export const MILESTONES = [3, 7, 14, 30, 40, 60, 100, 200, 365];

const pad = (n) => String(n).padStart(2, '0');
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value) {
  return typeof value === 'string' && DAY.test(value);
}

export function appDay(now = new Date()) {
  const t = new Date(now.getTime() - DAY_START_HOUR * 3600e3);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function toUTC(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day, n) {
  const t = new Date(toUTC(day) + n * 86400e3);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function daysBetween(from, to) {
  return Math.round((toUTC(to) - toUTC(from)) / 86400e3);
}

export function weekday(day) {
  return new Date(toUTC(day)).getUTCDay();
}

/** The moment the reading day `today` ends: 3 AM on the next calendar day, local time. */
export function dayEndsAt(today) {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(y, m - 1, d + 1, DAY_START_HOUR, 0, 0, 0);
}

/** The days in `days` that were read, oldest first, ignoring any after today (a phone with a wrong clock). */
export function readDays(days, today) {
  return Object.keys(days || {}).filter((d) => isDay(d) && d <= today).sort();
}

export function lastDays(today, n) {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

/**
 * current: the streak still alive today. If today isn't read yet, a streak that reached yesterday still counts.
 * best: the longest run ever. total: days read.
 */
export function streaks(dayList, today) {
  const set = new Set(dayList);
  const readToday = set.has(today);
  let current = 0;
  for (let d = readToday ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) current++;
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of [...set].sort()) {
    run = prev !== null && daysBetween(prev, d) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return { current, best, readToday, total: set.size };
}

/** Days that everyone read. */
export function sharedDays(lists) {
  if (!lists.length) return [];
  const [first, ...rest] = lists.map((list) => new Set(list));
  return [...first].filter((d) => rest.every((s) => s.has(d))).sort();
}

export function nextMilestone(n) {
  return MILESTONES.find((m) => m > n) ?? null;
}

/** How far the streak is from the last milestone to the next one, 0 to 1. */
export function milestoneProgress(n) {
  const next = nextMilestone(n);
  if (next === null) return 1;
  const prev = [...MILESTONES].reverse().find((m) => m <= n) ?? 0;
  return (n - prev) / (next - prev);
}

/** Pages read, counted into full readings of the mushaf (604 pages). */
export function khatma(days) {
  const total = Object.values(days || {}).reduce((sum, p) => sum + (Number.isFinite(p) && p > 0 ? p : 0), 0);
  return { total, done: Math.floor(total / MUSHAF_PAGES), pages: total % MUSHAF_PAGES };
}

/** The same item for everyone on a given day, a different one the next day. */
export function dailyPick(list, today) {
  const i = daysBetween('2024-01-01', today);
  return list[((i % list.length) + list.length) % list.length];
}

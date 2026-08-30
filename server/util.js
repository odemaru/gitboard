const DAY = 24 * 3600;

// Thresholds lean on weeks longer than Intl would, to match how git itself
// phrases relative dates ("5 недель назад", not "в прошлом месяце"). The
// threshold a unit takes over at is separate from the length of that unit —
// months take over at eight weeks but are still counted in 30-day steps.
const UNITS = [
  { unit: 'year', from: 365 * DAY, size: 365 * DAY, numeric: 'always' },
  { unit: 'month', from: 56 * DAY, size: 30 * DAY, numeric: 'always' },
  { unit: 'week', from: 7 * DAY, size: 7 * DAY, numeric: 'always' },
  { unit: 'day', from: DAY, size: DAY, numeric: 'auto' },
  { unit: 'hour', from: 3600, size: 3600, numeric: 'auto' },
  { unit: 'minute', from: 60, size: 60, numeric: 'auto' },
];

const FORMATTERS = {
  auto: new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }),
  always: new Intl.RelativeTimeFormat('ru', { numeric: 'always' }),
};

export function relTime(iso, now = Date.now()) {
  if (!iso) return '';
  const seconds = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(seconds);
  for (const { unit, from, size, numeric } of UNITS) {
    if (abs >= from) return FORMATTERS[numeric].format(Math.round(seconds / size), unit);
  }
  return 'только что';
}

export function daysSince(iso, now = Date.now()) {
  if (!iso) return Infinity;
  return (now - new Date(iso).getTime()) / (24 * 3600 * 1000);
}

const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function formatDue(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${DOW[d.getDay()]}`;
}

export function todayYmd(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

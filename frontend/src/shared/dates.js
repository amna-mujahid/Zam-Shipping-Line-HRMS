// Date helpers. All calendar dates are local 'YYYY-MM-DD' strings and
// clock times are 'HH:MM' strings, so records stay timezone-agnostic.

const pad = (n) => String(n).padStart(2, '0');

export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayStr = () => toDateStr(new Date());

export const nowTimeStr = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const dayName = (s) => DAY_NAMES[parseDate(s).getDay()];
export const isWeekend = (s) => {
  const day = parseDate(s).getDay();
  return day === 0 || day === 6;
};

export const dateRange = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

// Pay periods ("months"). The company month runs from the 26th to the 25th of the
// next month and is named after the month it ends in:
//   '2026-11' = November 2026 = 26 Oct 2026 → 25 Nov 2026.
// Set PAY_PERIOD_START_DAY to 1 for plain calendar months (max 28).
export const PAY_PERIOD_START_DAY = 26;

export const shiftMonth = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
// 'YYYY-MM' key of the pay period a date falls in.
export const monthKeyOf = (s) => {
  const key = s.slice(0, 7);
  return PAY_PERIOD_START_DAY > 1 && Number(s.slice(8, 10)) >= PAY_PERIOD_START_DAY ? shiftMonth(key, 1) : key;
};
export const periodStart = (key) =>
  PAY_PERIOD_START_DAY > 1 ? `${shiftMonth(key, -1)}-${pad(PAY_PERIOD_START_DAY)}` : `${key}-01`;
export const periodEnd = (key) => addDays(periodStart(shiftMonth(key, 1)), -1);
export const monthDates = (key) => dateRange(periodStart(key), periodEnd(key));
export const daysInMonth = (key) => monthDates(key).length;

const shortDate = (s) => `${Number(s.slice(8, 10))} ${MONTH_NAMES[Number(s.slice(5, 7)) - 1].slice(0, 3)}`;
export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};
// '26 Oct – 25 Nov 2026'
export const periodRangeLabel = (key) => `${shortDate(periodStart(key))} – ${shortDate(periodEnd(key))} ${periodEnd(key).slice(0, 4)}`;

export const timeToMin = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const minToTime = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

export const fmtHours = (min) => `${(min / 60).toFixed(1)} h`;
export const fmtDuration = (min) => `${Math.floor(min / 60)}h ${pad(min % 60)}m`;

export const fmtDate = (s) => {
  const d = parseDate(s);
  return `${pad(d.getDate())} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

export const CURRENCY = 'Rs';
export const fmtMoney = (n) =>
  `${CURRENCY} ${(Math.round(n * 100) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtMoney0 = (n) => `${CURRENCY} ${Math.round(n).toLocaleString('en-PK')}`;

export const fmtTimestamp = (d = new Date()) =>
  `${fmtDate(toDateStr(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

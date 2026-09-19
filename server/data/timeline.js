// Generic helpers for working with a scenario's real-history timeline.
// Each scenario provides its own array of events (see server/data/timelines/).
// An event is { date: 'YYYY-MM-DD', title, summary, nations, concepts, dse }.

// Events between two {year, month} dates (inclusive).
export function eventsBetween(timeline, from, to) {
  const list = Array.isArray(timeline) ? timeline : [];
  const a = from.year * 12 + (from.month - 1);
  const b = to.year * 12 + (to.month - 1);
  return list.filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    const k = y * 12 + (m - 1);
    return k >= a && k <= b;
  });
}

// The real events closest to a date (default: 2 months back, 4 ahead).
export function eventsNear(timeline, date, back = 2, ahead = 4) {
  const idx = date.year * 12 + (date.month - 1);
  const from = { year: Math.floor((idx - back) / 12), month: ((idx - back) % 12) + 1 };
  const to = { year: Math.floor((idx + ahead) / 12), month: ((idx + ahead) % 12) + 1 };
  return eventsBetween(timeline, from, to);
}

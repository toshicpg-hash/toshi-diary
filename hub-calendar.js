(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./hub-core.js'));
  else root.HubCalendar = factory(root.HubCore);
})(typeof globalThis === 'object' ? globalThis : this, function (C) {
  'use strict';

  // Pure projections of caller-supplied records. No clock, storage, network,
  // recurrence generation, record rewriting, or date-to-deadline inference.
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const day = value => typeof value === 'string' && C.day(value);
  const time = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const visible = row => record(row) && !row.cancelled && !row.linkedGoogleKey;

  function requireDay(date) {
    if (!day(date)) throw RangeError('A valid YYYY-MM-DD date is required');
  }

  function shifted(date, amount) {
    const result = C.addDays(date, amount);
    if (!day(result)) throw RangeError('Calendar date range is outside supported YYYY-MM-DD dates');
    return result;
  }

  function stableKey(row, index, kind) {
    if (typeof row._key === 'string' && row._key) return row._key;
    if (typeof row.stable_key === 'string' && row.stable_key) return row.stable_key;
    return kind === 'money' ? (row.safeId ? 'money:' + row.safeId : 'legacy-money:' + index) : C.key(row, index);
  }

  function calendarDays(anchor, view = 'month') {
    requireDay(anchor);
    if (!['month', 'week', 'day'].includes(view)) throw RangeError('Calendar view must be month, week or day');
    if (view === 'day') return [anchor];
    const first = view === 'month' ? anchor.slice(0, 8) + '01' : anchor;
    const start = shifted(first, -new Date(first + 'T00:00:00Z').getUTCDay());
    return Array.from({ length: view === 'month' ? 42 : 7 }, (_, index) => shifted(start, index));
  }

  // Navigation changes the view date only; it never edits caller records.
  function shiftPeriod(anchor, view, step) {
    requireDay(anchor);
    if (!['month', 'week', 'day'].includes(view) || ![-1, 1].includes(step)) throw RangeError('Invalid calendar navigation');
    if (view !== 'month') return shifted(anchor, step * (view === 'week' ? 7 : 1));
    const first = new Date(anchor.slice(0, 8) + '01T00:00:00Z');
    first.setUTCMonth(first.getUTCMonth() + step);
    const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + 1); next.setUTCDate(0);
    return shifted(first.toISOString().slice(0, 10), Math.min(Number(anchor.slice(-2)), next.getUTCDate()) - 1);
  }

  function coversDay(row, date) {
    if (!['event', 'todo', 'task'].includes(row.type)) return false;
    const deadline = C.deadline(row);
    const start = row.type === 'event' ? row.date : (C.workStart ? C.workStart(row) : row.scheduledDate || row.start || deadline);
    const end = row.type === 'event' ? row.endDate || start : deadline || start;
    return day(start) && day(end) && start <= end && C.span(row, date);
  }

  function amountValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
    const number = Number(value.trim());
    return Number.isFinite(number) ? number : null;
  }

  function amountLabel(value) {
    const amount = amountValue(value);
    return amount === null ? '金額要確認' : '¥' + amount.toLocaleString('ja-JP');
  }

  function itemTimeLabel(row) {
    if (row.type === 'todo' && day(C.deadline(row)) && time(row.deadlineTime)) return '期限 ' + row.deadlineTime;
    if (row.allDay) return '終日';
    if (time(row.time)) return row.time + (time(row.endTime) ? '〜' + row.endTime : '');
    return row.type === 'todo' ? 'ToDo' : row.type === 'task' ? 'タスク' : '時刻なし';
  }

  function sortTime(row) {
    if (row.entry_kind === 'item' && row.allDay) return ['00:00', 0];
    if (time(row.time)) return [row.time, 1];
    if (row.entry_kind === 'item' && row.type === 'todo' && day(C.deadline(row)) && time(row.deadlineTime)) return [row.deadlineTime, 1];
    return ['24:00', 2];
  }

  function entryOrder(a, b) {
    const A = sortTime(a), B = sortTime(b);
    return compare(A[0], B[0]) || A[1] - B[1] || compare(a.stable_key, b.stable_key) || compare(a.entry_kind, b.entry_kind);
  }

  /**
   * Every visible matching item and dated money row, including completed rows.
   * Source fields are preserved. Additions are stable_key, entry_kind,
   * calendar_date and time_label; money also adds amount_value, amount_label,
   * and direction_label. Unknown/blank amounts remain null, never zero.
   * Persisted _key values are preferred. Legacy fallbacks use the original
   * input index, matching HubCore's legacy identity contract.
   */
  function entries(items, money, date) {
    if (!Array.isArray(items) || !Array.isArray(money)) throw TypeError('Calendar entries require item and money arrays');
    requireDay(date);
    const result = [];
    items.forEach((row, index) => {
      if (!visible(row) || !coversDay(row, date)) return;
      result.push({ ...row, stable_key: stableKey(row, index, 'item'), entry_kind: 'item', calendar_date: date, time_label: itemTimeLabel(row) });
    });
    money.forEach((row, index) => {
      if (!visible(row) || !day(row.date) || row.date !== date) return;
      const value = amountValue(row.amount);
      result.push({
        ...row, stable_key: stableKey(row, index, 'money'), entry_kind: 'money', calendar_date: date,
        time_label: time(row.time) ? row.time : '時刻なし', amount_value: value,
        amount_label: amountLabel(value),
        direction_label: row.kind === 'income' ? '入金' : row.kind === 'payment' ? '支払' : '区分要確認'
      });
    });
    return result.sort(entryOrder);
  }

  /**
   * Original period tabs use deadlines, not scheduled dates. "week" preserves
   * the old inclusive today-through-today+7 interval (eight calendar dates).
   * "none" means no declared deadline; scheduled tasks still belong there.
   * Todo/task distinctions are retained. Today comes first, then nearest dates. Invalid nonempty
   * deadline strings stay visible under all, never disguised as "no deadline".
   */
  function workRows(items, filters = {}, today) {
    if (!Array.isArray(items)) throw TypeError('Work rows require an item array');
    if (!record(filters)) throw TypeError('Work filters must be an object');
    const { period = 'all', type = 'all', done = 'all' } = filters;
    if (!['all', 'today', 'week', 'none'].includes(period) || !['all', 'todo', 'task'].includes(type) || !['all', 'open', 'done'].includes(done)) {
      throw RangeError('Invalid work filter');
    }
    if (today !== undefined || period === 'today' || period === 'week') requireDay(today);
    const last = period === 'week' ? shifted(today, 7) : '';
    const rows = [];
    items.forEach((row, index) => {
      if (!visible(row) || !['todo', 'task'].includes(row.type) || (type !== 'all' && row.type !== type)) return;
      if ((done === 'open' && row.done) || (done === 'done' && !row.done)) return;
      const deadline = C.deadline(row);
      if (period === 'none' && deadline) return;
      if (period === 'today' && (!day(deadline) || deadline !== today)) return;
      if (period === 'week' && (!day(deadline) || deadline < today || deadline > last)) return;
      rows.push({ ...row, stable_key: stableKey(row, index, 'item') });
    });
    if (today !== undefined) {
      const base = Date.parse(today + 'T00:00:00Z');
      const indexed = rows.map((row, index) => {
        const deadline = C.deadline(row);
        const start = C.workStart(row);
        const date = day(deadline) ? deadline : !deadline && day(start) ? start : '';
        const offset = date ? Date.parse(date + 'T00:00:00Z') - base : Infinity;
        return { row, index, offset, distance: Math.abs(offset) };
      });
      indexed.sort((a, b) => a.distance - b.distance || (a.offset >= 0 ? 0 : 1) - (b.offset >= 0 ? 0 : 1) || a.index - b.index);
      return indexed.map(x => x.row);
    }
    return rows;
  }

  return { calendarDays, shiftPeriod, entries, workRows, amountValue, amountLabel };
});

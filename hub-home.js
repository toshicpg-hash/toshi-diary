(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./hub-core.js'));
  else root.HubHome = factory(root.HubCore);
})(typeof globalThis === 'object' ? globalThis : this, function (C) {
  'use strict';

  // This module only projects supplied records. It never reads the clock or app state.
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isDay = value => typeof value === 'string' && C.day(value);
  const isTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

  function amountValue(value) {
    // Blank, missing, boolean, formatted or otherwise ambiguous values need review.
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
    const number = Number(value.trim());
    return Number.isFinite(number) ? number : null;
  }

  function coversDay(item, date) {
    if (!['event', 'todo', 'task'].includes(item.type)) return false;
    // HubCore.deadline respects an explicit ToDo deadline or a legacy local end.
    // A scheduled date is never converted into a deadline, including for Google.
    const deadline = C.deadline(item);
    const start = item.type === 'event' ? item.date : item.scheduledDate || item.start || deadline;
    const end = item.type === 'event' ? item.endDate || start : deadline || start;
    return isDay(start) && isDay(end) && start <= end && C.span(item, date);
  }

  function timelineTime(item) {
    if (item.allDay) return '00:00';
    if (isTime(item.time)) return item.time;
    return isTime(item.deadlineTime) ? item.deadlineTime : '23:59';
  }

  function cashOrder(a, b) {
    return compare(a.date, b.date) || compare(isTime(a.time) ? a.time : '', isTime(b.time) ? b.time : '');
  }

  function cashSection(rows) {
    let income = 0, payment = 0, invalidIncome = false, invalidPayment = false;
    let invalidAmountCount = 0, invalidKindCount = 0;
    for (const row of rows) {
      if (row.amountValue === null) invalidAmountCount += 1;
      if (row.kind === 'income') {
        if (row.amountValue === null) invalidIncome = true;
        else income += row.amountValue;
      } else if (row.kind === 'payment') {
        if (row.amountValue === null) invalidPayment = true;
        else payment += row.amountValue;
      } else invalidKindCount += 1;
    }
    const sumOverflow = !Number.isFinite(income) || !Number.isFinite(payment) || !Number.isFinite(income - payment);
    income = invalidIncome || invalidKindCount || !Number.isFinite(income) ? null : income;
    payment = invalidPayment || invalidKindCount || !Number.isFinite(payment) ? null : payment;
    const net = income === null || payment === null || !Number.isFinite(income - payment) ? null : income - payment;
    return {
      rows, income, payment, net, invalidAmountCount, invalidKindCount, sumOverflow,
      needsConfirmation: invalidAmountCount > 0 || invalidKindCount > 0 || sumOverflow
    };
  }

  /**
   * Read-only home projection of the existing merged item and money arrays.
   * Dates use the caller's explicit local day; the ten-day window includes today.
   * Cash totals are null when their contributing data is untrustworthy. A real
   * zero remains 0. Original row fields are preserved; cash rows add amountValue.
   */
  function project(items, money, today) {
    if (!C || typeof C.span !== 'function' || typeof C.deadline !== 'function') throw Error('HubCore is required');
    if (!Array.isArray(items) || !Array.isArray(money)) throw TypeError('Home projection requires item and money arrays');
    if (!isDay(today)) throw RangeError('Home projection requires an explicit valid YYYY-MM-DD today');
    const endDate = C.addDays(today, 9);
    if (!isDay(endDate)) throw RangeError('Home projection date range is not supported');
    const month = today.slice(0, 7);
    const visibleItems = items.filter(item => isRecord(item) && !item.cancelled && !item.linkedGoogleKey);
    const todayRows = visibleItems.filter(item => coversDay(item, today))
      .map(item => ({ ...item }))
      .sort((a, b) => compare(timelineTime(a), timelineTime(b)));
    const outstanding = money.filter(row => isRecord(row) && !row.done && !row.cancelled)
      .map(row => ({ ...row, amountValue: amountValue(row.amount) }));
    const dated = outstanding.filter(row => isDay(row.date)).sort(cashOrder);
    const nextDate = dated.find(row => row.date > endDate)?.date || '';
    return {
      today, month, todayRows, todayCount: todayRows.length,
      incompleteWorkCount: visibleItems.filter(item => ['todo', 'task'].includes(item.type) && !item.done).length,
      monthCash: cashSection(dated.filter(row => row.date.slice(0, 7) === month)),
      cashAhead: { ...cashSection(dated.filter(row => row.date >= today && row.date <= endDate)), startDate: today, endDate },
      nextCash: { ...cashSection(nextDate ? dated.filter(row => row.date === nextDate) : []), date: nextDate },
      invalidAmountCount: outstanding.filter(row => row.amountValue === null).length,
      invalidDateCount: outstanding.filter(row => !isDay(row.date)).length,
      invalidKindCount: outstanding.filter(row => !['income', 'payment'].includes(row.kind)).length
    };
  }

  return { project };
});

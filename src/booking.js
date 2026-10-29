// Mock of the appointment booking system's READ-ONLY availability API.
// The MVP never writes to the booking system: it shows the earliest slot that
// meets the policy deadline and the coordinator books it in the real system.
// Swap getAvailability() for the client's API client in week 2 of the build.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HPBooking = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }

  // GET /availability?trade=&from=&to=  -> [{start, end, operative}]
  function getAvailability(trade, fromIso, toIso) {
    const slots = [];
    const from = new Date(fromIso); const to = new Date(toIso);
    const day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    for (let d = 0; d < 120 && day <= to; d++, day.setUTCDate(day.getUTCDate() + 1)) {
      const wd = day.getUTCDay(); if (wd === 0 || wd === 6) continue;
      for (const [h, label] of [[8, 'AM'], [12, 'PM']]) {
        const key = trade + day.toISOString().slice(0, 10) + label;
        if (hash(key) % 100 < 72) continue; // most slots already booked
        const start = new Date(day.getTime() + h * 3600e3);
        if (start < from || start > to) continue;
        slots.push({ start: start.toISOString(), end: new Date(start.getTime() + 4 * 3600e3).toISOString(), operative: trade + ' team ' + 'ABC'[hash(key) % 3] });
      }
    }
    return slots;
  }

  function suggestSlot(trade, priority, receivedAt, deadlineIso) {
    if (priority === 'P1') return { kind: 'emergency_rota', text: 'Emergency rota: phone the on-call ' + trade + ' operative' };
    const slots = getAvailability(trade, receivedAt, deadlineIso);
    if (!slots.length) return { kind: 'at_risk', text: 'No ' + trade + ' slot before the policy deadline. Escalate to the repairs manager.' };
    return { kind: 'slot', slot: slots[0], text: slots[0].operative };
  }

  return { getAvailability, suggestSlot };
});

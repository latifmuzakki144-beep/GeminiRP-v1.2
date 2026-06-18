/**
 * SillyTavern-compatible RossAscends-mods shim.
 * Imported by ST extensions for date / mobile / shortcut helpers.
 */

const _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Returns a date string like "Jun 18, 2026 3:42pm". */
export function humanizedDateTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  if (isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12; if (h === 0) h = 12;
  return `${_months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${m}${ampm}`;
}

export function humanizedISO8601DateTime() {
  return new Date().toISOString();
}

export function getMessageTimeStamp() { return Date.now(); }

export function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function shouldSendOnEnter() {
  // Default to true on desktop, false on mobile
  return !isMobile();
}

export function favsToHotswap() { /* no-op */ }

export function dragElement() { /* no-op */ }

export function fixViewport() { /* no-op */ }

export default {
  humanizedDateTime, humanizedISO8601DateTime, getMessageTimeStamp,
  isMobile, shouldSendOnEnter, favsToHotswap, dragElement, fixViewport,
};

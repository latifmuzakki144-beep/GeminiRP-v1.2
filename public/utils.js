/**
 * SillyTavern-compatible utility shim.
 * Imported by extensions as: `import { saveBase64AsFile, ... } from "../../../utils.js"`
 */

// ---------------------------------------------------------------------------
// Base64 / file helpers
// ---------------------------------------------------------------------------

/**
 * "Save" a base64 string. Because GeminiRP is a frontend app with no
 * persistent filesystem available to the browser, we instead create a
 * data URL and stash it in IndexedDB-backed localforage if available,
 * otherwise localStorage.
 *
 * Returns the resolvable URL to the resource (data: URL).
 */
export async function saveBase64AsFile(base64Data, characterName, ttl, mimeType = 'image/png') {
  const dataUrl = base64Data.startsWith('data:')
    ? base64Data
    : `data:${mimeType};base64,${base64Data}`;
  try {
    const key = `gemrp_b64_${characterName || 'anon'}_${ttl || Date.now()}`;
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(key, dataUrl); } catch (_) { /* quota */ }
    }
  } catch (_) {}
  return dataUrl;
}

/** Convert a base64 string to a Blob URL — usable in <img src=...> directly. */
export function base64ToBlobUrl(base64, mimeType = 'image/png') {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '');
  const bin = atob(cleaned);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export function getBase64Async(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function getFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Time / format helpers
// ---------------------------------------------------------------------------
export function timestampToMoment(ts) {
  if (!ts) return new Date();
  const n = Number(ts);
  return isNaN(n) ? new Date(ts) : new Date(n);
}

export function getStringHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export function uuidv4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// DOM / debouncing utilities
// ---------------------------------------------------------------------------
export function debounce(fn, wait = 200) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function throttle(fn, wait = 200) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) { last = now; return fn.apply(this, args); }
  };
}

export function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

export function isOdd(n) { return Math.abs(n) % 2 === 1; }
export function isEven(n) { return Math.abs(n) % 2 === 0; }

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function getSortableDelay() { return 50; }

export function onlyUnique(value, index, self) { return self.indexOf(value) === index; }

export function trimToEndSentence(text) {
  if (!text) return '';
  const lastPunct = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
  return lastPunct > -1 ? text.slice(0, lastPunct + 1) : text;
}

export function trimToStartSentence(text) {
  if (!text) return '';
  const m = text.match(/[.!?]\s+(\S)/);
  return m ? text.slice(text.indexOf(m[1])) : text;
}

export function isValidUrl(s) {
  try { new URL(s); return true; } catch (_) { return false; }
}

export function download(content, fileName, contentType = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Misc ST utils
// ---------------------------------------------------------------------------
export function getCharaFilename() { return null; }
export function parseJsonFile(file) { return getFileText(file).then(JSON.parse); }
export async function urlContentToDataUri(url) {
  const r = await fetch(url);
  const b = await r.blob();
  return await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(b);
  });
}

export default {
  saveBase64AsFile, base64ToBlobUrl, getBase64Async, getFileText,
  timestampToMoment, getStringHash, uuidv4,
  debounce, throttle, delay, isOdd, isEven,
  escapeHtml, getSortableDelay, onlyUnique,
  trimToEndSentence, trimToStartSentence, isValidUrl, download,
  getCharaFilename, parseJsonFile, urlContentToDataUri,
};

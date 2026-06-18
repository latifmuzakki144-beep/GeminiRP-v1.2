/**
 * SillyTavern-compatible shim — `extensions.js`.
 * Imported by third-party ST extensions as:
 *     import { extension_settings, getContext, ... } from "../../../extensions.js"
 */

// Live, mutable settings store. Persisted on every `saveSettingsDebounced` call.
function _loadStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem('st_extension_settings') || '{}');
  } catch (_) { return {}; }
}

if (!window.extension_settings) window.extension_settings = _loadStoredSettings();
export const extension_settings = window.extension_settings;

/**
 * Returns the full GeminiRP-provided context, which is shaped to match
 * SillyTavern's getContext() return value as closely as possible.
 */
export function getContext() {
  if (window.MyApp && typeof window.MyApp.getContext === 'function') {
    return window.MyApp.getContext();
  }
  // Safe minimal fallback so callers never crash.
  return {
    chat: [],
    characters: [],
    groups: [],
    characterId: undefined,
    groupId: undefined,
    chatId: undefined,
    name1: 'User',
    name2: 'Character',
    eventSource: { on: () => {}, off: () => {}, once: () => {}, emit: async (_e, d) => d },
    event_types: new Proxy({}, { get: (_t, p) => String(p) }),
    extensionSettings: extension_settings,
    chatMetadata: {},
    extensionPrompts: {},
    setExtensionPrompt: () => {},
    saveSettingsDebounced: () => {},
    callLLM: async () => '',
    POPUP_TYPE: { TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 },
    POPUP_RESULT: { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null },
  };
}

// ---------------------------------------------------------------------------
// Registry of installed extensions (lazily synced with /api/extensions/list)
// ---------------------------------------------------------------------------
export let extensionNames = [];
export let extensionTypes = {};
export let modules = [];

async function _syncExtensionRegistry() {
  try {
    const res = await fetch('/api/extensions/list');
    if (!res.ok) return;
    const data = await res.json();
    extensionNames = data.map((d) => d.name);
    extensionTypes = Object.fromEntries(data.map((d) => [d.name, 'third-party']));
  } catch (_) { /* ignore */ }
}
_syncExtensionRegistry();

export const isOfficialExtension = (_url) => false;

// Constants used by ST extension menus
export const UNSET_VALUE = '__@@UNSET@@__';

// ---------------------------------------------------------------------------
// Metadata helpers
// ---------------------------------------------------------------------------
export function cancelDebouncedMetadataSave() {}
export function saveMetadataDebounced() {}

// ---------------------------------------------------------------------------
// Template renderer — many ST extensions ship .html template files and use
// these helpers. We fetch the template synchronously over HTTP and run a
// minimal {{key}} substitution.
// ---------------------------------------------------------------------------
function _renderTemplateString(html, data, _sanitize, _localize) {
  if (!data) return html;
  let out = String(html);
  for (const k of Object.keys(data)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
    out = out.replace(re, String(data[k] ?? ''));
  }
  return out;
}

export function renderExtensionTemplate(extensionName, templateId, templateData = {}, sanitize = true, localize = true) {
  // Synchronous XHR — best effort, matches ST's legacy signature.
  try {
    const url = `/scripts/extensions/third-party/${extensionName}/${templateId}.html`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      return _renderTemplateString(xhr.responseText, templateData, sanitize, localize);
    }
  } catch (_) {}
  return '';
}

export async function renderExtensionTemplateAsync(extensionName, templateId, templateData = {}, sanitize = true, localize = true) {
  try {
    const url = `/scripts/extensions/third-party/${extensionName}/${templateId}.html`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const html = await res.text();
    return _renderTemplateString(html, templateData, sanitize, localize);
  } catch (_) { return ''; }
}

// ---------------------------------------------------------------------------
// "Extras" backend (image gen / TTS / etc). GeminiRP has no Extras server,
// so this is a hard "disconnected" stub that won't throw.
// ---------------------------------------------------------------------------
export async function doExtrasFetch(endpoint, args = {}) {
  console.warn(`[extensions.js] doExtrasFetch called for ${endpoint} — Extras server not configured in GeminiRP.`);
  return new Response(JSON.stringify({ error: 'extras_unavailable' }), { status: 503 });
}

// ---------------------------------------------------------------------------
// Enable / disable / install / delete proxies — backed by the existing
// GeminiRP REST API in server.ts.
// ---------------------------------------------------------------------------
export async function enableExtension(name, _reload = true) {
  const states = JSON.parse(localStorage.getItem('grh_enabled_extensions') || '{}');
  states[name] = true;
  localStorage.setItem('grh_enabled_extensions', JSON.stringify(states));
  return { name, enabled: true };
}

export async function disableExtension(name, _reload = true) {
  const states = JSON.parse(localStorage.getItem('grh_enabled_extensions') || '{}');
  states[name] = false;
  localStorage.setItem('grh_enabled_extensions', JSON.stringify(states));
  return { name, enabled: false };
}

export function findExtension(name) {
  return modules.find((m) => m.name === name) ?? null;
}

export function getExtensionManifest(name) {
  // Best-effort — sync read of the cached registry.
  return null;
}

export async function deleteExtension(extensionName, _shouldClean = false) {
  const res = await fetch(`/api/extensions/delete/${encodeURIComponent(extensionName)}`, { method: 'DELETE' });
  await _syncExtensionRegistry();
  return res.ok;
}

export async function installExtension(url, _global = false, branch = 'main') {
  const res = await fetch('/api/extensions/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl: url, branch }),
  });
  await _syncExtensionRegistry();
  return await res.json();
}

export async function loadExtensionSettings(settings) {
  if (settings && typeof settings === 'object') {
    Object.assign(extension_settings, settings);
  }
  return extension_settings;
}

export function doDailyExtensionUpdatesCheck() {}

// ---------------------------------------------------------------------------
// Generation interceptors — let extensions mutate the outgoing chat array.
// ---------------------------------------------------------------------------
const _interceptors = [];
export function registerGenerationInterceptor(fn) { _interceptors.push(fn); }
export async function runGenerationInterceptors(chat, contextSize, type) {
  for (const fn of _interceptors) {
    try { await fn(chat, contextSize, type); } catch (e) { console.error('[interceptor]', e); }
  }
  return chat;
}

// ---------------------------------------------------------------------------
// Per-character field writers — backed by chat.character on the live context.
// ---------------------------------------------------------------------------
export async function writeExtensionField(_characterId, key, value) {
  const c = getContext();
  if (c?.chat?.character) {
    if (!c.chat.character.data) c.chat.character.data = {};
    if (!c.chat.character.data.extensions) c.chat.character.data.extensions = {};
    c.chat.character.data.extensions[key] = value;
  }
  return true;
}

export async function writeExtensionFieldBulk(_avatars, key, value, _opts = {}) {
  return writeExtensionField(null, key, value);
}

export async function openThirdPartyExtensionMenu(_suggestUrl = '') {
  // GeminiRP exposes the Extensions modal via the UI. Best-effort hint.
  const evt = new CustomEvent('gemrp:open-extensions-modal');
  window.dispatchEvent(evt);
}

export const EMPTY_AUTHOR = Object.freeze({ name: 'Unknown', url: '' });
export function getAuthorFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return { name: parts[0] || 'Unknown', url: `${u.origin}/${parts[0] || ''}` };
  } catch (_) { return EMPTY_AUTHOR; }
}

export async function initExtensions() {
  // GeminiRP boots extensions itself via utils/extensionLoader.ts.
  // This function exists only so ST extensions that call it don't throw.
  return [];
}

/**
 * ModuleWorkerWrapper — ST utility used by extensions for polling loops.
 * Minimal compatible re-implementation.
 */
export class ModuleWorkerWrapper {
  constructor(callback) {
    this.callback = callback;
    this.handle = null;
  }
  update() {
    try { return this.callback?.(); } catch (e) { console.error(e); }
  }
  start(intervalMs = 1000) {
    this.stop();
    this.handle = setInterval(() => this.update(), intervalMs);
  }
  stop() {
    if (this.handle) { clearInterval(this.handle); this.handle = null; }
  }
}

const _all = {
  extension_settings, getContext, extensionNames, extensionTypes, modules,
  isOfficialExtension, UNSET_VALUE, renderExtensionTemplate, renderExtensionTemplateAsync,
  doExtrasFetch, enableExtension, disableExtension, findExtension,
  getExtensionManifest, deleteExtension, installExtension, loadExtensionSettings,
  doDailyExtensionUpdatesCheck, runGenerationInterceptors, registerGenerationInterceptor,
  writeExtensionField, writeExtensionFieldBulk, openThirdPartyExtensionMenu,
  EMPTY_AUTHOR, getAuthorFromUrl, initExtensions, ModuleWorkerWrapper,
  saveMetadataDebounced, cancelDebouncedMetadataSave,
};
export default _all;

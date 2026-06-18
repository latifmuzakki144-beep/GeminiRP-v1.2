/**
 * SillyTavern-compatible shim for GeminiRP.
 *
 * This file is loaded by third-party ST extensions via:
 *     import { ... } from "../../../../script.js"
 *
 * Every export below either delegates to GeminiRP's internal MyApp bridge
 * (so it actually does something) or, if the matching feature does not exist
 * in GeminiRP, returns a safe fallback that won't crash callers.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function _ctx() {
  if (window.MyApp && typeof window.MyApp.getContext === 'function') {
    try { return window.MyApp.getContext(); } catch (_) { return null; }
  }
  return null;
}

function _ensureToastr() {
  if (!window.toastr) {
    window.toastr = {
      success: (m) => console.log('%c[success] ' + m, 'color: #10b981'),
      error:   (m) => console.log('%c[error] '   + m, 'color: #ef4444'),
      info:    (m) => console.log('%c[info] '    + m, 'color: #3b82f6'),
      warning: (m) => console.log('%c[warning] ' + m, 'color: #f59e0b'),
    };
  }
}
_ensureToastr();

// ---------------------------------------------------------------------------
// EventSource & event_types — proxied to GeminiRP's globalEventBus
// ---------------------------------------------------------------------------
const _bus = () => _ctx()?.eventSource ?? null;

export const eventSource = {
  on:   (ev, cb) => _bus()?.on(ev, cb),
  once: (ev, cb) => _bus()?.once?.(ev, cb),
  off:  (ev, cb) => _bus()?.off(ev, cb),
  removeListener: (ev, cb) => _bus()?.off(ev, cb),
  emit: async (ev, data, ...rest) => _bus() ? await _bus().emit(ev, data, ...rest) : data,
  emitAndWait: async (ev, data, ...rest) => _bus() ? await _bus().emitAndWait(ev, data, ...rest) : data,
  listenerCount: (ev) => _bus()?.listenerCount?.(ev) ?? 0,
  removeAllListeners: (ev) => _bus()?.removeAllListeners?.(ev),
};

export const event_types = new Proxy({}, {
  get(_t, prop) {
    const c = _ctx();
    if (c?.event_types && prop in c.event_types) return c.event_types[prop];
    // Fallback: return the property name itself so emit() still works
    return String(prop);
  },
  ownKeys() {
    const c = _ctx();
    return c?.event_types ? Reflect.ownKeys(c.event_types) : [];
  },
  getOwnPropertyDescriptor(_t, prop) {
    const c = _ctx();
    if (c?.event_types && prop in c.event_types) {
      return { configurable: true, enumerable: true, value: c.event_types[prop] };
    }
    return undefined;
  },
});

// ---------------------------------------------------------------------------
// Live state proxies — every read reflects the current GeminiRP state.
// ST extensions often do `import { chat, characters } from script.js` once
// and expect those bindings to stay live. We expose them as proxies that
// re-read MyApp on each access.
// ---------------------------------------------------------------------------
function _liveArrayProxy(getArr) {
  return new Proxy([], {
    get(_t, prop) {
      const a = getArr() ?? [];
      if (prop === 'length') return a.length;
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return a[Number(prop)];
      const v = a[prop];
      return typeof v === 'function' ? v.bind(a) : v;
    },
    set(_t, prop, value) {
      const a = getArr();
      if (a) a[prop] = value;
      return true;
    },
    has(_t, prop) { return prop in (getArr() ?? []); },
    ownKeys()      { return Reflect.ownKeys(getArr() ?? []); },
    getOwnPropertyDescriptor(_t, prop) {
      const a = getArr() ?? [];
      return Object.getOwnPropertyDescriptor(a, prop);
    },
  });
}

export const chat       = _liveArrayProxy(() => _ctx()?.chat);
export const characters = _liveArrayProxy(() => _ctx()?.characters);
export const groups     = _liveArrayProxy(() => _ctx()?.groups);

// Single-value live getters via accessor properties
Object.defineProperty(globalThis, '__gemrp_script_dynamics__', { value: true, configurable: true });

export function this_chid() { return _ctx()?.characterId; }
export function selected_group() { return _ctx()?.groupId; }
export function name1() { return _ctx()?.name1 ?? _ctx()?.settings?.userName ?? 'User'; }
export function name2() { return _ctx()?.name2 ?? _ctx()?.chat?.character?.name ?? 'Character'; }

// ---------------------------------------------------------------------------
// Settings I/O
// ---------------------------------------------------------------------------
export const saveSettingsDebounced =
  (typeof window !== 'undefined' && window.saveSettingsDebounced) ||
  (() => {
    try {
      localStorage.setItem(
        'st_extension_settings',
        JSON.stringify(window.extension_settings || {})
      );
    } catch (e) { console.warn('saveSettingsDebounced failed', e); }
  });

export const saveSettings = saveSettingsDebounced;

// ---------------------------------------------------------------------------
// Generation primitives — actually call the Gemini bridge.
// ---------------------------------------------------------------------------
/**
 * Issue a "quiet" generation that does NOT add a message to the chat.
 * @param {string} quietPrompt
 * @param {string} [quietImage]   (ignored — GeminiRP path)
 * @param {boolean} [quietToLoud]
 * @param {string} [systemPromptOverride]
 */
export async function generateQuietPrompt(quietPrompt, quietImage, quietToLoud, systemPromptOverride) {
  const c = _ctx();
  if (!c || typeof c.callLLM !== 'function') {
    console.warn('[script.js] generateQuietPrompt: callLLM unavailable');
    return '';
  }
  try {
    return await c.callLLM(
      String(quietPrompt ?? ''),
      systemPromptOverride || 'You are an assistant performing a silent helper generation.'
    );
  } catch (err) {
    console.error('[script.js] generateQuietPrompt error:', err);
    return '';
  }
}

/** Raw generation — same as quiet for our purposes. */
export async function generateRaw(prompt, _api, _instructOverride, _quietToLoud, systemPrompt) {
  return await generateQuietPrompt(prompt, undefined, false, systemPrompt);
}

export async function generateRawData(prompt, opts = {}) {
  const text = await generateRaw(prompt, undefined, undefined, undefined, opts.systemPrompt);
  return { text };
}

export async function Generate(_type, _opts) {
  // GeminiRP drives generation from ChatPage. Sending a programmatic Generate()
  // request is mapped to the chat.sendMessage hook on the current context.
  const c = _ctx();
  if (c?.chat?.sendMessage) {
    try { await c.chat.sendMessage(''); } catch (e) { console.warn(e); }
  }
}

// ---------------------------------------------------------------------------
// Macro substitution — {{user}}, {{char}}, {{random:a,b}}, {{roll:1d6}}, etc.
// ---------------------------------------------------------------------------
function _randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function _rollDice(spec) {
  // Format: NdM  (e.g. 2d6)
  const m = String(spec).match(/^(\d+)d(\d+)$/i);
  if (!m) return spec;
  const n = Math.min(100, parseInt(m[1], 10));
  const sides = Math.min(1000, parseInt(m[2], 10));
  let total = 0;
  for (let i = 0; i < n; i++) total += 1 + Math.floor(Math.random() * sides);
  return String(total);
}

export function substituteParams(text, _name1, _name2, _originalText, _group) {
  if (text == null) return '';
  let out = String(text);
  const c = _ctx();
  const userName = _name1 ?? c?.settings?.userName ?? c?.name1 ?? 'User';
  const charName = _name2 ?? c?.chat?.character?.name ?? c?.name2 ?? 'Character';

  out = out.replace(/\{\{user\}\}/gi, userName);
  out = out.replace(/\{\{char\}\}/gi, charName);
  out = out.replace(/\{\{name1\}\}/gi, userName);
  out = out.replace(/\{\{name2\}\}/gi, charName);
  out = out.replace(/\{\{newline\}\}/gi, '\n');
  out = out.replace(/\{\{trim\}\}/gi, '');
  out = out.replace(/\{\{noop\}\}/gi, '');
  out = out.replace(/\{\{random\s*:\s*([^}]+)\}\}/gi, (_m, list) =>
    _randomChoice(list.split(',').map(s => s.trim()))
  );
  out = out.replace(/\{\{pick\s*:\s*([^}]+)\}\}/gi, (_m, list) =>
    _randomChoice(list.split(',').map(s => s.trim()))
  );
  out = out.replace(/\{\{roll\s*:\s*([^}]+)\}\}/gi, (_m, spec) => _rollDice(spec.trim()));
  out = out.replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString());
  out = out.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString());
  out = out.replace(/\{\{datetimeformat[^}]*\}\}/gi, new Date().toISOString());
  out = out.replace(/\{\{idle_duration\}\}/gi, '0s');
  return out;
}

export function substituteParamsExtended(text, env = {}) {
  let out = substituteParams(text, env.name1, env.name2);
  // Custom keys from env
  for (const k of Object.keys(env)) {
    if (k === 'name1' || k === 'name2') continue;
    const re = new RegExp(`\\{\\{${k}\\}\\}`, 'gi');
    out = out.replace(re, String(env[k] ?? ''));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chat I/O — proxy to GeminiRP's React state.
// ---------------------------------------------------------------------------
export async function saveChat() {
  // GeminiRP persists chat through localStorage/Firestore automatically.
  // Trigger a settings save so any pending extension data is persisted too.
  try { saveSettingsDebounced(); } catch (_) {}
  return true;
}

export async function saveChatConditional() { return saveChat(); }
export async function saveChatDebounced()   { return saveChat(); }

export async function reloadCurrentChat() {
  // Best effort — re-emit CHAT_CHANGED so listeners refresh.
  const c = _ctx();
  if (c?.eventSource && c?.event_types) {
    try {
      await c.eventSource.emit(c.event_types.CHAT_CHANGED, c.chatId);
    } catch (_) {}
  }
  return true;
}

export function addOneMessage(messageObj, opts = {}) {
  const c = _ctx();
  if (!c?.chat) return;
  const arr = c.chat;
  // Build a minimal ST-style mes entry
  const mes = {
    name: messageObj?.name || (messageObj?.is_user ? c.name1 : c.name2) || 'Unknown',
    is_user: !!messageObj?.is_user,
    is_system: !!messageObj?.is_system,
    send_date: messageObj?.send_date || new Date().toISOString(),
    mes: String(messageObj?.mes ?? messageObj?.content ?? ''),
    extra: messageObj?.extra || {},
    ...messageObj,
  };
  arr.push?.(mes);
  // If GeminiRP gave us setMessages, propagate back to React.
  try {
    if (typeof arr.setMessages === 'function' && Array.isArray(arr.messages)) {
      const next = [
        ...arr.messages,
        {
          id: crypto.randomUUID?.() ?? String(Date.now()),
          role: mes.is_user ? 'user' : 'model',
          content: mes.mes,
          timestamp: Date.now(),
        },
      ];
      arr.setMessages(next);
    }
  } catch (e) { console.warn('addOneMessage propagation failed', e); }

  if (!opts.silent) {
    try {
      c.eventSource?.emit(
        mes.is_user ? c.event_types.USER_MESSAGE_RENDERED : c.event_types.CHARACTER_MESSAGE_RENDERED,
        arr.length - 1
      );
    } catch (_) {}
  }
  return mes;
}

export function deleteLastMessage() {
  const c = _ctx();
  const arr = c?.chat;
  if (!arr) return;
  const popped = arr.pop?.();
  try {
    if (typeof arr.setMessages === 'function' && Array.isArray(arr.messages)) {
      arr.setMessages(arr.messages.slice(0, -1));
    }
  } catch (_) {}
  return popped;
}

export function deleteMessage(index) {
  const c = _ctx();
  const arr = c?.chat;
  if (!arr || typeof index !== 'number') return;
  arr.splice?.(index, 1);
  try {
    if (typeof arr.setMessages === 'function' && Array.isArray(arr.messages)) {
      const next = arr.messages.slice();
      next.splice(index, 1);
      arr.setMessages(next);
    }
  } catch (_) {}
}

export function updateMessageBlock(_index, _mes) { /* DOM re-render handled by React */ }
export function printMessages()                  { /* no-op — React handles render */ }
export function clearChat()                      {
  const c = _ctx();
  const arr = c?.chat;
  if (!arr) return;
  arr.length = 0;
  try { arr.setMessages?.([]); } catch (_) {}
}

export function appendMediaToMessage(message, mesBlock, _appendToTop) {
  // GeminiRP has no DOM mes-block. Stash media on the message extras instead.
  if (!message) return;
  if (!message.extra) message.extra = {};
  if (mesBlock && mesBlock.src) message.extra.image = mesBlock.src;
  if (mesBlock && mesBlock.type === 'audio') message.extra.audio = mesBlock.src;
}

export function showSwipeButtons() {}
export function hideSwipeButtons() {}
export function refreshSwipeButtons() {}
export function swipe() {}
export function swipe_left() {}
export function swipe_right() {}
export function isSwipingAllowed() { return false; }
export const swipeState = {};

export function scrollChatToBottom() {
  const zone = document.querySelector('[data-chat-scroll], #chat-extension-zone');
  if (zone && zone.parentElement) {
    zone.parentElement.scrollTop = zone.parentElement.scrollHeight;
  }
  // Best effort
  const lastBubble = document.querySelector('.chat-bubble:last-child');
  if (lastBubble?.scrollIntoView) lastBubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
}
export function scrollOnMediaLoad() { scrollChatToBottom(); }

// ---------------------------------------------------------------------------
// HTTP / request helpers
// ---------------------------------------------------------------------------
export function getRequestHeaders() {
  // GeminiRP does not require ST CSRF token; return common JSON header.
  return {
    'Content-Type': 'application/json',
    'X-Requested-With': 'GeminiRP-Extension',
  };
}

export function getCurrentChatId() {
  return _ctx()?.chatId ?? _ctx()?.chat?.character?.id ?? null;
}

// ---------------------------------------------------------------------------
// Extension prompt injection (used heavily by ST ext to add system text)
// ---------------------------------------------------------------------------
const _extensionPrompts = {};
window.__gemrp_extension_prompts__ = _extensionPrompts;

export const extension_prompts = _extensionPrompts;

export function setExtensionPrompt(key, value, position = 0, depth = 4, scan = false, role = 0) {
  if (!key) return;
  if (!value) { delete _extensionPrompts[key]; return; }
  _extensionPrompts[key] = { value: String(value), position, depth, scan, role };
}

// ---------------------------------------------------------------------------
// Misc helpers / placeholders ST extensions sometimes import
// ---------------------------------------------------------------------------
export function activateSendButtons() {}
export function deactivateSendButtons() {}
export function stopGeneration() {}
export function sendGenerationRequest() { return Promise.resolve(''); }
export function sendStreamingRequest() { return Promise.resolve(''); }
export function sendSystemMessage(_type, text) {
  return addOneMessage({ is_system: true, name: 'System', mes: text });
}
export function saveReply(_type, getMessage) { return getMessage; }
export function getThumbnailUrl(_type, file) { return file || ''; }
export function selectCharacterById(_id) {}
export function openCharacterChat(_chatName) {}
export function renameChat() {}
export function saveMetadata() {}
export function updateChatMetadata(meta, _reset) {
  const c = _ctx();
  if (c && meta && typeof meta === 'object') Object.assign(c.chatMetadata ?? {}, meta);
}
export function extractMessageFromData(data) { return data?.choices?.[0]?.message?.content ?? data?.content ?? ''; }
export function messageFormatting(text) { return String(text ?? ''); }
export function ensureMessageMediaIsArray(_m) {}
export function getMediaDisplay() { return ''; }
export function getMediaIndex() { return -1; }
export function getCharacters() {
  const c = _ctx();
  return c?.characters ?? [];
}
export function getOneCharacter(id) {
  const c = _ctx();
  return c?.characters?.[id] ?? null;
}
export function getCharacterCardFields() {
  const c = _ctx();
  const char = c?.chat?.character;
  return char ? {
    description: char.description,
    personality: char.personality,
    scenario: char.scenario,
    first_mes: char.firstMessage,
    name: char.name,
  } : {};
}
export function getCharacterSource() { return 'gemini-rp-local'; }
export function unshallowCharacter(c) { return c; }
export function callPopup(text, type) {
  return window.toastr?.info ? window.toastr.info(String(text)) : alert(String(text));
}

// API const map (used for connection profile UIs)
export const CONNECT_API_MAP = {
  openai: { selected: 'openai' },
  google: { selected: 'google' },
};

// Status fields
export const online_status = 'GeminiRP';
export const main_api = 'openai';
export const max_context = 200000;
export const menu_type = '';
export const extension_prompt_types = {
  IN_PROMPT: 0,
  IN_CHAT: 1,
  AFTER_PROMPT: 2,
};
export const create_save = {};
export const chat_metadata = {};

// ---------------------------------------------------------------------------
// Default export — some extensions do `import st from "../../../../script.js"`
// ---------------------------------------------------------------------------
const _all = {
  eventSource, event_types,
  saveSettingsDebounced, saveSettings,
  generateQuietPrompt, generateRaw, generateRawData, Generate,
  substituteParams, substituteParamsExtended,
  saveChat, saveChatConditional, saveChatDebounced, reloadCurrentChat,
  addOneMessage, deleteLastMessage, deleteMessage, updateMessageBlock,
  printMessages, clearChat, appendMediaToMessage,
  getRequestHeaders, getCurrentChatId,
  setExtensionPrompt, extension_prompts, extension_prompt_types,
  activateSendButtons, deactivateSendButtons, stopGeneration,
  sendGenerationRequest, sendStreamingRequest, sendSystemMessage, saveReply,
  scrollChatToBottom, scrollOnMediaLoad,
  showSwipeButtons, hideSwipeButtons, refreshSwipeButtons, swipe, swipe_left, swipe_right,
  isSwipingAllowed, swipeState,
  getThumbnailUrl, selectCharacterById, openCharacterChat, renameChat,
  saveMetadata, updateChatMetadata, extractMessageFromData, messageFormatting,
  ensureMessageMediaIsArray, getMediaDisplay, getMediaIndex,
  getCharacters, getOneCharacter, getCharacterCardFields, getCharacterSource, unshallowCharacter,
  callPopup,
  CONNECT_API_MAP, online_status, main_api, max_context, menu_type,
  chat, characters, groups,
  chat_metadata, create_save,
};
export default _all;

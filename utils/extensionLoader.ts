import { globalEventBus, EVENT_TYPES } from "./eventBus";
import { AppSettings, Character, Message } from "../types";
import { makeLLMRequest } from "../services/geminiService";

// ---------------------------------------------------------------------------
// Global typings for the SillyTavern-compatible bridge
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    MyApp: {
      getContext: () => any; // shape mirrors ST getContext() — too wide to fully type
      libs: { eventBus: typeof globalEventBus };
    };
    extension_settings: Record<string, any>;
    saveSettingsDebounced: () => void;
    toastr: {
      success: (msg: string) => void;
      error:   (msg: string) => void;
      info:    (msg: string) => void;
      warning: (msg: string) => void;
    };
    jQuery: any;
    $: any;
    /** Filled by `public/script.js` — extension prompts to inject into LLM context. */
    __gemrp_extension_prompts__: Record<
      string,
      { value: string; position: number; depth: number; scan: boolean; role: number }
    >;
  }
}

// ---------------------------------------------------------------------------
// Live chat context container — every read of MyApp.getContext() will see
// the latest values because we hand out the same reference.
// ---------------------------------------------------------------------------
interface LiveChatContext extends Array<Message> {
  character: Character | null;
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
  sendMessage: (text: string) => Promise<void>;
}

let liveChatContext: LiveChatContext = Object.assign([] as any, {
  character: null,
  messages: [] as Message[],
  setMessages: (_msgs: Message[]) => {},
  sendMessage: async (_text: string) => {},
}) as LiveChatContext;

let currentAppSettings: AppSettings | null = null;

// Cross-extension shared metadata bucket
const chatMetadata: Record<string, any> = {};

// ---------------------------------------------------------------------------
// Initialization — sets up window.MyApp, toastr, settings persistence.
// Called once on app boot and again whenever settings change.
// ---------------------------------------------------------------------------
export function initExtensionSystem(settings: AppSettings) {
  currentAppSettings = settings;

  // 1. Persisted extension settings bucket
  if (!window.extension_settings) {
    try {
      window.extension_settings = JSON.parse(
        localStorage.getItem("st_extension_settings") || "{}"
      );
    } catch {
      window.extension_settings = {};
    }
  }

  // 2. Auto-persist on demand
  if (!window.saveSettingsDebounced) {
    let timer: any = null;
    window.saveSettingsDebounced = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(
            "st_extension_settings",
            JSON.stringify(window.extension_settings)
          );
        } catch (e) {
          console.warn("[ExtSettings] persist failed:", e);
        }
      }, 250);
    };
  }

  // 3. Toastr — wired to console; UI overlays can override.
  if (!window.toastr) {
    window.toastr = {
      success: (msg) => console.log("%c[success] " + msg, "color:#10b981"),
      error:   (msg) => console.log("%c[error] "   + msg, "color:#ef4444"),
      info:    (msg) => console.log("%c[info] "    + msg, "color:#3b82f6"),
      warning: (msg) => console.log("%c[warning] " + msg, "color:#f59e0b"),
    };
  }

  // 4. Master MyApp bridge — getContext() returns a SillyTavern-ish object.
  if (!window.MyApp) {
    const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 };
    const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };

    window.MyApp = {
      getContext: () => {
        const character = liveChatContext.character;
        const charactersArr = character ? [character] : [];
        return {
          // --- Identity / state ---
          name1: currentAppSettings?.userName ?? "User",
          name2: character?.name ?? "Character",
          chat: liveChatContext,
          characters: charactersArr,
          groups: [],
          characterId: character ? 0 : undefined,
          groupId: undefined,
          chatId: character ? character.id : undefined,
          chatMetadata,
          extensionSettings: window.extension_settings,
          extensionPrompts: window.__gemrp_extension_prompts__ || {},
          settings: currentAppSettings,
          onlineStatus: "GeminiRP",
          maxContext: currentAppSettings?.contextLimit ?? 200000,
          mainApi: "openai",
          menuType: "",

          // --- Event system ---
          eventSource: globalEventBus,
          event_types: EVENT_TYPES,
          eventTypes: EVENT_TYPES,

          // --- LLM helpers ---
          callLLM: async (prompt: string, systemInstruction?: string) => {
            if (!currentAppSettings) {
              throw new Error("Settings not loaded in Extension System!");
            }
            return await makeLLMRequest(
              currentAppSettings,
              [{ role: "user", content: prompt }],
              systemInstruction ||
                "You are an AI assistant helping a roleplay extension."
            );
          },
          generate: async () => {
            await liveChatContext.sendMessage("");
          },
          generateQuietPrompt: async (prompt: string, _img?: any, _qtl?: any, sys?: string) => {
            if (!currentAppSettings) return "";
            return await makeLLMRequest(
              currentAppSettings,
              [{ role: "user", content: prompt }],
              sys || "You are an assistant performing a silent helper generation."
            );
          },
          generateRaw: async (prompt: string, _api?: any, _io?: any, _qtl?: any, sys?: string) => {
            if (!currentAppSettings) return "";
            return await makeLLMRequest(
              currentAppSettings,
              [{ role: "user", content: prompt }],
              sys || "Raw generation."
            );
          },
          sendStreamingRequest: async () => "",
          sendGenerationRequest: async () => "",
          stopGeneration: () => {},

          // --- Extension prompt injection ---
          setExtensionPrompt: (
            key: string,
            value: string,
            position = 0,
            depth = 4,
            scan = false,
            role = 0
          ) => {
            if (!window.__gemrp_extension_prompts__) {
              window.__gemrp_extension_prompts__ = {};
            }
            if (!value) {
              delete window.__gemrp_extension_prompts__[key];
            } else {
              window.__gemrp_extension_prompts__[key] = {
                value: String(value), position, depth, scan, role,
              };
            }
          },

          // --- Chat I/O ---
          getCurrentChatId: () => character?.id ?? null,
          getRequestHeaders: () => ({
            "Content-Type": "application/json",
            "X-Requested-With": "GeminiRP-Extension",
          }),
          reloadCurrentChat: async () => {
            await globalEventBus.emit(EVENT_TYPES.CHAT_CHANGED, character?.id);
          },
          renameChat: () => {},
          saveChat: async () => {
            window.saveSettingsDebounced?.();
            return true;
          },
          saveChatConditional: async () => true,
          saveMetadata: () => {},
          saveMetadataDebounced: () => {},
          saveSettingsDebounced: window.saveSettingsDebounced,
          openCharacterChat: () => {},
          openGroupChat: () => {},
          updateChatMetadata: (meta: any) => {
            if (meta && typeof meta === "object") Object.assign(chatMetadata, meta);
          },
          addOneMessage: (mes: any) => {
            const msg: Message = {
              id: crypto.randomUUID(),
              role: mes?.is_user ? "user" : "model",
              content: String(mes?.mes ?? mes?.content ?? ""),
              timestamp: Date.now(),
            };
            const next = [...liveChatContext.messages, msg];
            liveChatContext.setMessages(next);
            return msg;
          },
          deleteLastMessage: () => {
            const next = liveChatContext.messages.slice(0, -1);
            liveChatContext.setMessages(next);
          },
          deleteMessage: (idx: number) => {
            const next = liveChatContext.messages.slice();
            next.splice(idx, 1);
            liveChatContext.setMessages(next);
          },
          updateMessageBlock: () => {},
          printMessages: () => {},
          clearChat: () => liveChatContext.setMessages([]),
          activateSendButtons: () => {},
          deactivateSendButtons: () => {},
          saveReply: (_t: any, getMsg: any) => getMsg,
          scrollChatToBottom: () => {
            const lastBubble = document.querySelector(".chat-bubble:last-child");
            (lastBubble as any)?.scrollIntoView?.({ behavior: "smooth", block: "end" });
          },
          appendMediaToMessage: (_message: any, _mediaBlock: any) => {},
          ensureMessageMediaIsArray: () => {},
          getMediaDisplay: () => "",
          getMediaIndex: () => -1,
          messageFormatting: (text: string) => String(text ?? ""),

          // --- Macros / substitution ---
          substituteParams: (text: string) => {
            const userName = currentAppSettings?.userName ?? "User";
            const charName = character?.name ?? "Character";
            return String(text ?? "")
              .replace(/\{\{user\}\}/gi, userName)
              .replace(/\{\{char\}\}/gi, charName)
              .replace(/\{\{name1\}\}/gi, userName)
              .replace(/\{\{name2\}\}/gi, charName)
              .replace(/\{\{newline\}\}/gi, "\n");
          },
          substituteParamsExtended: (text: string, env: any = {}) => {
            const userName = env.name1 ?? currentAppSettings?.userName ?? "User";
            const charName = env.name2 ?? character?.name ?? "Character";
            let out = String(text ?? "")
              .replace(/\{\{user\}\}/gi, userName)
              .replace(/\{\{char\}\}/gi, charName);
            for (const k of Object.keys(env)) {
              const re = new RegExp(`\\{\\{${k}\\}\\}`, "gi");
              out = out.replace(re, String(env[k] ?? ""));
            }
            return out;
          },

          // --- Character helpers ---
          getCharacters: () => charactersArr,
          getOneCharacter: (id: any) => charactersArr[id] ?? null,
          getCharacterCardFields: () =>
            character
              ? {
                  description: character.description,
                  personality: character.personality,
                  scenario: (character as any).scenario,
                  first_mes: character.firstMessage,
                  name: character.name,
                }
              : {},
          getCharacterSource: () => "gemini-rp-local",
          selectCharacterById: () => {},
          unshallowCharacter: (c: any) => c,
          unshallowGroupMembers: async () => [],

          // --- Token / tokenizers (best-effort stubs) ---
          tokenizers: {},
          getTextTokens: (_str: string) => [],
          getTokenCount: (str: string) => Math.ceil(String(str ?? "").length / 4),
          getTokenCountAsync: async (str: string) =>
            Math.ceil(String(str ?? "").length / 4),
          getTokenizerModel: () => "gpt-4",

          // --- Popups (loaded lazily by extensions via popup.js) ---
          POPUP_TYPE,
          POPUP_RESULT,
          Popup: class FallbackPopup {
            constructor(public content: any, public type: number = 1) {}
            show() {
              window.toastr?.info(String(this.content ?? ""));
              return Promise.resolve(POPUP_RESULT.AFFIRMATIVE);
            }
            hide() {}
          },
          callGenericPopup: async (msg: any) => {
            window.toastr?.info(String(msg ?? ""));
            return POPUP_RESULT.AFFIRMATIVE;
          },
          callPopup: (msg: any) => window.toastr?.info(String(msg ?? "")),

          // --- Loader (UI spinner) ---
          showLoader: () => {},
          hideLoader: () => {},
          loader: { show: () => {}, hide: () => {} },

          // --- Symbols / constants ---
          symbols: { ignore: Symbol.for("gemrp.ignore") },
          constants: { unset: "__@@UNSET@@__" },
          ModuleWorkerWrapper: class {
            constructor(public cb: () => void) {}
            update() { try { this.cb?.(); } catch (_) {} }
            start(ms = 1000) { this.handle = setInterval(() => this.update(), ms); }
            stop()  { if (this.handle) clearInterval(this.handle); }
            handle: any = null;
          },

          // --- Extension utilities ---
          renderExtensionTemplate: () => "",
          renderExtensionTemplateAsync: async () => "",
          registerDebugFunction: () => {},
          registerSlashCommand: () => {},
          registerMacro: () => {},
          unregisterMacro: () => {},
          registerFunctionTool: () => {},
          unregisterFunctionTool: () => {},
          isToolCallingSupported: () => false,
          canPerformToolCalls: () => false,
          ToolManager: { registerFunctionTool: () => {} },

          // --- World info / variables — empty by default ---
          variables: {
            local:  buildVarStore("local"),
            global: buildVarStore("global"),
          },
          loadWorldInfo: async () => null,
          saveWorldInfo: async () => true,
          updateWorldInfoList: async () => [],
          getWorldInfoPrompt: async () => ({ worldInfoBefore: "", worldInfoAfter: "" }),
          getWorldInfoNames: () => [],
          convertCharacterBook: (b: any) => b,
          reloadWorldInfoEditor: () => {},
        };
      },
      libs: { eventBus: globalEventBus },
    };
  } else {
    // window.MyApp already exists from a previous mount — keep settings live.
    const oldFn = window.MyApp.getContext;
    window.MyApp.getContext = () => ({ ...oldFn(), settings: currentAppSettings });
  }

  // 5. Pre-mount the extension_prompts bucket
  if (!window.__gemrp_extension_prompts__) {
    window.__gemrp_extension_prompts__ = {};
  }
}

// ---------------------------------------------------------------------------
// Simple variable stores (per-chat / global)
// ---------------------------------------------------------------------------
function buildVarStore(scope: "local" | "global") {
  const store: Record<string, any> = {};
  const key = (k: string) => `${scope}:${k}`;
  return {
    get: (k: string) => store[key(k)],
    set: (k: string, v: any) => { store[key(k)] = v; },
    del: (k: string) => { delete store[key(k)]; },
    has: (k: string) => key(k) in store,
    add: (k: string, n: number) => { store[key(k)] = (Number(store[key(k)]) || 0) + n; return store[key(k)]; },
    inc: (k: string) => { store[key(k)] = (Number(store[key(k)]) || 0) + 1; return store[key(k)]; },
    dec: (k: string) => { store[key(k)] = (Number(store[key(k)]) || 0) - 1; return store[key(k)]; },
  };
}

// ---------------------------------------------------------------------------
// Sync the live React state into the bridge so extensions always see fresh data.
// ---------------------------------------------------------------------------
export function syncActiveChatContext(
  character: Character | null,
  messages: Message[],
  setMessages: (msgs: Message[]) => void,
  sendMessage: (text: string) => Promise<void>
) {
  liveChatContext.length = 0;
  messages.forEach((m, i) => { (liveChatContext as any)[i] = m; });
  liveChatContext.character = character;
  liveChatContext.messages = messages;
  liveChatContext.setMessages = setMessages;
  liveChatContext.sendMessage = sendMessage;
}

// ---------------------------------------------------------------------------
// Stylesheet injection
// ---------------------------------------------------------------------------
function injectStylesheet(url: string) {
  const id = `ext-css-${url.replace(/[^a-z0-9]/gi, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

// ---------------------------------------------------------------------------
// Public: discover & activate extensions
// ---------------------------------------------------------------------------
export async function loadExtensions(): Promise<
  { name: string; success: boolean; error?: string }[]
> {
  try {
    const listResponse = await fetch("/api/extensions/list");
    if (!listResponse.ok) {
      throw new Error(`Failed to fetch extension list (HTTP ${listResponse.status})`);
    }

    const extensions: { name: string; manifest: any }[] = await listResponse.json();
    const enabledStates = JSON.parse(
      localStorage.getItem("grh_enabled_extensions") || "{}"
    );

    // Sort by manifest.loading_order
    extensions.sort((a, b) => {
      const orderA = a.manifest.loading_order ?? 10;
      const orderB = b.manifest.loading_order ?? 10;
      return orderA - orderB;
    });

    const results: { name: string; success: boolean; error?: string }[] = [];

    // EXTENSIONS_FIRST_LOAD
    await globalEventBus.emit(EVENT_TYPES.EXTENSIONS_FIRST_LOAD, null);

    for (const ext of extensions) {
      const isEnabled = enabledStates[ext.name] !== false; // active by default
      if (!isEnabled) {
        results.push({ name: ext.name, success: false, error: "Disabled in settings" });
        continue;
      }

      try {
        if (ext.manifest.css) {
          injectStylesheet(
            `/scripts/extensions/third-party/${ext.name}/${ext.manifest.css}`
          );
        }

        const jsUrl = `/scripts/extensions/third-party/${ext.name}/${ext.manifest.js}?t=${Date.now()}`;
        const module = await import(/* @vite-ignore */ jsUrl);

        // SillyTavern extensions don't always export `activate()` — many just
        // execute side effects at import time. We call `activate()` if present.
        if (module && typeof module.activate === "function") {
          await module.activate();
        }

        results.push({ name: ext.name, success: true });
        console.log(`[Extension] Loaded: ${ext.name}`);
      } catch (err: any) {
        console.error(`[Extension] Failed to load "${ext.name}":`, err);
        results.push({
          name: ext.name,
          success: false,
          error: err.message || "Failed to import",
        });
      }
    }

    // APP_READY + APP_INITIALIZED
    await globalEventBus.emit(EVENT_TYPES.APP_INITIALIZED, null);
    await globalEventBus.emit(EVENT_TYPES.APP_READY, null);
    return results;
  } catch (error: any) {
    console.error("Failed to run loadExtensions:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public: read the extension-prompt injection bucket. Used by geminiService
// to actually inject extension-supplied system text into the LLM call.
// ---------------------------------------------------------------------------
export function getExtensionPromptInjections(): string {
  const bucket = (typeof window !== 'undefined' ? window.__gemrp_extension_prompts__ : null) || {};
  const parts: string[] = [];
  for (const key of Object.keys(bucket)) {
    const entry = bucket[key];
    if (entry?.value) parts.push(entry.value);
  }
  return parts.join("\n\n");
}

/**
 * Position constants matching SillyTavern's `extension_prompt_types`:
 *   IN_PROMPT (0)        — append to the system instruction
 *   IN_CHAT (1)          — inject inline near the bottom of the chat
 *   BEFORE_PROMPT (2)    — prepend to the system instruction
 */
export const EXTENSION_PROMPT_POSITIONS = {
  IN_PROMPT: 0,
  IN_CHAT: 1,
  BEFORE_PROMPT: 2,
} as const;

/**
 * Take everything an extension registered via `setExtensionPrompt(...)` and
 * splice it into the outgoing message array IN PLACE.
 *
 * Called by services/geminiService.ts right before emitting
 * CHAT_COMPLETION_PROMPT_READY, so extensions can both inject prompts via
 * setExtensionPrompt() AND further mutate them via the event listener.
 */
export function flushExtensionPromptsInto(
  messages: { role: string; content: string }[]
): void {
  if (!Array.isArray(messages)) return;
  const bucket = (typeof window !== 'undefined' ? window.__gemrp_extension_prompts__ : null) || {};
  const keys = Object.keys(bucket);
  if (keys.length === 0) return;

  // Group by position
  const beforePrompt: string[] = [];
  const inPrompt:     string[] = [];
  const inChat:       Array<{ depth: number; value: string }> = [];

  for (const k of keys) {
    const entry = bucket[k];
    if (!entry?.value) continue;
    const pos = entry.position ?? 0;
    if (pos === EXTENSION_PROMPT_POSITIONS.BEFORE_PROMPT) {
      beforePrompt.push(entry.value);
    } else if (pos === EXTENSION_PROMPT_POSITIONS.IN_CHAT) {
      inChat.push({ depth: entry.depth ?? 4, value: entry.value });
    } else {
      inPrompt.push(entry.value);
    }
  }

  // 1) Find / create the first system message
  let firstSystemIdx = messages.findIndex((m) => m.role === 'system');
  if (firstSystemIdx === -1) {
    messages.unshift({ role: 'system', content: '' });
    firstSystemIdx = 0;
  }
  const sysMsg = messages[firstSystemIdx];

  if (beforePrompt.length > 0) {
    sysMsg.content = beforePrompt.join('\n\n') + (sysMsg.content ? '\n\n' + sysMsg.content : '');
  }
  if (inPrompt.length > 0) {
    sysMsg.content = (sysMsg.content ? sysMsg.content + '\n\n' : '') + inPrompt.join('\n\n');
  }

  // 2) IN_CHAT injection: insert N messages from the end (depth)
  for (const item of inChat) {
    const idx = Math.max(0, messages.length - item.depth);
    messages.splice(idx, 0, { role: 'system', content: item.value });
  }
}

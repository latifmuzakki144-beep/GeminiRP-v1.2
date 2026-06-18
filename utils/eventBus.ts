/**
 * Event Bus for SillyTavern-compatible Extensions in GeminiRP.
 *
 * This event-types catalog is intentionally aligned 1:1 (where it makes sense)
 * with SillyTavern's public/scripts/events.js so that real ST extensions
 * can listen to events they expect to receive — instead of being silently
 * blocked because the constant does not exist.
 *
 * NOT all events fire automatically yet — many are emitted by GeminiRP code
 * (ChatPage, geminiService, ExtensionsModal). Unfired events still exist as
 * keys so that listener registration does not throw.
 */
export const EVENT_TYPES = {
  // --- App lifecycle ---
  APP_INITIALIZED: 'app_initialized',
  APP_READY: 'app_ready',
  EXTRAS_CONNECTED: 'extras_connected',

  // --- Message lifecycle ---
  MESSAGE_SENDING: 'MESSAGE_SENDING', // legacy GeminiRP (kept)
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_UPDATED: 'message_updated',
  MESSAGE_SWIPED: 'message_swiped',
  MESSAGE_SWIPE_DELETED: 'message_swipe_deleted',
  MESSAGE_FILE_EMBEDDED: 'message_file_embedded',
  MESSAGE_REASONING_EDITED: 'message_reasoning_edited',
  MESSAGE_REASONING_DELETED: 'message_reasoning_deleted',
  MORE_MESSAGES_LOADED: 'more_messages_loaded',
  IMPERSONATE_READY: 'impersonate_ready',
  USER_MESSAGE_RENDERED: 'user_message_rendered',
  CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',

  // --- Chat lifecycle ---
  CHAT_CHANGED: 'chat_id_changed',
  CHAT_LOADED: 'chatLoaded',
  CHAT_RESET: 'CHAT_RESET',           // legacy GeminiRP (kept)
  CHAT_DELETED: 'chat_deleted',
  CHAT_CREATED: 'chat_created',
  CHAT_RENAMED: 'chat_renamed',
  GROUP_CHAT_DELETED: 'group_chat_deleted',
  GROUP_CHAT_CREATED: 'group_chat_created',

  // --- Generation lifecycle ---
  GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
  GENERATION_STARTED: 'generation_started',
  GENERATION_STOPPED: 'generation_stopped',
  GENERATION_ENDED: 'generation_ended',
  GENERATE_BEFORE_COMBINE_PROMPTS: 'generate_before_combine_prompts',
  GENERATE_AFTER_COMBINE_PROMPTS: 'generate_after_combine_prompts',
  GENERATE_AFTER_DATA: 'generate_after_data',

  // --- Prompt readiness ---
  CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready',
  CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready',
  TEXT_COMPLETION_SETTINGS_READY: 'text_completion_settings_ready',

  // --- Streaming ---
  STREAM_TOKEN_RECEIVED: 'stream_token_received',
  SMOOTH_STREAM_TOKEN_RECEIVED: 'stream_token_received', // alias
  STREAM_REASONING_DONE: 'stream_reasoning_done',

  // --- Character lifecycle ---
  CHARACTER_CHANGED: 'CHARACTER_CHANGED', // legacy GeminiRP (kept)
  CHARACTER_EDITOR_OPENED: 'character_editor_opened',
  CHARACTER_EDITED: 'character_edited',
  CHARACTER_PAGE_LOADED: 'character_page_loaded',
  CHARACTER_FIRST_MESSAGE_SELECTED: 'character_first_message_selected',
  CHARACTER_DELETED: 'characterDeleted',
  CHARACTER_DUPLICATED: 'character_duplicated',
  CHARACTER_RENAMED: 'character_renamed',
  CHARACTER_RENAMED_IN_PAST_CHAT: 'character_renamed_in_past_chat',
  CHARACTER_MANAGEMENT_DROPDOWN: 'charManagementDropdown',
  CHARACTER_GROUP_OVERLAY_STATE_CHANGE_BEFORE: 'character_group_overlay_state_change_before',
  CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER: 'character_group_overlay_state_change_after',

  // --- Group ---
  GROUP_UPDATED: 'group_updated',
  GROUP_MEMBER_DRAFTED: 'group_member_drafted',
  GROUP_WRAPPER_STARTED: 'group_wrapper_started',
  GROUP_WRAPPER_FINISHED: 'group_wrapper_finished',

  // --- Settings ---
  SETTINGS_LOADED: 'settings_loaded',
  SETTINGS_UPDATED: 'settings_updated',
  SETTINGS_LOADED_BEFORE: 'settings_loaded_before',
  SETTINGS_LOADED_AFTER: 'settings_loaded_after',
  EXTENSION_SETTINGS_LOADED: 'extension_settings_loaded',
  EXTENSIONS_FIRST_LOAD: 'extensions_first_load',

  // --- OAI / Preset ---
  CHATCOMPLETION_SOURCE_CHANGED: 'chatcompletion_source_changed',
  CHATCOMPLETION_MODEL_CHANGED: 'chatcompletion_model_changed',
  OAI_PRESET_CHANGED_BEFORE: 'oai_preset_changed_before',
  OAI_PRESET_CHANGED_AFTER: 'oai_preset_changed_after',
  OAI_PRESET_EXPORT_READY: 'oai_preset_export_ready',
  OAI_PRESET_IMPORT_READY: 'oai_preset_import_ready',
  PRESET_CHANGED: 'preset_changed',
  PRESET_DELETED: 'preset_deleted',
  PRESET_RENAMED: 'preset_renamed',
  PRESET_RENAMED_BEFORE: 'preset_renamed_before',
  MAIN_API_CHANGED: 'main_api_changed',

  // --- World info / lore ---
  WORLDINFO_SETTINGS_UPDATED: 'worldinfo_settings_updated',
  WORLDINFO_UPDATED: 'worldinfo_updated',
  WORLDINFO_FORCE_ACTIVATE: 'worldinfo_force_activate',
  WORLDINFO_ENTRIES_LOADED: 'worldinfo_entries_loaded',
  WORLDINFO_SCAN_DONE: 'worldinfo_scan_done',
  WORLD_INFO_ACTIVATED: 'world_info_activated',

  // --- Personas ---
  PERSONA_CHANGED: 'persona_changed',
  PERSONA_CREATED: 'persona_created',
  PERSONA_UPDATED: 'persona_updated',
  PERSONA_RENAMED: 'persona_renamed',
  PERSONA_DELETED: 'persona_deleted',

  // --- Connection profiles ---
  CONNECTION_PROFILE_LOADED: 'connection_profile_loaded',
  CONNECTION_PROFILE_CREATED: 'connection_profile_created',
  CONNECTION_PROFILE_DELETED: 'connection_profile_deleted',
  CONNECTION_PROFILE_UPDATED: 'connection_profile_updated',

  // --- Tool calls / function calling ---
  TOOL_CALLS_PERFORMED: 'tool_calls_performed',
  TOOL_CALLS_RENDERED: 'tool_calls_rendered',

  // --- Secrets ---
  SECRET_WRITTEN: 'secret_written',
  SECRET_DELETED: 'secret_deleted',
  SECRET_ROTATED: 'secret_rotated',
  SECRET_EDITED: 'secret_edited',

  // --- Misc ---
  MOVABLE_PANELS_RESET: 'movable_panels_reset',
  SD_PROMPT_PROCESSING: 'sd_prompt_processing',
  FORCE_SET_BACKGROUND: 'force_set_background',
  FILE_ATTACHMENT_DELETED: 'file_attachment_deleted',
  IMAGE_SWIPED: 'image_swiped',
  OPEN_CHARACTER_LIBRARY: 'open_character_library',
  ONLINE_STATUS_CHANGED: 'online_status_changed',
  ITEMIZED_PROMPTS_LOADED: 'itemized_prompts_loaded',
  ITEMIZED_PROMPTS_SAVED: 'itemized_prompts_saved',
  ITEMIZED_PROMPTS_DELETED: 'itemized_prompts_deleted',
  MEDIA_ATTACHMENT_DELETED: 'media_attachment_deleted',
  TTS_JOB_STARTED: 'tts_job_started',
  TTS_AUDIO_READY: 'tts_audio_ready',
  TTS_JOB_COMPLETE: 'tts_job_complete',
};

type EventCallback = (data?: any, ...rest: any[]) => void | Promise<void> | any | Promise<any>;

/**
 * SillyTavern-compatible EventEmitter.
 *
 * Supports both:
 *   - on(event, cb) / off(event, cb)
 *   - once(event, cb)
 *   - emit(event, data)            — broadcast, awaits listeners,
 *                                    if a listener returns a non-undefined value
 *                                    the next listener sees that value (mutation pipeline).
 *   - emitAndWait(event, data)     — alias used by some ST extensions
 *   - removeListener(event, cb)    — alias for off
 */
class EventBus {
  private listeners: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  once(event: string, callback: EventCallback) {
    const wrapper: EventCallback = async (data?: any, ...rest: any[]) => {
      this.off(event, wrapper);
      return await callback(data, ...rest);
    };
    return this.on(event, wrapper);
  }

  off(event: string, callback: EventCallback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  removeListener(event: string, callback: EventCallback) {
    return this.off(event, callback);
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }

  listenerCount(event: string) {
    return this.listeners[event]?.length ?? 0;
  }

  /**
   * Emits an event. Listeners are awaited sequentially.
   * If a listener returns a non-undefined value, that value replaces `currentData`
   * for the next listener and is also returned at the end (mutation pipeline).
   *
   * ST extensions usually call `eventSource.emit(event, payload)` and DON'T
   * read the return value — they mutate `payload` in-place. We still support
   * both styles.
   */
  async emit(event: string, data?: any, ...rest: any[]): Promise<any> {
    if (!this.listeners[event]) return data;
    let currentData = data;
    for (const callback of this.listeners[event].slice()) {
      try {
        const result = await callback(currentData, ...rest);
        if (result !== undefined) currentData = result;
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event}":`, err);
      }
    }
    return currentData;
  }

  /** Alias used by some ST extensions. */
  async emitAndWait(event: string, data?: any, ...rest: any[]): Promise<any> {
    return this.emit(event, data, ...rest);
  }
}

export const globalEventBus = new EventBus();

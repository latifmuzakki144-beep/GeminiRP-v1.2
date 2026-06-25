import {
    AppSettings,
    BUILTIN_PRESETS,
    DEFAULT_INSTRUCT_FORMAT,
    InstructFormat,
    PromptEntry,
    PromptMarker,
    PromptPreset,
} from "../types";

/**
 * Community Preset Manager (P1).
 *
 * Responsibilities:
 *  - List built-in + user-imported presets (persisted to localforage)
 *  - Apply a preset to AppSettings (promptEntries, instructFormat, suggestedT/temp)
 *  - Import presets from .json (SillyTavern preset format supported, best-effort mapping)
 *  - Export current settings as a preset .json
 *  - Delete user-imported presets (built-ins are read-only)
 */

import localforage from "localforage";

const PRESET_STORAGE_KEY_PREFIX = "gemirp_presets_";

const getStorageKey = (): string => {
    // Read active house id from localStorage (same scheme as storage.ts)
    const houseId = localStorage.getItem('grh_houseId') || 'default';
    return `${PRESET_STORAGE_KEY_PREFIX}${houseId}`;
};

const presetStore = () => localforage;

const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

/**
 * Map a SillyTavern role string to our internal role.
 */
const mapRole = (r: any): 'system' | 'user' | 'assistant' => {
    if (r === 'user') return 'user';
    if (r === 'assistant') return 'assistant';
    return 'system';
};

/**
 * Best-effort marker inference from a prompt's name/identifier (P1).
 * Used when importing SillyTavern presets that don't carry our `marker` field.
 */
const inferMarker = (p: any): PromptMarker => {
    const name = ((p.name || '') + ' ' + (p.identifier || '')).toLowerCase();
    if (/(jailbreak|nsfw|main|ignore restrictions|bypass)/.test(name)) return 'jailbreak';
    if (/(instruct|output|format|style|writing)/.test(name)) return 'instruct_format';
    if (/(world|lore|winfo|wi)/.test(name)) return 'world_info';
    if (/(persona|user persona|player)/.test(name)) return 'persona';
    if (/(character|char)/.test(name)) return 'character';
    return 'auxiliary';
};

/**
 * Convert a raw imported object into our PromptEntry shape.
 * Supports both our native shape and SillyTavern's preset shape.
 */
const normalizePromptEntry = (p: any): PromptEntry | null => {
    if (!p) return null;
    const content = typeof p.content === 'string' ? p.content : '';
    const name = p.name || p.identifier || 'Imported Prompt';
    const role = mapRole(p.role);
    const enabled = p.enabled !== false;
    const injectionPosition = p.injectionPosition ?? p.injection_position ?? 0;
    const marker = (p.marker as PromptMarker) || inferMarker(p);
    const category = p.category || (marker === 'jailbreak' ? 'jailbreak'
        : marker === 'instruct_format' ? 'instruct'
        : marker === 'world_info' ? 'world'
        : marker === 'persona' ? 'persona'
        : marker === 'character' ? 'character'
        : 'auxiliary');
    const id = p.id || p.identifier || uuid();
    return { id, name, content, role, enabled, injectionPosition, marker, category };
};

/**
 * Load all user-imported presets from localforage.
 * (Built-ins are not persisted — they come from BUILTIN_PRESETS.)
 */
export const loadUserPresets = async (): Promise<PromptPreset[]> => {
    try {
        const data = await presetStore().getItem<PromptPreset[]>(getStorageKey());
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn("loadUserPresets failed", e);
        return [];
    }
};

const saveUserPresets = async (presets: PromptPreset[]): Promise<void> => {
    try {
        await presetStore().setItem(getStorageKey(), presets);
    } catch (e) {
        console.warn("saveUserPresets failed", e);
    }
};

/**
 * Return all presets available to the UI: built-ins first, then user-imported.
 */
export const listAllPresets = async (): Promise<PromptPreset[]> => {
    const userPresets = await loadUserPresets();
    return [...BUILTIN_PRESETS, ...userPresets];
};

/**
 * Import a preset from a JSON string.
 *
 * Supported shapes:
 *  1. Native PromptPreset:        { id, name, promptEntries: [...], instructFormat? }
 *  2. SillyTavern prompt preset:  { name, prompts: [...] } or { prompts: [...] }
 *  3. Raw promptEntries array:    [ { name, content, role }, ... ]
 *  4. Single prompt object:       { name, content, role }
 */
export const importPresetFromJSON = async (jsonString: string): Promise<PromptPreset> => {
    let raw: any;
    try {
        raw = JSON.parse(jsonString);
    } catch (e: any) {
        throw new Error("Format JSON tidak valid: " + (e?.message || "parse error"));
    }

    let preset: PromptPreset;

    if (Array.isArray(raw)) {
        // Shape 3: raw array of prompt entries
        const entries = raw.map(normalizePromptEntry).filter(Boolean) as PromptEntry[];
        preset = {
            id: uuid(),
            name: `Imported Preset ${new Date().toLocaleString()}`,
            description: 'Diimpor dari array prompt.',
            source: 'user',
            promptEntries: entries,
            createdAt: Date.now(),
        };
    } else if (raw && typeof raw === 'object') {
        if (raw.promptEntries && Array.isArray(raw.promptEntries)) {
            // Shape 1: native PromptPreset
            const entries = raw.promptEntries.map(normalizePromptEntry).filter(Boolean) as PromptEntry[];
            preset = {
                id: raw.id || uuid(),
                name: raw.name || 'Imported Preset',
                description: raw.description || '',
                author: raw.author,
                source: 'user',
                promptEntries: entries,
                instructFormat: raw.instructFormat,
                suggestedTemperature: raw.suggestedTemperature,
                suggestedContextLimit: raw.suggestedContextLimit,
                createdAt: raw.createdAt || Date.now(),
            };
        } else if (raw.prompts && Array.isArray(raw.prompts)) {
            // Shape 2: SillyTavern preset
            const entries = raw.prompts.map(normalizePromptEntry).filter(Boolean) as PromptEntry[];
            preset = {
                id: uuid(),
                name: raw.name || 'SillyTavern Preset',
                description: raw.description || 'Diimpor dari format SillyTavern.',
                author: raw.author,
                source: 'user',
                promptEntries: entries,
                instructFormat: raw.instructFormat,
                suggestedTemperature: raw.suggestedTemperature,
                suggestedContextLimit: raw.suggestedContextLimit,
                createdAt: Date.now(),
            };
        } else if (raw.content && raw.role) {
            // Shape 4: single prompt object
            const entry = normalizePromptEntry(raw);
            preset = {
                id: uuid(),
                name: raw.name || 'Imported Prompt',
                description: 'Diimpor dari satu prompt.',
                source: 'user',
                promptEntries: entry ? [entry] : [],
                createdAt: Date.now(),
            };
        } else {
            throw new Error("Format preset tidak dikenali. Expected: PromptPreset, SillyTavern preset, atau array prompt.");
        }
    } else {
        throw new Error("Root JSON harus berupa object atau array.");
    }

    if (preset.promptEntries.length === 0) {
        throw new Error("Preset tidak berisi prompt valid.");
    }

    // Persist
    const existing = await loadUserPresets();
    existing.push(preset);
    await saveUserPresets(existing);

    return preset;
};

/**
 * Delete a user-imported preset. Built-ins cannot be deleted.
 */
export const deleteUserPreset = async (presetId: string): Promise<void> => {
    const existing = await loadUserPresets();
    const filtered = existing.filter(p => p.id !== presetId);
    await saveUserPresets(filtered);
};

/**
 * Apply a preset to a settings object. Returns a new settings object.
 *
 * Behavior:
 *  - Replaces promptEntries with the preset's entries
 *  - Merges preset.instructFormat into settings.instructFormat (preset wins)
 *  - Optionally applies suggestedTemperature / suggestedContextLimit
 *  - Sets activePresetId
 */
export const applyPreset = (
    settings: AppSettings,
    preset: PromptPreset,
    opts?: { applySuggested?: boolean }
): AppSettings => {
    const next: AppSettings = {
        ...settings,
        promptEntries: preset.promptEntries.map(p => ({ ...p })),
        activePresetId: preset.id,
    };

    // Merge instructFormat — preset overrides individual fields if specified.
    if (preset.instructFormat) {
        const base: InstructFormat = settings.instructFormat
            ? { ...settings.instructFormat }
            : { ...DEFAULT_INSTRUCT_FORMAT };
        next.instructFormat = {
            ...base,
            ...preset.instructFormat,
            enabled: preset.instructFormat.enabled ?? base.enabled,
        } as InstructFormat;
    }

    if (opts?.applySuggested) {
        if (typeof preset.suggestedTemperature === 'number') {
            next.temperature = preset.suggestedTemperature;
        }
        if (typeof preset.suggestedContextLimit === 'number') {
            next.contextLimit = preset.suggestedContextLimit;
        }
    }

    return next;
};

/**
 * Export the current settings as a preset JSON string.
 * Useful for backing up or sharing a tuned configuration.
 */
export const exportSettingsAsPreset = (
    settings: AppSettings,
    name: string,
    description?: string
): string => {
    const preset: PromptPreset = {
        id: uuid(),
        name,
        description: description || 'Preset diekspor dari GeminiRP.',
        source: 'user',
        promptEntries: settings.promptEntries.map(p => ({ ...p })),
        instructFormat: settings.instructFormat ? { ...settings.instructFormat } : undefined,
        suggestedTemperature: settings.temperature,
        suggestedContextLimit: settings.contextLimit,
        createdAt: Date.now(),
    };
    return JSON.stringify(preset, null, 2);
};

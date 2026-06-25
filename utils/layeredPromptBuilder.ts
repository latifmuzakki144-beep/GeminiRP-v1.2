import {
    AppSettings,
    Character,
    InstructFormat,
    Message,
    Persona,
    PromptEntry,
    PromptMarker,
} from "../types";
import { processPrompt } from "./promptUtils";
import { scanLorebook } from "./loreUtils";

/**
 * Layered System Prompt Builder (P1).
 *
 * Final system instruction is composed in this fixed order:
 *   1. CHARACTER         — character card block (name, description, personality, scenario)
 *   2. PERSONA           — user persona block (name, pronouns, description, backstory)
 *   3. WORLD_INFO        — matched lorebook entries (priority-sorted, budget-capped)
 *   4. JAILBREAK         — marker:'jailbreak' prompt entries + legacy systemPrompt
 *   5. INSTRUCT_FORMAT   — marker:'instruct_format' prompt entries + instructFormat.outputRules
 *   6. AUXILIARY         — marker:'auxiliary' / untagged system entries (in declaration order)
 *
 * Each layer is separated by a clear divider so the model can attend to
 * each block distinctly. This mirrors SillyTavern's layered prompt assembly
 * and significantly reduces refusal rates because the jailbreak sits ABOVE
 * the instruct layer instead of being buried inside character context.
 */

const SECTION_DIVIDER = "\n\n" + "─".repeat(40) + "\n";

const estimateTokens = (s: string): number => Math.ceil((s || "").length / 4);

interface LayeredPromptResult {
    systemInstruction: string;
    activeLoreIds: string[];
    droppedLoreIds: string[];
    /** token estimate of the assembled system instruction, for debugging/UI */
    estimatedTokens: number;
}

/**
 * Filter prompt entries by marker, keep only enabled ones,
 * and sort by injectionPosition (ascending; lower = earlier in section).
 */
const pickByMarker = (entries: PromptEntry[] | undefined, marker: PromptMarker): PromptEntry[] => {
    if (!entries) return [];
    return entries
        .filter(p => p.enabled && p.role === 'system' && (p.marker || 'none') === marker)
        .sort((a, b) => (a.injectionPosition ?? 0) - (b.injectionPosition ?? 0));
};

const renderEntries = (
    entries: PromptEntry[],
    charName: string,
    userName: string,
    persona?: Persona | null
): string => {
    return entries
        .map(p => processPrompt(p.content, charName, userName, persona).trim())
        .filter(Boolean)
        .join("\n\n");
};

/**
 * Build the character card block.
 * Format mirrors the legacy buildSystemPrompt so existing characters keep working.
 */
const buildCharacterBlock = (character: Character, settings: AppSettings): string => {
    const persona = settings.persona;
    const parts: string[] = [];
    parts.push(`[Character Name: ${character.name}]`);
    if (character.description) parts.push(`[Description: ${character.description}]`);
    if (character.personality) parts.push(`[Personality: ${character.personality}]`);
    parts.push(`[Scenario: ${processPrompt(character.scenario || 'Free roam', character.name, settings.userName, persona)}]`);
    return parts.join("\n");
};

/**
 * Build the user persona block (P3).
 * Only injected when the persona has at least one populated field.
 */
const buildPersonaBlock = (settings: AppSettings): string => {
    const p = settings.persona;
    if (!p) return "";
    const userName = settings.userName || p.name || "User";

    const lines: string[] = [];
    lines.push(`[User Persona: ${userName}]`);
    if (p.pronouns) lines.push(`[Pronouns: ${p.pronouns}]`);
    if (p.description) lines.push(`[Description: ${p.description}]`);
    if (p.backstory) lines.push(`[Backstory: ${p.backstory}]`);

    // If only the name is set, don't bother emitting the block — it's redundant.
    const hasDetail = !!(p.pronouns || p.description || p.backstory);
    if (!hasDetail) return "";

    return lines.join("\n");
};

/**
 * Build the World Info / Lorebook block.
 * Uses the priority + budget-aware scanLorebook (P2).
 */
const buildWorldInfoBlock = (
    character: Character,
    settings: AppSettings,
    history: Message[],
    newMessage: string
): { text: string; activeLoreIds: string[]; droppedLoreIds: string[] } => {
    // Scan deeper into history to improve reliability (mirrors legacy behavior).
    const recentHistoryText = history.slice(-6).map(m => m.content).join('\n---\n');
    const textToScan = recentHistoryText + '\n---\n' + newMessage;

    // Total budget = 25% of context limit, capped to a sensible max.
    // This keeps lore from eating the entire context window.
    const totalBudget = Math.max(512, Math.floor(settings.contextLimit * 0.25));

    const loreResult = scanLorebook(
        textToScan,
        character.lorebook,
        character.name,
        settings.userName,
        settings.persona,
        totalBudget
    );

    if (!loreResult.loreText) {
        return { text: "", activeLoreIds: [], droppedLoreIds: [] };
    }

    const text = `[LOREBOOK / WORLD INFO]:\n${loreResult.loreText}\n\n[DIRECTIVE]: Gunakan informasi di atas (Lorebook/World Info) jika relevan dengan situasi saat ini untuk memperkaya narasi dan menjaga konsistensi dunia. JANGAN abaikan detail tersebut jika sedang dibahas.`;
    return {
        text,
        activeLoreIds: loreResult.matchedEntries.map(e => e.id),
        droppedLoreIds: loreResult.droppedEntries.map(e => e.id),
    };
};

/**
 * Build the Jailbreak block (P1).
 * Sources (in order):
 *   1. marker:'jailbreak' prompt entries
 *   2. legacy `settings.systemPrompt` (fallback if no jailbreak entries)
 */
const buildJailbreakBlock = (character: Character, settings: AppSettings): string => {
    const persona = settings.persona;
    const jailbreakEntries = pickByMarker(settings.promptEntries, 'jailbreak');
    const fromEntries = renderEntries(jailbreakEntries, character.name, settings.userName, persona);
    if (fromEntries) return `[JAILBREAK / SYSTEM DIRECTIVES]:\n${fromEntries}`;

    // Fallback to legacy single systemPrompt
    if (settings.systemPrompt) {
        return `[JAILBREAK / SYSTEM DIRECTIVES]:\n${processPrompt(settings.systemPrompt, character.name, settings.userName, persona)}`;
    }
    return "";
};

/**
 * Build the Instruct Format block (P1).
 * Sources (in order):
 *   1. marker:'instruct_format' prompt entries
 *   2. settings.instructFormat.outputRules (if enabled)
 */
const buildInstructBlock = (character: Character, settings: AppSettings): string => {
    const persona = settings.persona;
    const instructEntries = pickByMarker(settings.promptEntries, 'instruct_format');
    const fromEntries = renderEntries(instructEntries, character.name, settings.userName, persona);

    const fromInstructFormat = settings.instructFormat?.enabled
        ? (settings.instructFormat.outputRules || "").trim()
        : "";

    const combined = [fromEntries, processPrompt(fromInstructFormat, character.name, settings.userName, persona)]
        .filter(Boolean)
        .join("\n\n");

    if (!combined) return "";
    return `[INSTRUCT / OUTPUT FORMAT]:\n${combined}`;
};

/**
 * Build the Auxiliary block — any system entry that doesn't fit the markers above.
 * This catches 'auxiliary' and 'none'/'character' marker entries so we don't
 * silently drop user prompts that predate the marker system.
 */
const buildAuxiliaryBlock = (character: Character, settings: AppSettings): string => {
    const persona = settings.persona;
    if (!settings.promptEntries || settings.promptEntries.length === 0) return "";

    const auxEntries = settings.promptEntries
        .filter(p => p.enabled && p.role === 'system')
        .filter(p => {
            const m = p.marker || 'none';
            // Only catch entries that aren't already consumed by jailbreak/instruct layers.
            // 'character' marker is reserved for future overrides; treat as auxiliary for now.
            return m === 'auxiliary' || m === 'none' || m === 'character' || m === 'persona' || m === 'world_info';
        })
        .sort((a, b) => (a.injectionPosition ?? 0) - (b.injectionPosition ?? 0));

    const text = renderEntries(auxEntries, character.name, settings.userName, persona);
    if (!text) return "";
    return `[AUXILIARY DIRECTIVES]:\n${text}`;
};

/**
 * Compose the final layered system instruction.
 * Public entry point used by generateReply() in services/geminiService.ts.
 */
export const buildLayeredSystemPrompt = (
    character: Character,
    settings: AppSettings,
    history: Message[],
    newMessage: string
): LayeredPromptResult => {
    const sections: string[] = [];

    // 1. CHARACTER
    const characterBlock = buildCharacterBlock(character, settings);
    if (characterBlock) sections.push(characterBlock);

    // 2. PERSONA
    const personaBlock = buildPersonaBlock(settings);
    if (personaBlock) sections.push(personaBlock);

    // 3. WORLD INFO
    const worldInfo = buildWorldInfoBlock(character, settings, history, newMessage);
    if (worldInfo.text) sections.push(worldInfo.text);

    // 4. JAILBREAK
    const jailbreakBlock = buildJailbreakBlock(character, settings);
    if (jailbreakBlock) sections.push(jailbreakBlock);

    // 5. INSTRUCT FORMAT
    const instructBlock = buildInstructBlock(character, settings);
    if (instructBlock) sections.push(instructBlock);

    // 6. AUXILIARY
    const auxBlock = buildAuxiliaryBlock(character, settings);
    if (auxBlock) sections.push(auxBlock);

    const systemInstruction = sections.join(SECTION_DIVIDER);

    return {
        systemInstruction,
        activeLoreIds: worldInfo.activeLoreIds,
        droppedLoreIds: worldInfo.droppedLoreIds,
        estimatedTokens: estimateTokens(systemInstruction),
    };
};

/**
 * Instruct-format wrappers for in-chat message rendering (P1).
 * If the user has configured user/assistant prefixes, they get prepended
 * to the corresponding message content at request time. This mirrors
 * SillyTavern's "instruct mode" formatting without breaking the chat history.
 */
export const applyInstructWrapping = (
    messages: { role: string; content: string }[],
    instruct: InstructFormat | undefined
): { role: string; content: string }[] => {
    if (!instruct || !instruct.enabled) return messages;
    const uP = (instruct.userPrefix || "").trim();
    const aP = (instruct.assistantPrefix || "").trim();
    const sP = (instruct.systemPrefix || "").trim();

    return messages.map(m => {
        let prefix = "";
        if (m.role === 'user' && uP) prefix = uP + " ";
        else if ((m.role === 'assistant' || m.role === 'model') && aP) prefix = aP + " ";
        else if (m.role === 'system' && sP) prefix = sP + " ";
        if (!prefix) return m;
        return { ...m, content: prefix + m.content };
    });
};

import { LorebookEntry } from "../types";
import { processPrompt } from "./promptUtils";
import { Persona } from "../types";

/**
 * Default priority when not specified. Mirrors SillyTavern semantics:
 * higher priority wins the budget race, default 10.
 */
const DEFAULT_PRIORITY = 10;

/**
 * Estimate tokens for a string (rough: 1 token ≈ 4 chars).
 * Used by the budget-aware lorebook scan.
 */
const estimateTokens = (s: string): number => Math.ceil((s || "").length / 4);

/**
 * Memindai teks (pesan user + history singkat) terhadap Lorebook.
 * Mengembalikan objek berisi teks gabungan dan metadata entry yang cocok.
 *
 * P2 additions:
 *  - priority-aware sorting (higher priority injected first)
 *  - per-entry tokenBudget enforcement
 *  - totalBudget optional cap (passed by caller from settings)
 *  - disable flag respected
 */
export const scanLorebook = (
    textToScan: string,
    lorebook: LorebookEntry[] | undefined,
    charName: string,
    userName: string,
    persona?: Persona | null,
    totalBudgetTokens: number = 0  // 0 = unlimited
): { loreText: string; matchedEntries: LorebookEntry[]; droppedEntries: LorebookEntry[] } => {
    if (!lorebook || lorebook.length === 0) return { loreText: "", matchedEntries: [], droppedEntries: [] };

    const matchedEntries: LorebookEntry[] = [];
    const normalizedText = textToScan.toLowerCase();

    lorebook.forEach(info => {
        // Skip if disabled or explicitly disabled via disable flag (P2)
        if (info.enabled === false) return;
        if (info.disable) return;

        // 1. Primary Trigger Check
        const primaryKeys = info.keys.filter(k => k.trim() !== "");
        const secondaryKeys = (info.secondaryKeys || []).filter(k => k.trim() !== "");

        let isPrimaryMatch = info.alwaysOn || primaryKeys.length === 0;

        if (!isPrimaryMatch) {
            isPrimaryMatch = primaryKeys.some(key => {
                const trimmedKey = key.trim().toLowerCase();
                if (!trimmedKey) return false;

                const escapedKey = trimmedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // If keyword is very short, be strict with word boundaries
                if (trimmedKey.length <= 2) {
                    return new RegExp(`\\b${escapedKey}\\b`, 'i').test(normalizedText);
                }

                // For Indonesian: handle common prefixes (me, di, ber, ter, pe, ke, se)
                // and suffixes (nya, kan, i, lah, kah, ku, mu)
                const regex = new RegExp(`\\b(?:me|di|ber|ter|pe|ke|se)?${escapedKey}(?:nya|kan|i|lah|kah|ku|mu)?\\b`, 'i');
                return regex.test(normalizedText);
            });
        }

        // 2. Secondary/Selective Check (Logical AND)
        if (isPrimaryMatch && !info.alwaysOn && secondaryKeys.length > 0) {
            const isSecondaryMatch = secondaryKeys.some(key => {
                const trimmedKey = key.trim().toLowerCase();
                const escapedKey = trimmedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                if (trimmedKey.length <= 2) {
                    return new RegExp(`\\b${escapedKey}\\b`, 'i').test(normalizedText);
                }

                const regex = new RegExp(`\\b(?:me|di|ber|ter|pe|ke|se)?${escapedKey}(?:nya|kan|i|lah|kah|ku|mu)?\\b`, 'i');
                return regex.test(normalizedText);
            });

            if (!isSecondaryMatch) {
                isPrimaryMatch = false; // Vetoed by selective logic
            }
        }

        if (isPrimaryMatch) {
            matchedEntries.push(info);
        }
    });

    // --- P2: Priority sort (descending) then stable by original order ---
    // Higher priority first; ties keep insertion order (stable sort).
    const prioritySorted = matchedEntries
        .map((e, originalIdx) => ({ e, originalIdx, prio: e.priority ?? DEFAULT_PRIORITY }))
        .sort((a, b) => {
            if (b.prio !== a.prio) return b.prio - a.prio;
            return a.originalIdx - b.originalIdx; // stable
        })
        .map(x => x.e);

    // --- P2: Budget enforcement ---
    const droppedEntries: LorebookEntry[] = [];
    const activeLoreTexts: string[] = [];
    let runningTokens = 0;

    for (const entry of prioritySorted) {
        // Per-entry budget cap (0 = unlimited)
        const perEntryBudget = entry.tokenBudget && entry.tokenBudget > 0 ? entry.tokenBudget : Infinity;
        // Global budget (0 = unlimited)
        const globalBudget = totalBudgetTokens > 0 ? totalBudgetTokens : Infinity;

        const processedText = processPrompt(entry.entry, charName, userName, persona);
        let entryText = processedText;
        let entryTokens = estimateTokens(entryText);

        // If per-entry budget exceeded, truncate the entry text itself.
        if (entryTokens > perEntryBudget) {
            // Approx char cap (4 chars ≈ 1 token)
            const charCap = Math.max(0, perEntryBudget * 4);
            entryText = entryText.slice(0, charCap);
            entryTokens = estimateTokens(entryText);
        }

        // If global budget would be exceeded by adding this entry, drop it.
        if (runningTokens + entryTokens > globalBudget) {
            droppedEntries.push(entry);
            continue;
        }

        runningTokens += entryTokens;
        activeLoreTexts.push(entryText);
    }

    return {
        loreText: activeLoreTexts.join('\n\n'),
        matchedEntries: prioritySorted.filter(e => !droppedEntries.includes(e)),
        droppedEntries
    };
};

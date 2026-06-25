import { Persona } from "../types";

/**
 * Memproses teks prompt dengan mengganti placeholder variabel.
 *
 * Placeholder yang didukung:
 * - {{user}} : Nama pengguna
 * - {{char}} : Nama karakter
 * - {{time}} : Waktu saat ini (HH:mm)
 * - {{persona_description}} : Deskripsi fisik/behavioral user persona (P3)
 * - {{persona_pronouns}}   : Pronoun user persona (P3)
 * - {{persona_backstory}}  : Backstory singkat user persona (P3)
 */
export const processPrompt = (
    text: string,
    charName: string,
    userName: string,
    persona?: Persona | null
): string => {
    if (!text) return "";

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Persona defaults — fall back to plain userName so legacy prompts still work.
    const pDesc = persona?.description?.trim() || "";
    const pPron = persona?.pronouns?.trim() || "";
    const pBack = persona?.backstory?.trim() || "";

    return text
        .replace(/{{user}}/gi, userName)
        .replace(/{{char}}/gi, charName)
        .replace(/{{time}}/gi, timeString)
        .replace(/{{persona_description}}/gi, pDesc)
        .replace(/{{persona_pronouns}}/gi, pPron)
        .replace(/{{persona_backstory}}/gi, pBack);
};

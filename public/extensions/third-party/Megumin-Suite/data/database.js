/**
 * Minimal-but-valid placeholder data for Megumin-Suite, so the extension can
 * load and render its UI in GeminiRP without 404-ing on its data import.
 *
 * Each collection follows the shape Megumin-Suite expects (id + label).
 * Users / extension authors can replace this file with the full asset
 * pack from the original Megumin-Suite release.
 */

export const hardcodedLogic = {
  modes: [
    { id: 'balance',  label: 'Balance',  description: 'Default balanced storytelling.' },
    { id: 'narrate',  label: 'Narrative',description: 'Heavier narration / less dialogue.' },
    { id: 'dialogue', label: 'Dialogue', description: 'Heavier dialogue / less narration.' },
    { id: 'action',   label: 'Action',   description: 'Fast-paced cinematic action.' },
  ],

  personalities: [
    { id: 'engine',   label: 'Engine (Default)', description: 'Stays close to the character card.' },
    { id: 'creative', label: 'Creative',         description: 'Adds inventive flavor while staying in-character.' },
    { id: 'strict',   label: 'Strict',           description: 'Hews tightly to lore and persona constraints.' },
  ],

  models: [
    { id: 'cot-v1-english',   label: 'CoT v1 (EN)' },
    { id: 'cot-v1-indonesian',label: 'CoT v1 (ID)' },
    { id: 'plain',            label: 'Plain Pass-Through' },
  ],

  toggles: [
    { id: 'ooc',     label: 'OOC Replies',    description: 'Allow out-of-character responses.' },
    { id: 'control', label: 'Director Mode',  description: 'Let the user steer the next beat.' },
  ],

  styles: [
    { id: 'sastra',    label: 'Sastra',    description: 'Poetic literary prose.' },
    { id: 'dramatis',  label: 'Dramatis',  description: 'Tense, emotional, descriptive.' },
    { id: 'modern',    label: 'Modern',    description: 'Casual modern Indonesian.' },
    { id: 'sensual',   label: 'Sensual',   description: 'Romantic, intimate detail.' },
  ],

  directStyles: [],

  styleTemplates: [
    { id: 'default', label: 'Default', content: '' },
  ],

  addons: [],
  blocks: [],
};

export default { hardcodedLogic };

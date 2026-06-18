/**
 * Minimal image-data set for Megumin-Suite's image generation panel.
 * Stand-in only — populate with real assets when wiring an image backend.
 */

export const KAZUMA_PLACEHOLDERS = [
  { id: 'portrait',      label: 'Portrait',       prompt: 'character portrait, soft light' },
  { id: 'scene',         label: 'Scene',          prompt: 'wide cinematic establishing shot' },
  { id: 'closeup',       label: 'Close-up',       prompt: 'expressive close-up, shallow depth of field' },
];

export const RESOLUTIONS = [
  { id: 'square',     label: 'Square 1024',     width: 1024, height: 1024 },
  { id: 'portrait',   label: 'Portrait 832x1216', width: 832, height: 1216 },
  { id: 'landscape',  label: 'Landscape 1216x832', width: 1216, height: 832 },
];

export default { KAZUMA_PLACEHOLDERS, RESOLUTIONS };

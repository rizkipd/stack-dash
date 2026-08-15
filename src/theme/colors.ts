/**
 * Colour tokens transcribed from `docs/ART_DIRECTION.md`.
 *
 * These are tunable starting points sampled from `image.png`, not fixed
 * constants. The governing constraint outranks every value here:
 * gameplay objects must stay strongly contrasted against the background.
 */

export const colors = {
  // --- Gameplay objects ---
  /** Player block front face. Kept a *parameter* at the render layer, never
   *  inlined, so post-MVP skins stay a config change rather than a refactor. */
  block: '#3B82F6',
  blockLight: '#60A5FA',
  blockDark: '#1D4ED8',
  blockLost: '#EF4444',
  blockLostDark: '#B91C1C',

  obstacle: '#27272A',
  obstacleEdge: '#3F3F46',

  collect: '#22D3EE',
  collectGlow: '#67E8F9',

  // --- Background ---
  bgTop: '#1E1B4B',
  bgMid: '#4C1D95',
  bgBottom: '#831843',
  skyline: '#180F35',
  ground: '#0F0A24',

  // --- UI ---
  surface: '#0B0B12',
  card: '#16161F',
  primary: '#3B82F6',
  secondary: '#7C3AED',
  neutral: '#3F3F46',
  accent: '#F59E0B',
  danger: '#EF4444',
  text: '#FFFFFF',
  textDim: '#A1A1AA',
} as const;

export type ColorToken = keyof typeof colors;

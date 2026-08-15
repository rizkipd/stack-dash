export type KeyboardControlOptions = {
  getTargetY: () => number;
  setTargetY: (worldY: number) => void;
  onTogglePause: () => void;
  onRestart: () => void;
  enabled?: boolean;
};

/**
 * Keyboard controls — native no-op.
 *
 * Phones have no keyboard, and `document` does not exist in React Native, so
 * the real implementation lives in `useKeyboardControls.web.ts` and is selected
 * by Metro's platform extensions.
 */
export function useKeyboardControls(_options: KeyboardControlOptions): void {
  // Intentionally empty on iOS and Android.
}

/** Layout tokens from `docs/ART_DIRECTION.md` §5. */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const layout = {
  /** Buttons sit in a fixed-width column so menus stay centred on any phone. */
  columnWidth: 280,
  buttonHeight: 56,
  buttonRadius: 14,
  /** iOS HIG / Material minimum. Never ship a smaller tap target. */
  minTouchTarget: 44,
} as const;

/**
 * Absolute fill.
 *
 * `StyleSheet.absoluteFillObject` is gone from React Native 0.86's types, and
 * `absoluteFill` is a registered style id that cannot be spread.
 */
export const absoluteFill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

export const typography = {
  title: 48,
  screenTitle: 32,
  button: 18,
  hudValue: 28,
  hudLabel: 12,
  body: 16,
} as const;

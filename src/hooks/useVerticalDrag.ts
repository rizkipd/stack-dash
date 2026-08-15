import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

/**
 * One-finger vertical drag — the game's only control.
 *
 * **Incremental, not absolute.** Each event applies its own `changeY` to the
 * stack's current commanded position. Two consequences, both deliberate:
 *
 *   - The stack never teleports to the finger. Absolute positioning would
 *     snap it the instant a thumb lands anywhere but exactly on it, which at
 *     Insane speed is an instant, unearned death.
 *   - No start position has to be captured, so the hook holds no mutable
 *     state at all and the gesture object stays trivially stable.
 *
 * `runOnJS(true)` is correct here rather than a concession: the simulation
 * lives on the JS thread, so handling the gesture there avoids a thread hop
 * per event.
 */
export type VerticalDragOptions = {
  /** The stack's current commanded centre, in world units. */
  getTargetY: () => number;
  /** Converts a screen-space delta into world units. */
  screenToWorldDelta: (screenDelta: number) => number;
  onTargetY: (worldY: number) => void;
  enabled?: boolean;
};

export function useVerticalDrag({
  getTargetY,
  screenToWorldDelta,
  onTargetY,
  enabled = true,
}: VerticalDragOptions) {
  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .runOnJS(true)
        // Respond immediately: a distance threshold would add input lag to the
        // only control the game has.
        .minDistance(0)
        // `onChange` rather than `onUpdate`: it carries the per-event delta,
        // which is exactly what incremental dragging needs.
        .onChange((event) => {
          onTargetY(getTargetY() + screenToWorldDelta(event.changeY));
        }),
    [enabled, getTargetY, screenToWorldDelta, onTargetY],
  );
}

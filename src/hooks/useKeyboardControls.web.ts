import { useEffect, useRef } from 'react';

import { gameplay } from '@/game/config/gameplay';
import type { KeyboardControlOptions } from './useKeyboardControls';

/** Keyboard travel speed, in world units per second. */
const KEY_SPEED = gameplay.maxVerticalSpeed * 0.55;

const UP_KEYS = new Set(['ArrowUp', 'w', 'W']);
const DOWN_KEYS = new Set(['ArrowDown', 's', 'S']);
const PAUSE_KEYS = new Set([' ', 'Escape', 'p', 'P']);
const RESTART_KEYS = new Set(['r', 'R']);

/**
 * Keyboard controls for the browser preview.
 *
 * Dragging with a mouse is a poor stand-in for a thumb, so the web build also
 * accepts the keyboard. This is a **development convenience only** — the
 * shipping control scheme is the one-finger drag, and nothing here exists on
 * iOS or Android.
 *
 * Movement is held-key based rather than per-keypress: a tap-to-nudge control
 * would feel nothing like the continuous drag the game is balanced around.
 */
export function useKeyboardControls({
  getTargetY,
  setTargetY,
  onTogglePause,
  onRestart,
  enabled = true,
}: KeyboardControlOptions): void {
  // Handlers change every render; the listeners must not be torn down and
  // rebuilt each time or held keys get stuck.
  const handlers = useRef({ getTargetY, setTargetY, onTogglePause, onRestart });
  useEffect(() => {
    handlers.current = { getTargetY, setTargetY, onTogglePause, onRestart };
  }, [getTargetY, setTargetY, onTogglePause, onRestart]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let up = false;
    let down = false;
    let frame = 0;
    let last = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (PAUSE_KEYS.has(event.key)) {
        event.preventDefault();
        handlers.current.onTogglePause();
        return;
      }
      if (RESTART_KEYS.has(event.key)) {
        event.preventDefault();
        handlers.current.onRestart();
        return;
      }
      if (!enabled) return;

      if (UP_KEYS.has(event.key)) {
        event.preventDefault();
        up = true;
      } else if (DOWN_KEYS.has(event.key)) {
        event.preventDefault();
        down = true;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (UP_KEYS.has(event.key)) up = false;
      if (DOWN_KEYS.has(event.key)) down = false;
    };

    // Losing focus mid-hold would otherwise leave the stack travelling forever.
    const onBlur = () => {
      up = false;
      down = false;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (last === 0) {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;

      const direction = (up ? -1 : 0) + (down ? 1 : 0);
      if (direction !== 0 && enabled) {
        handlers.current.setTargetY(
          handlers.current.getTargetY() + direction * KEY_SPEED * dt,
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
}

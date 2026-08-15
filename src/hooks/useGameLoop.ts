import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { GameEngine, type FrameEvents } from '@/game/engine/GameEngine';
import { gameplay } from '@/game/config/gameplay';
import {
  buildRenderState,
  createRenderState,
  type RenderState,
} from '@/game/render/renderState';
import type { Difficulty } from '@/game/types';

/** HUD values. Updated far below frame rate — see `HUD_INTERVAL`. */
export type HudState = {
  score: number;
  blocks: number;
  distance: number;
  paused: boolean;
  gameOver: boolean;
};

/**
 * The HUD only needs to look live, not be frame-accurate.
 *
 * Re-rendering React 60 times a second is exactly what
 * `docs/ARCHITECTURE.md` §9 warns against; at 12 Hz the counter still ticks
 * smoothly to the eye and the JS thread stays free for the simulation.
 */
const HUD_INTERVAL = 1 / 12;

export type GameLoopOptions = {
  difficulty: Difficulty;
  width: number;
  height: number;
  seed?: number | undefined;
  onEvents?: ((events: FrameEvents) => void) | undefined;
};

export function useGameLoop({
  difficulty,
  width,
  height,
  seed,
  onEvents,
}: GameLoopOptions) {
  // `useState` with an initialiser, not a ref: the engine must be constructed
  // exactly once, and reading a ref during render is not allowed.
  const [engine] = useState(
    () => new GameEngine(seed === undefined ? { difficulty } : { difficulty, seed }),
  );

  const renderState = useSharedValue<RenderState>(createRenderState());

  // A stable scratch buffer so the hot loop allocates nothing per frame.
  const scratch = useMemo(() => createRenderState(), []);

  const [hud, setHud] = useState<HudState>({
    score: 0,
    blocks: engine.blockCount,
    distance: 0,
    paused: false,
    gameOver: false,
  });

  // The loop must not restart every time the parent re-creates `onEvents`, so
  // it reads through a ref — assigned in an effect, never during render.
  const eventsRef = useRef(onEvents);
  useEffect(() => {
    eventsRef.current = onEvents;
  }, [onEvents]);

  /**
   * World → screen mapping. Derived purely from the viewport, so it is a
   * `useMemo` value rather than a ref; the loop below simply restarts if the
   * device rotates or the window resizes.
   */
  const geometry = useMemo(() => {
    // Uniform scale — the world must not distort between aspect ratios.
    const scale = height / gameplay.worldHeight;
    return {
      scale,
      // Keeps the player column at the same fraction of the screen on any phone.
      offsetX: width * 0.22 - gameplay.playerX * scale,
      offsetY: 0,
    };
  }, [width, height]);

  useEffect(() => {
    let frame: number;
    let last = 0;
    let hudAccumulator = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      frame = requestAnimationFrame(tick);

      // The first frame has no previous timestamp; skip it rather than feeding
      // the engine a garbage delta.
      if (last === 0) {
        last = now;
        return;
      }
      const dt = (now - last) / 1000;
      last = now;

      const events = engine.update(dt);
      if (events.blocksLost || events.blocksGained || events.gameOver) {
        eventsRef.current?.(events);
      }

      renderState.value = buildRenderState(
        engine,
        geometry.scale,
        geometry.offsetX,
        geometry.offsetY,
        scratch,
      );

      hudAccumulator += dt;
      if (hudAccumulator >= HUD_INTERVAL || events.gameOver) {
        hudAccumulator = 0;
        setHud({
          score: engine.score,
          blocks: engine.blockCount,
          distance: Math.floor(engine.distance / 10),
          paused: engine.phase === 'paused',
          gameOver: engine.phase === 'gameOver',
        });
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [engine, renderState, scratch, geometry]);

  const start = useCallback(() => {
    engine.start();
    setHud((h) => ({ ...h, paused: false }));
  }, [engine]);

  const pause = useCallback(() => {
    engine.pause();
    setHud((h) => ({ ...h, paused: true }));
  }, [engine]);

  const resume = useCallback(() => {
    engine.resume();
    setHud((h) => ({ ...h, paused: false }));
  }, [engine]);

  const restart = useCallback(() => {
    engine.reset(difficulty);
    engine.start();
    setHud({
      score: 0,
      blocks: engine.blockCount,
      distance: 0,
      paused: false,
      gameOver: false,
    });
  }, [engine, difficulty]);

  const setTargetY = useCallback(
    (worldY: number) => engine.setTargetY(worldY),
    [engine],
  );

  /** Screen distance → world distance. Offsets cancel, so scale alone applies. */
  const screenToWorldDelta = useCallback(
    (screenDelta: number) => screenDelta / geometry.scale,
    [geometry],
  );

  /** The stack's commanded position — what a drag should move, not its eased position. */
  const getTargetY = useCallback(() => engine.targetY, [engine]);

  return {
    engine,
    renderState,
    hud,
    start,
    pause,
    resume,
    restart,
    setTargetY,
    screenToWorldDelta,
    getTargetY,
  };
}

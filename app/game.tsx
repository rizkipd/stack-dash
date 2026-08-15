import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCanvasHost } from '@/components/game/GameCanvasHost';
import { FeedbackBanner, type BannerKind } from '@/components/ui/FeedbackBanner';
import { HUD } from '@/components/ui/HUD';
import { PauseOverlay } from '@/components/ui/PauseOverlay';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { FrameEvents } from '@/game/engine/GameEngine';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useKeyboardControls } from '@/hooks/useKeyboardControls';
import { useVerticalDrag } from '@/hooks/useVerticalDrag';
import {
  configureFeedback,
  feedback,
  initFeedback,
  startMusic,
  stopMusic,
} from '@/feedback';
import { loadHighScores, recordDistance } from '@/storage/highScore';
import { loadSettings, saveSettings } from '@/storage/settings';
import { DIFFICULTIES, type Difficulty } from '@/game/types';
import { colors } from '@/theme/colors';
import { absoluteFill, layout, spacing, typography } from '@/theme/spacing';

function parseDifficulty(value: string | string[] | undefined): Difficulty {
  const raw = Array.isArray(value) ? value[0] : value;
  return DIFFICULTIES.includes(raw as Difficulty) ? (raw as Difficulty) : 'medium';
}

/** Gameplay — MVP Screen 4. */
export default function GameScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty = parseDifficulty(params.difficulty);
  const { width, height } = useWindowDimensions();

  const [best, setBest] = useState(0);
  const [banner, setBanner] = useState<BannerKind>(null);
  const [bannerNonce, setBannerNonce] = useState(0);
  const recorded = useRef(false);

  const showBanner = useCallback((kind: BannerKind) => {
    setBanner(kind);
    setBannerNonce((n) => n + 1);
  }, []);

  // Tracks whether the low-block warning has already fired, so it sounds on
  // crossing the threshold rather than once per frame beneath it.
  const warned = useRef(false);

  const onEvents = useCallback(
    (events: FrameEvents) => {
      if (events.blocksLost > 0) {
        feedback.hit(events.blocksLost);
        showBanner('oops');
      }
      if (events.blocksGained > 0) {
        feedback.collect();
        showBanner('great');
      }
      if (events.gameOver) feedback.gameOver();
    },
    [showBanner],
  );

  const {
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
  } = useGameLoop({ difficulty, width, height, onEvents });

  const drag = useVerticalDrag({
    getTargetY,
    screenToWorldDelta,
    onTargetY: setTargetY,
    enabled: !hud.paused && !hud.gameOver,
  });

  const togglePause = useCallback(() => {
    if (hud.gameOver) return;
    feedback.pause();
    if (hud.paused) resume();
    else pause();
  }, [hud.paused, hud.gameOver, pause, resume]);

  /**
   * Start the run immediately.
   *
   * Gameplay must never wait on storage or audio. An earlier version awaited
   * `initFeedback()` before calling `start()`, so anything slow or stuck in
   * audio initialisation left the game frozen on frame one.
   */
  useEffect(() => {
    start();
  }, [start]);

  // Settings, best score and audio load alongside the run, not in front of it.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [settings, scores] = await Promise.all([
          loadSettings(),
          loadHighScores(),
        ]);
        if (cancelled) return;
        configureFeedback(settings);
        setBest(scores[difficulty]);
        void saveSettings({ ...settings, lastDifficulty: difficulty });
        await initFeedback();
        if (cancelled) return;
        startMusic(difficulty);
      } catch {
        // A failure here costs sound and the best-score display, nothing more.
      }
    })();
    return () => {
      cancelled = true;
      stopMusic();
    };
  }, [difficulty]);

  // Low-blocks warning, on the crossing rather than every frame below it.
  useEffect(() => {
    if (hud.gameOver) return;
    if (hud.blocks <= 2 && hud.blocks > 0 && !warned.current) {
      warned.current = true;
      feedback.warningLow();
    } else if (hud.blocks > 2) {
      warned.current = false;
    }
  }, [hud.blocks, hud.gameOver]);

  /**
   * Pause when the app leaves the foreground.
   *
   * The delta clamp already stops a background gap from teleporting the stack
   * through a wall, but resuming mid-run into an obstacle the player never saw
   * is still unfair. QA Plan #15.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);

  // Persist the run's distance exactly once, when it ends.
  useEffect(() => {
    if (!hud.gameOver || recorded.current) return;
    recorded.current = true;
    void recordDistance(difficulty, engine.distance).then(({ scores, isNewBest }) => {
      setBest(scores[difficulty]);
      if (isNewBest) showBanner('newBest');
    });
  }, [hud.gameOver, difficulty, engine, showBanner]);

  const handleRestart = useCallback(() => {
    recorded.current = false;
    warned.current = false;
    setBanner(null);
    feedback.tap();
    startMusic(difficulty);
    restart();
  }, [restart, difficulty]);

  const handleHome = useCallback(() => {
    feedback.back();
    stopMusic();
    router.dismissTo('/');
  }, []);

  // Web-only development convenience; a no-op on iOS and Android.
  useKeyboardControls({
    getTargetY,
    setTargetY,
    onTogglePause: togglePause,
    onRestart: handleRestart,
    enabled: !hud.paused && !hud.gameOver,
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={drag}>
        <View style={StyleSheet.absoluteFill}>
          <GameCanvasHost state={renderState} width={width} height={height} />
        </View>
      </GestureDetector>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <HUD
          score={hud.score}
          best={Math.floor(best / 10)}
          blocks={hud.blocks}
          distance={hud.distance}
          onPause={togglePause}
        />

        <FeedbackBanner kind={banner} nonce={bannerNonce} />

        {hud.paused && !hud.gameOver ? (
          <PauseOverlay
            onResume={() => {
              feedback.tap();
              resume();
            }}
            onRestart={handleRestart}
            onSettings={() => {
              feedback.tap();
              router.push('/settings');
            }}
            onHome={handleHome}
          />
        ) : null}

        {hud.gameOver ? (
          <View style={styles.gameOver}>
            <Text style={styles.gameOverTitle}>GAME OVER</Text>

            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>SCORE</Text>
              <Text style={styles.statValue}>{hud.score}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>BEST</Text>
              <Text style={styles.statBest}>{Math.floor(best / 10)}</Text>
            </View>

            <View style={styles.actions}>
              <PrimaryButton label="RETRY" variant="accent" onPress={handleRestart} />
              <PrimaryButton label="HOME" variant="neutral" onPress={handleHome} />
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  overlay: { ...absoluteFill },
  gameOver: {
    ...absoluteFill,
    backgroundColor: 'rgba(11, 11, 18, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  gameOverTitle: {
    color: colors.danger,
    fontSize: typography.screenTitle,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  statBlock: { alignItems: 'center' },
  statLabel: {
    color: colors.textDim,
    fontSize: typography.hudLabel,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  statValue: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statBest: {
    color: colors.collect,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    width: '100%',
    maxWidth: layout.columnWidth,
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});

/**
 * Sound, music and haptic feedback.
 * Owner: UI/UX (`docs/RACI.md` row 18).
 *
 * Cue set, folder layout and volume mix follow `docs/AUDIO_BRIEF.md`. The
 * shipped audio is synthesised placeholder material — replacing a file in
 * place needs no code change.
 *
 * Sound, music and haptics toggle independently
 * (`docs/ART_DIRECTION.md` §7): a player who mutes the music must still hear
 * the low-blocks warning.
 *
 * Every call is best-effort. Audio is the least important thing happening
 * during a run, so failures are swallowed rather than propagated.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { Difficulty } from '@/game/types';

export type FeedbackSettings = {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
};

/** Volume mix from the sound design sheet. */
const MIX = { sfx: 0.9, ui: 0.8, bgm: 0.7 } as const;

type SfxCue =
  | 'hitSmall'
  | 'hitMedium'
  | 'hitLarge'
  | 'wallImpact'
  | 'blockDestroyed'
  | 'collectBlock'
  | 'stackGrow'
  | 'speedUp'
  | 'warningLow'
  | 'gameOver';

type UiCue =
  | 'buttonClick'
  | 'menuTransition'
  | 'popupOpen'
  | 'backCancel'
  | 'levelSelect'
  | 'levelConfirm'
  | 'lockLevel'
  | 'pause';

const SFX: Record<SfxCue, number> = {
  hitSmall: require('../../assets/audio/gameplay/hit_small.wav') as number,
  hitMedium: require('../../assets/audio/gameplay/hit_medium.wav') as number,
  hitLarge: require('../../assets/audio/gameplay/hit_large.wav') as number,
  wallImpact: require('../../assets/audio/gameplay/wall_impact.wav') as number,
  blockDestroyed: require('../../assets/audio/gameplay/block_destroyed.wav') as number,
  collectBlock: require('../../assets/audio/gameplay/collect_block.wav') as number,
  stackGrow: require('../../assets/audio/gameplay/stack_grow.wav') as number,
  speedUp: require('../../assets/audio/gameplay/speed_up.wav') as number,
  warningLow: require('../../assets/audio/gameplay/warning_low.wav') as number,
  gameOver: require('../../assets/audio/gameplay/game_over.wav') as number,
};

const UI: Record<UiCue, number> = {
  buttonClick: require('../../assets/audio/ui/button_click.wav') as number,
  menuTransition: require('../../assets/audio/ui/menu_transition.wav') as number,
  popupOpen: require('../../assets/audio/ui/popup_open.wav') as number,
  backCancel: require('../../assets/audio/ui/back_cancel.wav') as number,
  levelSelect: require('../../assets/audio/ui/level_select.wav') as number,
  levelConfirm: require('../../assets/audio/ui/level_confirm.wav') as number,
  lockLevel: require('../../assets/audio/ui/lock_level.wav') as number,
  pause: require('../../assets/audio/ui/pause.wav') as number,
};

const BGM: Record<Difficulty, number> = {
  easy: require('../../assets/audio/bgm/easy_theme.wav') as number,
  medium: require('../../assets/audio/bgm/medium_theme.wav') as number,
  hard: require('../../assets/audio/bgm/hard_theme.wav') as number,
  insane: require('../../assets/audio/bgm/insane_theme.wav') as number,
};

let sfxPlayers: Partial<Record<SfxCue, AudioPlayer>> = {};
let uiPlayers: Partial<Record<UiCue, AudioPlayer>> = {};
let music: AudioPlayer | null = null;
let musicTrack: Difficulty | null = null;

let settings: FeedbackSettings = {
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
};
let initialised = false;

export function configureFeedback(next: FeedbackSettings): void {
  settings = next;
  if (music) {
    if (!next.musicEnabled) {
      try {
        music.pause();
      } catch {
        // Already stopped.
      }
    } else {
      try {
        music.play();
      } catch {
        // Nothing to resume.
      }
    }
  }
}

/**
 * Loads every cue once.
 *
 * `playsInSilentMode` is deliberately false: a player who has silenced their
 * phone has asked for silence, and a game is not an exception to that.
 */
export async function initFeedback(): Promise<void> {
  if (initialised) return;
  initialised = true;

  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    });
  } catch {
    // Audio mode is advisory; carry on without it.
  }

  for (const cue of Object.keys(SFX) as SfxCue[]) {
    try {
      const player = createAudioPlayer(SFX[cue]);
      player.volume = MIX.sfx;
      sfxPlayers[cue] = player;
    } catch {
      // A cue that fails to load simply stays silent.
    }
  }
  for (const cue of Object.keys(UI) as UiCue[]) {
    try {
      const player = createAudioPlayer(UI[cue]);
      player.volume = MIX.ui;
      uiPlayers[cue] = player;
    } catch {
      // As above.
    }
  }
}

export function releaseFeedback(): void {
  for (const player of [
    ...Object.values(sfxPlayers),
    ...Object.values(uiPlayers),
    music,
  ]) {
    try {
      player?.remove();
    } catch {
      // Already gone.
    }
  }
  sfxPlayers = {};
  uiPlayers = {};
  music = null;
  musicTrack = null;
  initialised = false;
}

function play(player: AudioPlayer | undefined): void {
  if (!settings.soundEnabled || !player) return;
  try {
    // Rewind first: cues fire in rapid succession, and a player still mid-cue
    // would otherwise ignore the new one.
    void player.seekTo(0);
    player.play();
  } catch {
    // Never let a sound failure reach the game loop.
  }
}

function impact(style: Haptics.ImpactFeedbackStyle): void {
  if (!settings.hapticsEnabled || Platform.OS === 'web') return;
  // Android haptic support is inconsistent enough that failure is expected
  // rather than exceptional.
  void Haptics.impactAsync(style).catch(() => undefined);
}

/** Starts or swaps the looping background track for a difficulty. */
export function startMusic(difficulty: Difficulty): void {
  if (musicTrack === difficulty && music) {
    if (settings.musicEnabled) {
      try {
        music.play();
      } catch {
        // Ignore.
      }
    }
    return;
  }

  try {
    music?.remove();
  } catch {
    // Ignore.
  }

  try {
    music = createAudioPlayer(BGM[difficulty]);
    music.volume = MIX.bgm;
    music.loop = true;
    musicTrack = difficulty;
    if (settings.musicEnabled) music.play();
  } catch {
    music = null;
    musicTrack = null;
  }
}

export function stopMusic(): void {
  try {
    music?.pause();
  } catch {
    // Ignore.
  }
}

export const feedback = {
  /** Blocks destroyed. Cue weight and haptic strength track the size of the hit. */
  hit(blocksLost: number): void {
    if (blocksLost >= 4) {
      play(sfxPlayers.hitLarge);
      impact(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (blocksLost >= 2) {
      play(sfxPlayers.hitMedium);
      impact(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      play(sfxPlayers.hitSmall);
      impact(Haptics.ImpactFeedbackStyle.Light);
    }
  },

  collect(): void {
    play(sfxPlayers.collectBlock);
    impact(Haptics.ImpactFeedbackStyle.Light);
  },

  /** Stack down to its last blocks. Fires regardless of the music setting. */
  warningLow(): void {
    play(sfxPlayers.warningLow);
    impact(Haptics.ImpactFeedbackStyle.Rigid);
  },

  speedUp(): void {
    play(sfxPlayers.speedUp);
  },

  gameOver(): void {
    stopMusic();
    play(sfxPlayers.gameOver);
    if (!settings.hapticsEnabled || Platform.OS === 'web') return;
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Error,
    ).catch(() => undefined);
  },

  tap(): void {
    play(uiPlayers.buttonClick);
    impact(Haptics.ImpactFeedbackStyle.Light);
  },

  levelSelect(): void {
    play(uiPlayers.levelSelect);
    impact(Haptics.ImpactFeedbackStyle.Light);
  },

  levelConfirm(): void {
    play(uiPlayers.levelConfirm);
    impact(Haptics.ImpactFeedbackStyle.Medium);
  },

  locked(): void {
    play(uiPlayers.lockLevel);
  },

  back(): void {
    play(uiPlayers.backCancel);
  },

  pause(): void {
    play(uiPlayers.pause);
    impact(Haptics.ImpactFeedbackStyle.Light);
  },

  transition(): void {
    play(uiPlayers.menuTransition);
  },
};

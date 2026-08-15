import type { SharedValue } from 'react-native-reanimated';

import { GameCanvas } from './GameCanvas';
import type { RenderState } from '@/game/render/renderState';

export type GameCanvasHostProps = {
  state: SharedValue<RenderState>;
  width: number;
  height: number;
};

/**
 * Gameplay canvas — native.
 *
 * On iOS and Android, Skia is a real native module, so the canvas renders
 * immediately with nothing to wait for.
 *
 * The web build resolves `GameCanvasHost.web.tsx` instead, where Skia is
 * CanvasKit and has to be loaded first. That split is done with Metro's
 * platform extensions rather than a `Platform.OS` branch because merely
 * *importing* the Skia web entry point fails to resolve on native.
 */
export function GameCanvasHost(props: GameCanvasHostProps) {
  return <GameCanvas {...props} />;
}

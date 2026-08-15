import {
  BlendMode,
  BlurStyle,
  Canvas,
  LinearGradient,
  PaintStyle,
  Picture,
  RadialGradient,
  Rect,
  Skia,
  StrokeCap,
  StrokeJoin,
  createPicture,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import {
  BLOOM_COLORS,
  BLOOM_STOPS,
  SKY_COLORS,
  SKY_STOPS,
  drawScene,
  type SceneEnums,
} from './scene';
import type { RenderState } from '@/game/render/renderState';

type Props = {
  state: SharedValue<RenderState>;
  width: number;
  height: number;
};

/**
 * Skia enum values, resolved once on the JS thread.
 *
 * Worklets capture plain numbers trivially; they should not be reaching into
 * enum objects on the UI thread.
 */
const ENUMS: SceneEnums = {
  strokeStyle: PaintStyle.Stroke,
  blendPlus: BlendMode.Plus,
  blurNormal: BlurStyle.Normal,
  capRound: StrokeCap.Round,
  joinRound: StrokeJoin.Round,
};

/**
 * The gameplay renderer.
 *
 * Everything dynamic is drawn into a single `SkPicture` inside a worklet, so
 * the whole scene renders on the UI thread and React never re-renders during
 * play (`docs/ARCHITECTURE.md` §9). The simulation writes `state` once per
 * frame; this reads it.
 *
 * The drawing itself lives in `./scene`, shared verbatim with the offline
 * preview harness (`scripts/preview.mjs`). Rendering used to be unverifiable —
 * two bugs shipped that typechecked, linted and bundled cleanly while drawing
 * the wrong thing. `npm run preview` is what stops that recurring.
 */
export function GameCanvas({ state, width, height }: Props) {
  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      drawScene(Skia, canvas, state.value, width, height, ENUMS);
    }),
  );

  return (
    <Canvas style={{ width, height }}>
      {/* Static and full-screen, so these are declarative children rather than
          worklet draws — re-recording them every frame would be pure waste. */}
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={SKY_COLORS}
          positions={SKY_STOPS}
        />
      </Rect>
      <Rect
        x={0}
        y={height * 0.715 - width * 1.05}
        width={width}
        height={width * 2.1}
      >
        <RadialGradient
          c={vec(width * 0.55, height * 0.715)}
          r={width * 1.05}
          colors={BLOOM_COLORS}
          positions={BLOOM_STOPS}
        />
      </Rect>
      <Picture picture={picture} />
    </Canvas>
  );
}

/** Default export so `WithSkiaWeb` can lazy-load this module on web. */
export default GameCanvas;

/* TEMPORARY TYPECHECK DRAFT — delete after verification. */
import {
  Canvas,
  LinearGradient,
  Picture,
  RadialGradient,
  Rect,
  Skia,
  createPicture,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { type RenderState } from '@/game/render/renderState';
import { colors } from '@/theme/colors';

type Props = {
  state: SharedValue<RenderState>;
  width: number;
  height: number;
};

const HORIZON = 0.82;

const SKY_COLORS = [
  '#07061A',
  colors.bgTop,
  colors.bgMid,
  '#6D2477',
  colors.bgBottom,
  '#3B0F2B',
  colors.ground,
];

const SKY_STOPS = [0, 0.3, 0.6, 0.76, HORIZON, 0.9, 1];

const BLOOM_COLORS = ['rgba(214, 72, 158, 0.24)', 'rgba(214, 72, 158, 0)'];
const BLOOM_STOPS = [0, 1];

const background = {
  haze: '#6D2477',
  windowWarm: '#F5B942',
  windowCool: '#B9A8F5',
  road: colors.accent,
};

const NOISE: readonly number[] = [
  0.972, 0.25, 0.781, 0.689, 0.798, 0.812, 0.132, 0.49, 0.196, 0.219, 0.15,
  0.233, 0.399, 0.569, 0.678, 0.87, 0.492, 0.639, 0.641, 0.722, 0.588, 0.759,
  0.428, 0.35, 0.194, 0.691, 0.263, 0.433, 0.595, 0.502, 0.581, 0.644, 0.221,
  0.437, 0.404, 0.52, 0.027, 0.795, 0.157, 0.332, 0.965, 0.682, 0.252, 0.696,
  0.561, 0.882, 0.666, 0.67, 0.84, 0.796, 0.159, 0.083, 0.082, 0.328, 0.667,
  0.099, 0.9, 0.436, 0.786, 0.177, 0.199, 0.671, 0.938, 0.151,
];

type SkylineLayer = {
  rate: number;
  cells: number;
  hMin: number;
  hMax: number;
  tint: string;
  alpha: number;
  salt: number;
  winCols: number;
  winRows: number;
  veilSteps: number;
  veilAlpha: number;
  veilSpan: number;
  caps: boolean;
};

const SKYLINE: readonly SkylineLayer[] = [
  {
    rate: 0.05,
    cells: 15,
    hMin: 0.05,
    hMax: 0.13,
    tint: '#2E2059',
    alpha: 0.42,
    salt: 0,
    winCols: 0,
    winRows: 0,
    veilSteps: 8,
    veilAlpha: 0.34,
    veilSpan: 0.2,
    caps: false,
  },
  {
    rate: 0.11,
    cells: 10,
    hMin: 0.09,
    hMax: 0.2,
    tint: '#1C1242',
    alpha: 0.86,
    salt: 5,
    winCols: 2,
    winRows: 4,
    veilSteps: 6,
    veilAlpha: 0.16,
    veilSpan: 0.16,
    caps: false,
  },
  {
    rate: 0.22,
    cells: 6,
    hMin: 0.13,
    hMax: 0.3,
    tint: '#120B2A',
    alpha: 1,
    salt: 11,
    winCols: 3,
    winRows: 5,
    veilSteps: 0,
    veilAlpha: 0,
    veilSpan: 0,
    caps: true,
  },
];

const HORIZON_SHIMMER = 0.08;

export function BgDraft({ state, width, height }: Props) {
  const picture = useDerivedValue(() => {
    const s = state.value;

    return createPicture((canvas) => {
      const { scale } = s;

      const bgPaint = Skia.Paint();

      const horizonY = Math.round(height * HORIZON);

      const bgRect = { x: 0, y: 0, width: 0, height: 0 };
      const fill = (x: number, y: number, w: number, h: number) => {
        bgRect.x = x;
        bgRect.y = y;
        bgRect.width = w;
        bgRect.height = h;
        canvas.drawRect(bgRect, bgPaint);
      };

      const noise = (index: number, salt: number) =>
        NOISE[((((index * 7 + salt * 13) % 64) + 64) % 64)]!;

      const veil = (top: number, bottom: number, steps: number, peak: number) => {
        for (let k = 0; k < steps; k += 1) {
          const y0 = Math.round(top + ((bottom - top) * k) / steps);
          const y1 = Math.round(top + ((bottom - top) * (k + 1)) / steps);
          bgPaint.setAlphaf((peak * (k + 0.5)) / steps);
          fill(0, y0, width, y1 - y0);
        }
      };

      const hazeColor = Skia.Color(background.haze);
      const warmColor = Skia.Color(background.windowWarm);
      const coolColor = Skia.Color(background.windowCool);
      const roadColor = Skia.Color(background.road);
      const groundColor = Skia.Color(colors.ground);

      for (let li = 0; li < SKYLINE.length; li += 1) {
        const layer = SKYLINE[li]!;
        const cellW = width / layer.cells;
        const offset = s.distance * layer.rate * scale;
        const base = Math.floor(offset / cellW);
        const scroll = offset - base * cellW;
        const count = layer.cells + 2;

        const warmPath = layer.winCols > 0 ? Skia.Path.Make() : null;
        const coolPath = layer.winCols > 0 ? Skia.Path.Make() : null;
        const capPath = layer.caps ? Skia.Path.Make() : null;

        bgPaint.setColor(Skia.Color(layer.tint));
        bgPaint.setAlphaf(layer.alpha);

        for (let k = -1; k < count; k += 1) {
          const world = base + k;
          const nH = noise(world, layer.salt);
          const nW = noise(world, layer.salt + 1);
          const nS = noise(world, layer.salt + 2);

          const bh = Math.round(
            height * (layer.hMin + nH * (layer.hMax - layer.hMin)),
          );
          const bw = Math.round(cellW * (0.6 + nW * 0.3));
          const bx = Math.round(k * cellW - scroll + (cellW - bw) * 0.5);
          const by = horizonY - bh;

          if (bx > width || bx + bw < 0) continue;

          fill(bx, by, bw, bh);

          if (capPath && nS > 0.45) {
            const cw = Math.round(bw * (0.32 + nS * 0.24));
            const ch = Math.round(bh * (0.08 + nS * 0.1));
            capPath.addRect({
              x: bx + Math.round((bw - cw) * (0.2 + nW * 0.6)),
              y: by - ch,
              width: cw,
              height: ch,
            });
          }

          if (!warmPath || !coolPath) continue;

          const pad = Math.max(2, bw * 0.14);
          const gridW = bw - pad * 2;
          const cw = gridW / (layer.winCols * 2 - 1);
          const top = by + Math.max(4, bh * 0.12);
          const gridH = bh * 0.74;
          const rh = gridH / (layer.winRows * 2 - 1);
          if (cw < 1 || rh < 1) continue;

          for (let c = 0; c < layer.winCols; c += 1) {
            for (let rIdx = 0; rIdx < layer.winRows; rIdx += 1) {
              const lit = noise(world * 5 + c * 3 + rIdx * 11, layer.salt + 4);
              if (lit < 0.38) continue;
              const wx = bx + pad + c * cw * 2;
              const wy = top + rIdx * rh * 2;
              const target = lit > 0.86 ? coolPath : warmPath;
              target.addRect({ x: wx, y: wy, width: cw, height: rh });
            }
          }
        }

        if (warmPath && coolPath) {
          bgPaint.setColor(warmColor);
          bgPaint.setAlphaf(0.4 * layer.alpha);
          canvas.drawPath(warmPath, bgPaint);
          bgPaint.setColor(coolColor);
          bgPaint.setAlphaf(0.22 * layer.alpha);
          canvas.drawPath(coolPath, bgPaint);
        }

        if (capPath) {
          bgPaint.setColor(Skia.Color(layer.tint));
          bgPaint.setAlphaf(layer.alpha);
          canvas.drawPath(capPath, bgPaint);
        }

        if (layer.veilSteps > 0) {
          bgPaint.setColor(hazeColor);
          veil(
            horizonY - height * layer.veilSpan,
            horizonY,
            layer.veilSteps,
            layer.veilAlpha,
          );
        }
      }

      bgPaint.setColor(groundColor);
      bgPaint.setAlphaf(1);
      fill(0, horizonY, width, height - horizonY);

      bgPaint.setColor(hazeColor);
      const spill = Math.round(height * 0.05);
      bgPaint.setAlphaf(0.12);
      fill(0, horizonY, width, Math.round(spill * 0.45));
      bgPaint.setAlphaf(0.05);
      fill(
        0,
        horizonY + Math.round(spill * 0.45),
        width,
        spill - Math.round(spill * 0.45),
      );

      const breathe = 1 - HORIZON_SHIMMER + HORIZON_SHIMMER * Math.sin(s.elapsed * 0.9);
      bgPaint.setColor(roadColor);
      bgPaint.setAlphaf(0.06 * breathe);
      fill(0, horizonY - 9, width, 9);
      bgPaint.setAlphaf(0.16 * breathe);
      fill(0, horizonY - 3, width, 3);
      bgPaint.setAlphaf(0.5 * breathe);
      fill(0, horizonY - 1, width, 2);
    });
  });

  return (
    <Canvas style={{ width, height }}>
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
        y={height * HORIZON - width * 0.95}
        width={width}
        height={width * 1.9}
      >
        <RadialGradient
          c={vec(width * 0.58, height * HORIZON)}
          r={width * 0.95}
          colors={BLOOM_COLORS}
          positions={BLOOM_STOPS}
        />
      </Rect>
      <Picture picture={picture} />
    </Canvas>
  );
}

export default BgDraft;

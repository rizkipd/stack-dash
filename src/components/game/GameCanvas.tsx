import {
  Canvas,
  Fill,
  Picture,
  Skia,
  createPicture,
  type SkCanvas,
  type SkPaint,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import {
  BLOCK_STRIDE,
  COLLECTIBLE_STRIDE,
  OBSTACLE_STRIDE,
  PARTICLE_STRIDE,
  type RenderState,
} from '@/game/render/renderState';
import { PARTICLE_CORE, PARTICLE_STAR } from '@/game/engine/Particles';
import { colors } from '@/theme/colors';

type Props = {
  state: SharedValue<RenderState>;
  width: number;
  height: number;
};

/**
 * Unit cube corners. Index bits are (x, y, z), each −1 or +1.
 * Shared by every cube; only the rotation differs.
 */
const CUBE_VERTS: readonly (readonly [number, number, number])[] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];

/** Faces as vertex indices, wound so the normal points outward. */
const CUBE_FACES: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 3], // back  (−z)
  [5, 4, 7, 6], // front (+z)
  [4, 0, 3, 7], // left  (−x)
  [1, 5, 6, 2], // right (+x)
  [4, 5, 1, 0], // top   (−y)
  [3, 2, 6, 7], // bottom(+y)
];

/** Camera distance in half-cube units. Larger = weaker perspective. */
const CAMERA_Z = 5.2;

/**
 * The gameplay renderer.
 *
 * Everything dynamic is drawn into a single `SkPicture` inside a worklet, so
 * the whole scene renders on the UI thread and React never re-renders during
 * play (`docs/ARCHITECTURE.md` §9). The simulation writes `state` once per
 * frame; this reads it.
 *
 * Blocks are genuinely 3D: eight vertices are rotated about the X and Y axes,
 * projected with weak perspective, then the visible faces are drawn back to
 * front with per-face lighting. That is what produces the continuous 360°
 * tumble in the reference sheet, rather than faking depth with a fixed bevel.
 */
export function GameCanvas({ state, width, height }: Props) {
  const picture = useDerivedValue(() => {
    const s = state.value;

    return createPicture((canvas) => {
      const { scale, offsetX, offsetY } = s;

      // --- Paints, created once per frame rather than per shape. ---
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      const glowPaint = Skia.Paint();
      glowPaint.setAntiAlias(true);
      const skylinePaint = Skia.Paint();

      const toX = (x: number) => x * scale + offsetX;
      const toY = (y: number) => y * scale + offsetY;

      /**
       * Draws one rotated cube.
       *
       * `shade` scales each face's brightness so the tumble is legible: a cube
       * lit identically on all faces reads as a flat hexagon while it spins.
       */
      const drawCube = (
        cx: number,
        cy: number,
        size: number,
        rotX: number,
        rotY: number,
        rotZ: number,
        r: number,
        g: number,
        b: number,
        alpha: number,
        target: SkPaint,
        surface: SkCanvas,
      ) => {
        const half = size / 2;
        const sinX = Math.sin(rotX);
        const cosX = Math.cos(rotX);
        const sinY = Math.sin(rotY);
        const cosY = Math.cos(rotY);
        const sinZ = Math.sin(rotZ);
        const cosZ = Math.cos(rotZ);

        const px: number[] = [];
        const py: number[] = [];
        const pz: number[] = [];

        for (let i = 0; i < 8; i += 1) {
          const v = CUBE_VERTS[i]!;
          let x = v[0];
          let y = v[1];
          let z = v[2];

          // Rotate about Y, then X — the two axes the sheet specifies.
          const x1 = x * cosY + z * sinY;
          const z1 = -x * sinY + z * cosY;
          const y2 = y * cosX - z1 * sinX;
          const z2 = y * sinX + z1 * cosX;

          // Lean about Z, driven by vertical velocity.
          x = x1 * cosZ - y2 * sinZ;
          y = x1 * sinZ + y2 * cosZ;
          z = z2;

          // Weak perspective: nearer faces grow slightly.
          const depth = CAMERA_Z / (CAMERA_Z - z);
          px[i] = cx + x * half * depth;
          py[i] = cy + y * half * depth;
          pz[i] = z;
        }

        // Painter's algorithm: sort faces by mean depth, draw far ones first.
        const order = [0, 1, 2, 3, 4, 5];
        const depths = order.map((f) => {
          const face = CUBE_FACES[f]!;
          return (pz[face[0]]! + pz[face[1]]! + pz[face[2]]! + pz[face[3]]!) / 4;
        });
        order.sort((a, b) => depths[a]! - depths[b]!);

        for (const faceIndex of order) {
          const face = CUBE_FACES[faceIndex]!;
          const ax = px[face[0]]!;
          const ay = py[face[0]]!;
          const bx = px[face[1]]!;
          const by = py[face[1]]!;
          const dx = px[face[3]]!;
          const dy = py[face[3]]!;

          // Screen-space winding tells us if the face points away from us.
          const cross = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
          if (cross <= 0) continue;

          // Brightness from the face's depth: nearer reads lighter.
          const meanDepth = depths[faceIndex]!;
          const shade = 0.55 + 0.45 * ((meanDepth + 1) / 2);

          const path = Skia.Path.Make();
          path.moveTo(ax, ay);
          path.lineTo(bx, by);
          path.lineTo(px[face[2]]!, py[face[2]]!);
          path.lineTo(dx, dy);
          path.close();

          target.setColor(
            Skia.Color(
              `rgba(${Math.round(r * shade)}, ${Math.round(g * shade)}, ${Math.round(
                b * shade,
              )}, ${alpha})`,
            ),
          );
          surface.drawPath(path, target);
        }
      };

      // --- Parallax skyline. Decorative only: it never implies a surface. ---
      // Three layers at different rates, per the sheet's BACKGROUND LAYERS.
      const layers = [
        { rate: 0.06, h: 0.34, tint: '#150C2E', block: 190 },
        { rate: 0.13, h: 0.26, tint: '#1C0F3D', block: 150 },
        { rate: 0.24, h: 0.18, tint: '#251350', block: 110 },
      ];
      for (const layer of layers) {
        skylinePaint.setColor(Skia.Color(layer.tint));
        const scroll = (s.distance * layer.rate * scale) % layer.block;
        const count = Math.ceil(width / layer.block) + 2;
        for (let i = -1; i < count; i += 1) {
          const bx = i * layer.block - scroll;
          const bh = height * layer.h * (0.55 + ((i * 7919) % 100) / 220);
          skylinePaint.setAlphaf(1);
          canvas.drawRect(
            Skia.XYWHRect(bx, height - bh, layer.block * 0.72, bh),
            skylinePaint,
          );
        }
      }

      // Ground / road glow line.
      skylinePaint.setColor(Skia.Color(colors.accent));
      skylinePaint.setAlphaf(0.35);
      canvas.drawRect(Skia.XYWHRect(0, height - 3, width, 3), skylinePaint);

      // --- Screen shake. Applied to gameplay only, never the background,
      //     so the play field stays readable. ---
      canvas.save();
      if (s.shake > 0) {
        const amp = s.shake * 6;
        canvas.translate(
          Math.sin(s.elapsed * 90) * amp,
          Math.cos(s.elapsed * 77) * amp,
        );
      }

      // --- Obstacles: dark columns with a lit top edge so the opening
      //     boundary is unmistakable at speed. ---
      const obstacles = s.obstacles;
      for (let i = 0; i < obstacles.length; i += OBSTACLE_STRIDE) {
        const x = toX(obstacles[i]!);
        const y = toY(obstacles[i + 1]!);
        const w = obstacles[i + 2]! * scale;
        const h = obstacles[i + 3]! * scale;
        if (x > width || x + w < 0) continue;

        paint.setColor(Skia.Color(colors.obstacle));
        canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);

        // Panel seams, so a tall wall does not read as a flat slab.
        paint.setColor(Skia.Color(colors.obstacleEdge));
        paint.setAlphaf(0.55);
        const step = w;
        for (let sy = y + step; sy < y + h; sy += step) {
          canvas.drawRect(Skia.XYWHRect(x, sy, w, 1.5), paint);
        }
        paint.setAlphaf(1);
        canvas.drawRect(Skia.XYWHRect(x, y, w, 3), paint);
        canvas.drawRect(Skia.XYWHRect(x, y + h - 3, w, 3), paint);
      }

      // --- Collectibles: cyan cube inside a soft bloom, tumbling. ---
      const items = s.collectibles;
      for (let i = 0; i < items.length; i += COLLECTIBLE_STRIDE) {
        const cx = toX(items[i]!);
        const cy = toY(items[i + 1]!);
        const size = items[i + 2]! * scale;
        const pulse = items[i + 3]!;
        if (cx > width + size || cx < -size) continue;

        glowPaint.setColor(Skia.Color(colors.collectGlow));
        glowPaint.setAlphaf(0.16 + pulse * 0.2);
        canvas.drawCircle(cx, cy, size * (0.9 + pulse * 0.35), glowPaint);

        const spin = s.elapsed * 1.4;
        drawCube(cx, cy, size, spin * 0.6, spin, 0, 34, 211, 238, 1, paint, canvas);
      }

      // --- Player stack. Drawn top-down so lower cubes overlap the ones
      //     above, which is what reads as depth. ---
      const blocks = s.blocks;
      const blockCount = blocks.length / BLOCK_STRIDE;
      for (let i = blockCount - 1; i >= 0; i -= 1) {
        const o = i * BLOCK_STRIDE;
        const size = blocks[o + 2]! * scale;
        const cx = toX(blocks[o]!) + size / 2;
        const cy = toY(blocks[o + 1]!) + size / 2;
        const trail = blocks[o + 6]!;

        // Speed trail: a faint echo behind each cube as the run accelerates.
        if (trail > 0.02) {
          glowPaint.setColor(Skia.Color(colors.block));
          glowPaint.setAlphaf(trail * 0.28);
          canvas.drawCircle(cx - size * 0.5 * trail, cy, size * 0.52, glowPaint);
        }

        // Emissive halo, matching the sheet's glowing neon cubes.
        glowPaint.setColor(Skia.Color(colors.blockLight));
        glowPaint.setAlphaf(0.14);
        canvas.drawCircle(cx, cy, size * 0.78, glowPaint);

        drawCube(
          cx,
          cy,
          size,
          blocks[o + 3]!,
          blocks[o + 4]!,
          blocks[o + 5]!,
          59,
          130,
          246,
          1,
          paint,
          canvas,
        );
      }

      // --- Particles: tumbling debris, the detached block, and sparkles. ---
      const particles = s.particles;
      for (let i = 0; i < particles.length; i += PARTICLE_STRIDE) {
        const px2 = toX(particles[i]!);
        const py2 = toY(particles[i + 1]!);
        const size = particles[i + 2]! * scale;
        const rotation = particles[i + 3]!;
        const alpha = particles[i + 4]!;
        const kind = particles[i + 5]!;

        if (kind === PARTICLE_STAR) {
          paint.setColor(Skia.Color(colors.collectGlow));
          paint.setAlphaf(alpha);
          canvas.drawCircle(px2, py2, size * (0.4 + alpha * 0.6), paint);
          continue;
        }

        if (kind === PARTICLE_CORE) {
          // Stage 2: a white-hot flash on the first frames, then red.
          const flash = alpha > 0.88;
          const cr = flash ? 255 : 239;
          const cg = flash ? 220 : 68;
          const cb = flash ? 220 : 68;
          drawCube(
            px2,
            py2,
            size,
            rotation * 0.7,
            rotation,
            0,
            cr,
            cg,
            cb,
            alpha,
            paint,
            canvas,
          );
          continue;
        }

        paint.setColor(Skia.Color(colors.blockLost));
        paint.setAlphaf(alpha);
        canvas.save();
        canvas.translate(px2, py2);
        canvas.rotate((rotation * 180) / Math.PI, 0, 0);
        canvas.drawRect(
          Skia.XYWHRect(-size / 2, -size / 2, size, size),
          paint,
        );
        canvas.restore();
      }

      canvas.restore();
    });
  });

  return (
    <Canvas style={{ width, height }}>
      <Fill color={colors.bgMid} />
      <Picture picture={picture} />
    </Canvas>
  );
}

/** Default export so `WithSkiaWeb` can lazy-load this module on web. */
export default GameCanvas;

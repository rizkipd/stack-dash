import {
  BlendMode,
  BlurStyle,
  Canvas,
  Fill,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  StrokeJoin,
  createPicture,
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

/**
 * Cube edges as `[vertexA, vertexB, faceA, faceB]`.
 *
 * An edge is drawn when either adjacent face is visible, which yields each
 * visible edge exactly once. That matters: the neon passes blend additively,
 * so an edge emitted twice would burn twice as bright and the silhouette would
 * read dimmer than the interior seams.
 */
const CUBE_EDGES: readonly number[] = [
  0, 1, 0, 4,
  1, 2, 0, 3,
  2, 3, 0, 5,
  3, 0, 0, 2,
  4, 5, 1, 4,
  5, 6, 1, 3,
  6, 7, 1, 5,
  7, 4, 1, 2,
  0, 4, 2, 4,
  1, 5, 3, 4,
  2, 6, 3, 5,
  3, 7, 2, 5,
];

/** Camera distance in half-cube units. Larger = weaker perspective. */
const CAMERA_Z = 5.2;

// --- Lighting ---
// Key light from upper-left, slightly toward the viewer. Screen y is down, so
// a negative Y component reads as "from above".
const LIGHT_X = -0.42;
const LIGHT_Y = -0.66;
const LIGHT_Z = 0.62;

/** Floor brightness. Never 0 — a neon cube's dark side still emits. */
const CUBE_AMBIENT = 0.18;
const CUBE_DIFFUSE = 0.5;
/**
 * Rim/fresnel term. Faces turning edge-on catch light, which is what makes a
 * cube read as glowing volume rather than a painted hexagon.
 */
const CUBE_RIM = 0.3;
/** Nearer faces run slightly hotter, separating them at a glance. */
const CUBE_DEPTH_LIFT = 0.07;
/**
 * Quantisation of the shade ramp. Faces are flat-shaded, so 12 steps is well
 * past visible banding — and it lets every colour be precomputed once per
 * frame instead of once per face.
 */
const SHADE_STEPS = 12;

// --- Neon passes ---
// Widths are fractions of the cube's screen size, so the look survives any
// device scale.
const BLOOM_WIDTH = 0.13;
const BLOOM_ALPHA = 0.5;
const TUBE_WIDTH = 0.055;
const TUBE_ALPHA = 0.45;
const CORE_WIDTH = 0.03;
const CORE_MIN_WIDTH = 1.1;
const BLOOM_SIGMA = 0.09;

/**
 * Halo behind a player cube. Deliberately tight and low-alpha: an obstacle
 * edge behind it must stay readable (`docs/ART_DIRECTION.md` §1).
 */
const HALO_RADIUS = 0.58;
const HALO_ALPHA = 0.2;

// Enum members hoisted to plain numbers — worklets capture numbers trivially.
const STYLE_STROKE = PaintStyle.Stroke;
const BLEND_PLUS = BlendMode.Plus;
const BLUR_NORMAL = BlurStyle.Normal;
const CAP_ROUND = StrokeCap.Round;
const JOIN_ROUND = StrokeJoin.Round;

/**
 * A cube's colour set.
 *
 * **Colour is a render parameter, not a constant** (`docs/ART_DIRECTION.md`
 * §3). A post-MVP skin is a new `CubeSkin` literal, never an edit to
 * `drawCube`. These move to `src/theme/skins.ts` the moment a second skin
 * exists.
 */
export type CubeSkin = {
  /**
   * Face turned away from the light. Never black — crushing the dark side to
   * black is part of what made the old cubes read as grey polygons.
   */
  shadow: readonly [number, number, number];
  body: readonly [number, number, number];
  highlight: readonly [number, number, number];
  /** Neon edge core. Near-white, so the silhouette survives any background. */
  edge: readonly [number, number, number];
  glow: readonly [number, number, number];
};

/** `#rrggbb` → 0..1 components. Module load, JS thread, never in the worklet. */
function rgb01(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const PLAYER_SKIN: CubeSkin = {
  shadow: rgb01(colors.blockDark),
  body: rgb01(colors.block),
  highlight: rgb01(colors.blockLight),
  edge: [0.84, 0.97, 1],
  glow: rgb01(colors.collect),
};

const COLLECT_SKIN: CubeSkin = {
  shadow: [0.05, 0.4, 0.48],
  body: rgb01(colors.collect),
  highlight: rgb01(colors.collectGlow),
  edge: [0.92, 1, 1],
  glow: rgb01(colors.collectGlow),
};

const LOST_SKIN: CubeSkin = {
  shadow: rgb01(colors.blockLostDark),
  body: rgb01(colors.blockLost),
  highlight: [1, 0.55, 0.48],
  edge: [1, 0.86, 0.82],
  glow: rgb01(colors.blockLost),
};

/** The white-hot first frames of a destroyed block. */
const FLASH_SKIN: CubeSkin = {
  shadow: [0.82, 0.74, 0.74],
  body: [1, 0.92, 0.9],
  highlight: [1, 1, 1],
  edge: [1, 1, 1],
  glow: [1, 0.88, 0.86],
};

type CubePalette = {
  /** `SHADE_STEPS` entries, shadow → body → highlight → edge. */
  faces: Float32Array[];
  tube: Float32Array;
  core: Float32Array;
  glow: Float32Array;
};

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
      const skylinePaint = Skia.Paint();

      // One blur serves every cube in the frame: player blocks are all one
      // size, and a slightly generous blur on smaller debris is invisible.
      const cubeUnit =
        (s.blocks.length >= 3
          ? s.blocks[2]!
          : s.collectibles.length >= 3
            ? s.collectibles[2]!
            : 1) * scale;
      const bloomSigma = Math.max(0.5, cubeUnit * BLOOM_SIGMA);
      const bloomBlur = Skia.MaskFilter.MakeBlur(BLUR_NORMAL, bloomSigma, true);

      /** Blurred, additive fill: halos and speed smears. */
      const glowPaint = Skia.Paint();
      glowPaint.setAntiAlias(true);
      glowPaint.setBlendMode(BLEND_PLUS);
      glowPaint.setMaskFilter(bloomBlur);

      /** Lit cube faces. */
      const facePaint = Skia.Paint();
      facePaint.setAntiAlias(true);

      /**
       * Wide blurred additive stroke along the cube's edges — shaped bloom that
       * follows the silhouette instead of smudging a circle over it.
       */
      const bloomPaint = Skia.Paint();
      bloomPaint.setAntiAlias(true);
      bloomPaint.setStyle(STYLE_STROKE);
      bloomPaint.setStrokeCap(CAP_ROUND);
      bloomPaint.setStrokeJoin(JOIN_ROUND);
      bloomPaint.setBlendMode(BLEND_PLUS);
      bloomPaint.setMaskFilter(bloomBlur);

      /** Mid glow — the falloff that reads as a neon tube. */
      const tubePaint = Skia.Paint();
      tubePaint.setAntiAlias(true);
      tubePaint.setStyle(STYLE_STROKE);
      tubePaint.setStrokeCap(CAP_ROUND);
      tubePaint.setStrokeJoin(JOIN_ROUND);
      tubePaint.setBlendMode(BLEND_PLUS);

      /**
       * Hard near-white filament. Opaque and unblended, so the silhouette is
       * never ambiguous whatever is behind it.
       */
      const corePaint = Skia.Paint();
      corePaint.setAntiAlias(true);
      corePaint.setStyle(STYLE_STROKE);
      corePaint.setStrokeCap(CAP_ROUND);
      corePaint.setStrokeJoin(JOIN_ROUND);

      const toX = (x: number) => x * scale + offsetX;
      const toY = (y: number) => y * scale + offsetY;

      // Scratch buffers, allocated once per frame and shared by every cube.
      // `drawCube` is never re-entrant, so this is safe.
      const vx = [0, 0, 0, 0, 0, 0, 0, 0];
      const vy = [0, 0, 0, 0, 0, 0, 0, 0];
      const vz = [0, 0, 0, 0, 0, 0, 0, 0];
      const nx = [0, 0, 0, 0, 0, 0];
      const ny = [0, 0, 0, 0, 0, 0];
      const nz = [0, 0, 0, 0, 0, 0];
      const visible = [0, 0, 0, 0, 0, 0];

      /**
       * Palettes, built once per frame and never per face.
       *
       * `SkColor` is a `Float32Array` of 0..1 components, so a colour is a
       * plain allocation with no host call and no CSS string to parse. The
       * previous `Skia.Color(\`rgba(...)\`)` per face cost ~2000 string parses
       * a second.
       */
      const mix = (
        a: readonly [number, number, number],
        b: readonly [number, number, number],
        t: number,
      ): Float32Array => {
        const r = a[0] + (b[0] - a[0]) * t;
        const g = a[1] + (b[1] - a[1]) * t;
        const bl = a[2] + (b[2] - a[2]) * t;
        // Native `setColor` falls back to opaque black if any component
        // exceeds 1, so clamping here is correctness, not hygiene.
        return Float32Array.of(
          r < 0 ? 0 : r > 1 ? 1 : r,
          g < 0 ? 0 : g > 1 ? 1 : g,
          bl < 0 ? 0 : bl > 1 ? 1 : bl,
          1,
        );
      };
      const solid = (c: readonly [number, number, number]) => mix(c, c, 0);

      const makePalette = (skin: CubeSkin): CubePalette => {
        const faces: Float32Array[] = [];
        for (let i = 0; i < SHADE_STEPS; i += 1) {
          const t = i / (SHADE_STEPS - 1);
          // The top segment runs into the edge colour so the brightest face
          // genuinely glows, while stopping short of white so the block keeps
          // its identity.
          faces[i] =
            t < 0.45
              ? mix(skin.shadow, skin.body, t / 0.45)
              : t < 0.8
                ? mix(skin.body, skin.highlight, (t - 0.45) / 0.35)
                : mix(skin.highlight, skin.edge, ((t - 0.8) / 0.2) * 0.75);
        }
        return {
          faces,
          tube: mix(skin.body, skin.edge, 0.6),
          core: solid(skin.edge),
          glow: solid(skin.glow),
        };
      };

      const playerPal = makePalette(PLAYER_SKIN);
      const collectPal =
        s.collectibles.length > 0 ? makePalette(COLLECT_SKIN) : playerPal;
      const lostPal = s.particles.length > 0 ? makePalette(LOST_SKIN) : playerPal;
      const flashPal =
        s.particles.length > 0 ? makePalette(FLASH_SKIN) : playerPal;

      /**
       * Draws one rotated, lit, glowing cube.
       *
       * Lighting is per-face and normal-based, not depth-based. The same linear
       * map that rotates the vertices is applied to the three basis vectors;
       * every face normal is ± one of those, so three vector rotations light
       * all six faces. Shading picks a *position in a colour ramp* rather than
       * scaling a multiplier, which is why a shadowed face lands on
       * `blockDark` instead of sliding toward black.
       *
       * Visibility culls on the normal's z, not screen winding. The previous
       * winding test was inverted — `CUBE_FACES` is wound inward, so at rest it
       * culled the bright front face and kept the darkest back face, and the
       * four side faces produced `cross === 0` and were culled too. A "3D cube"
       * was rendering as one flat dark quad. Because the projection is centred
       * on each cube the camera sits directly in front of it, so `nz > 0` is
       * exactly the visible set, and cull and lighting can never disagree.
       *
       * Faces of a convex solid never overlap once back faces are culled, so
       * there is no painter's sort — the old `map` + `sort` per cube is gone.
       *
       * Draw calls: 1 bloom + 2-3 face fills + 1 tube + 1 core = 5-6.
       */
      const drawCube = (
        cx: number,
        cy: number,
        size: number,
        rotX: number,
        rotY: number,
        rotZ: number,
        pal: CubePalette,
        alpha: number,
      ) => {
        const half = size / 2;
        const sinX = Math.sin(rotX);
        const cosX = Math.cos(rotX);
        const sinY = Math.sin(rotY);
        const cosY = Math.cos(rotY);
        const sinZ = Math.sin(rotZ);
        const cosZ = Math.cos(rotZ);

        for (let i = 0; i < 8; i += 1) {
          const v = CUBE_VERTS[i]!;

          // Rotate about Y, then X — the two axes the sheet specifies.
          const x1 = v[0] * cosY + v[2] * sinY;
          const z1 = -v[0] * sinY + v[2] * cosY;
          const y2 = v[1] * cosX - z1 * sinX;
          const z2 = v[1] * sinX + z1 * cosX;

          // Lean about Z, driven by vertical velocity.
          const x = x1 * cosZ - y2 * sinZ;
          const y = x1 * sinZ + y2 * cosZ;

          // Weak perspective: nearer faces grow slightly.
          const depth = CAMERA_Z / (CAMERA_Z - z2);
          vx[i] = cx + x * half * depth;
          vy[i] = cy + y * half * depth;
          vz[i] = z2;
        }

        // Rotation matrix columns = the rotated basis vectors.
        const bx0 = cosY * cosZ - sinY * sinX * sinZ;
        const bx1 = cosY * sinZ + sinY * sinX * cosZ;
        const bx2 = -sinY * cosX;
        const by0 = -cosX * sinZ;
        const by1 = cosX * cosZ;
        const by2 = sinX;
        const bz0 = sinY * cosZ + cosY * sinX * sinZ;
        const bz1 = sinY * sinZ - cosY * sinX * cosZ;
        const bz2 = cosY * cosX;

        // Normals, in CUBE_FACES order:
        // back(−z), front(+z), left(−x), right(+x), top(−y), bottom(+y).
        nx[0] = -bz0; ny[0] = -bz1; nz[0] = -bz2;
        nx[1] = bz0;  ny[1] = bz1;  nz[1] = bz2;
        nx[2] = -bx0; ny[2] = -bx1; nz[2] = -bx2;
        nx[3] = bx0;  ny[3] = bx1;  nz[3] = bx2;
        nx[4] = -by0; ny[4] = -by1; nz[4] = -by2;
        nx[5] = by0;  ny[5] = by1;  nz[5] = by2;

        for (let f = 0; f < 6; f += 1) {
          // A small epsilon drops edge-on slivers that would alias into a seam.
          visible[f] = nz[f]! > 0.0015 ? 1 : 0;
        }

        // Edge geometry: one path, each visible edge exactly once.
        const edges = Skia.Path.Make();
        for (let e = 0; e < 48; e += 4) {
          if (
            visible[CUBE_EDGES[e + 2]!] === 0 &&
            visible[CUBE_EDGES[e + 3]!] === 0
          ) {
            continue;
          }
          const a = CUBE_EDGES[e]!;
          const b = CUBE_EDGES[e + 1]!;
          edges.moveTo(vx[a]!, vy[a]!);
          edges.lineTo(vx[b]!, vy[b]!);
        }

        // Pass 1 — bloom, behind the faces so it only shows as spill past the
        // silhouette. Shaped, not circular: this is the emissive read.
        bloomPaint.setColor(pal.glow);
        bloomPaint.setAlphaf(BLOOM_ALPHA * alpha);
        bloomPaint.setStrokeWidth(size * BLOOM_WIDTH);
        canvas.drawPath(edges, bloomPaint);

        // Pass 2 — lit faces.
        for (let f = 0; f < 6; f += 1) {
          if (visible[f] === 0) continue;

          const face = CUBE_FACES[f]!;
          const i0 = face[0];
          const i1 = face[1];
          const i2 = face[2];
          const i3 = face[3];

          const lambert = nx[f]! * LIGHT_X + ny[f]! * LIGHT_Y + nz[f]! * LIGHT_Z;
          const diffuse = lambert > 0 ? lambert : 0;
          // Fresnel: a face turning edge-on catches the rim. Squared so it
          // stays confined to grazing angles.
          const facing = 1 - nz[f]!;
          const rim = facing * facing;
          const meanZ = (vz[i0]! + vz[i1]! + vz[i2]! + vz[i3]!) * 0.25;

          const shade =
            CUBE_AMBIENT +
            CUBE_DIFFUSE * diffuse +
            CUBE_RIM * rim +
            CUBE_DEPTH_LIFT * meanZ;

          let step = (shade * SHADE_STEPS) | 0;
          if (step < 0) step = 0;
          else if (step >= SHADE_STEPS) step = SHADE_STEPS - 1;

          const path = Skia.Path.Make();
          path.moveTo(vx[i0]!, vy[i0]!);
          path.lineTo(vx[i1]!, vy[i1]!);
          path.lineTo(vx[i2]!, vy[i2]!);
          path.lineTo(vx[i3]!, vy[i3]!);
          path.close();

          facePaint.setColor(pal.faces[step]!);
          if (alpha < 1) facePaint.setAlphaf(alpha);
          canvas.drawPath(path, facePaint);
        }

        // Pass 3 — mid glow along every visible edge.
        tubePaint.setColor(pal.tube);
        tubePaint.setAlphaf(TUBE_ALPHA * alpha);
        tubePaint.setStrokeWidth(size * TUBE_WIDTH);
        canvas.drawPath(edges, tubePaint);

        // Pass 4 — the filament. Also draws the interior seam, which is what
        // turns three flat quads into a legible tumbling cube.
        corePaint.setColor(pal.core);
        corePaint.setAlphaf(alpha);
        const coreWidth = size * CORE_WIDTH;
        corePaint.setStrokeWidth(
          coreWidth < CORE_MIN_WIDTH ? CORE_MIN_WIDTH : coreWidth,
        );
        canvas.drawPath(edges, corePaint);
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

        glowPaint.setColor(collectPal.glow);
        glowPaint.setAlphaf(0.18 + pulse * 0.22);
        canvas.drawCircle(cx, cy, size * (0.62 + pulse * 0.2), glowPaint);

        const spin = s.elapsed * 1.4;
        drawCube(cx, cy, size, spin * 0.6, spin, 0, collectPal, 1);
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

        // Speed smear: a blurred echo trailing the cube as the run
        // accelerates. Trails behind the direction of travel only.
        if (trail > 0.02) {
          glowPaint.setColor(playerPal.glow);
          glowPaint.setAlphaf(trail * 0.22);
          canvas.drawCircle(
            cx - size * (0.34 + 0.42 * trail),
            cy,
            size * 0.44,
            glowPaint,
          );
        }

        // Emissive halo — additive and blurred, so it reads as light spilling
        // off the cube rather than the flat disc it used to be. Kept tight and
        // low-alpha on purpose: an obstacle edge behind it must stay readable.
        glowPaint.setColor(playerPal.glow);
        glowPaint.setAlphaf(HALO_ALPHA);
        canvas.drawCircle(cx, cy, size * HALO_RADIUS, glowPaint);

        drawCube(
          cx,
          cy,
          size,
          blocks[o + 3]!,
          blocks[o + 4]!,
          blocks[o + 5]!,
          playerPal,
          1,
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
          // Stage 2: white-hot on the first frames, then red. The destruction
          // cue is load-bearing feedback, not decoration.
          drawCube(
            px2,
            py2,
            size,
            rotation * 0.7,
            rotation,
            0,
            alpha > 0.88 ? flashPal : lostPal,
            alpha,
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

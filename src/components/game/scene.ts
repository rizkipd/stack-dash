/**
 * The gameplay scene, drawn into a Skia canvas.
 *
 * Extracted from `GameCanvas.tsx` so the app and the offline preview harness
 * (`scripts/preview.mjs`) execute **the same code**. Rendering was previously
 * unverifiable — two bugs shipped that typechecked, linted and bundled
 * cleanly while drawing the wrong thing entirely. Being able to look at the
 * output is what stops that recurring.
 *
 * `Sk` is injected rather than imported so the harness can pass a CanvasKit
 * shim. In the app it is always the real `Skia` namespace.
 */
import { PARTICLE_CORE, PARTICLE_STAR } from "@/game/engine/Particles";
import {
  BLOCK_STRIDE,
  COLLECTIBLE_STRIDE,
  OBSTACLE_STRIDE,
  PARTICLE_STRIDE,
  type RenderState,
} from "@/game/render/renderState";
import { colors } from "@/theme/colors";

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

/**
 * Camera distance in half-cube units. Larger = weaker perspective.
 *
 * At 5.2 the near face expanded by CAMERA_Z/(CAMERA_Z-1) = 1.24, so every cube
 * drew 24% taller than its slot in the stack. Cubes are painted bottom-last, so
 * each one covered the lower quarter of the cube above it and the column read
 * as stacked slabs rather than cubes. 9 keeps a believable three-quarter view
 * with only ~12% expansion.
 */
const CAMERA_Z = 9;

/**
 * Cube size as a fraction of its slot in the stack.
 *
 * Leaves room for the perspective expansion above plus a hairline gap, so
 * neighbouring cubes read as separate objects instead of a continuous ribbon.
 */
const CUBE_FILL = 0.88;

// --- Background: neon night city ---
//
// Transcribed from the BACKGROUND LAYERS panel of `image copy 2.png`: Far City,
// Mid Buildings, Near Buildings, Ground/Road, plus the Static Particles panel.
//
// The governing constraint (`docs/ART_DIRECTION.md` §1) shapes every number
// here: gameplay objects must stay strongly contrasted against this. Two rules
// keep that true, and they are why the tints look as they do.
//
//   1. Nothing sits at the obstacle's own brightness. `colors.obstacle`
//      (#27272A) has relative luminance ~0.021. Every skyline tint is well
//      below it, so a wall reads as a lighter neutral column against a darker
//      saturated silhouette; the sky's magenta core is well above it, so a wall
//      crossing the glow reads as a hard dark shape (~2.7:1 there).
//   2. Detail is graded by height. The top ~45% of the frame is clean gradient
//      with only a few 1px sparkles, because that is where an approaching wall
//      must be picked out earliest.

/**
 * Ground line, as a fraction of canvas height. The skyline stands on it.
 *
 * The sheet's gameplay screens show the road as a narrow near strip, roughly a
 * tenth of the frame — enough to ground the stack without eating play field.
 */
const HORIZON = 0.88;

/**
 * Global parallax/drift multiplier.
 *
 * Parallax is decorative (`docs/ART_DIRECTION.md` §6), so it is the first thing
 * to go under the OS reduce-motion setting: 0 freezes the city, clouds,
 * sparkles and road lights in one move and touches nothing else. The block
 * destruction cue is load-bearing and lives elsewhere.
 */
const MOTION = 1;

/** Amplitude of the horizon line's breathing, 0..1. Also 0 for reduce-motion. */
const HORIZON_BREATH = 0.08;

/**
 * Sky gradient, top → bottom.
 *
 * `bgTop`/`bgMid`/`bgBottom` are the spine from `docs/ART_DIRECTION.md` §2; the
 * other stops are derived shades that give the magenta a *core* to bloom from
 * rather than a flat band. The brightest stop sits where the far city occludes
 * most of it.
 */
export const SKY_COLORS = [
  '#0D0B2C', // deeper than bgTop, so a wall high on screen still reads
  colors.bgTop,
  colors.bgMid,
  '#7A2A93',
  '#C6438F', // magenta core, behind the far city
  colors.bgBottom,
  '#3E1030',
  colors.ground,
];
export const SKY_STOPS = [0, 0.22, 0.45, 0.61, 0.71, 0.79, 0.87, 1];

/** City bloom lifting off the skyline. Three stops fake a squared falloff. */
export const BLOOM_COLORS = [
  'rgba(232, 88, 178, 0.44)',
  'rgba(226, 82, 168, 0.19)',
  'rgba(226, 82, 168, 0)',
];
export const BLOOM_STOPS = [0, 0.45, 1];

/**
 * Background render parameters, grouped for the same reason block colour is a
 * parameter: a post-MVP skin should be a config change, not a refactor.
 */
const background = {
  /** Aerial haze the far layers dissolve into. */
  haze: '#8A2E86',
  /** Magenta uplight pooling at street level. */
  uplight: '#C4368A',
  /**
   * Lit windows. Small, flat and un-bloomed — that is what stops a 3px cyan
   * dot ever being confused with the 40px glowing collectible cube.
   */
  windowWarm: '#F5B942',
  windowCool: '#5FD7F2',
  rim: '#6B58A8',
  cloud: '#7B4BC4',
  sparkle: '#CFF6FF',
  /**
   * Road kerb. Thin by design: a large light band here would eat the player
   * block's contrast, which is the opposite of what the ground is for.
   */
  kerb: '#C3CBDF',
  /**
   * Road surface. Light enough that near-black obstacles read against it as
   * silhouettes — the sheet's gameplay screens show the stack and the walls
   * standing on a lit, reflective floor, not floating over a void.
   */
  road: '#6E7793',
  /** Street lights — brightest element, and the cue separating field from sky. */
  lamp: colors.accent,
  lampCore: '#FFC864',
};

/**
 * Deterministic variation, sampled by index.
 *
 * `Math.random()` is banned in the picture worklet: it re-evaluates every
 * frame, so a random skyline would strobe rather than scroll. A fixed table
 * gives a stable city and costs an array index instead of a hash.
 */
const NOISE: readonly number[] = [
  0.972, 0.25, 0.781, 0.689, 0.798, 0.812, 0.132, 0.49, 0.196, 0.219, 0.15,
  0.233, 0.399, 0.569, 0.678, 0.87, 0.492, 0.639, 0.641, 0.722, 0.588, 0.759,
  0.428, 0.35, 0.194, 0.691, 0.263, 0.433, 0.595, 0.502, 0.581, 0.644, 0.221,
  0.437, 0.404, 0.52, 0.027, 0.795, 0.157, 0.332, 0.965, 0.682, 0.252, 0.696,
  0.561, 0.882, 0.666, 0.67, 0.84, 0.796, 0.159, 0.083, 0.082, 0.328, 0.667,
  0.099, 0.9, 0.436, 0.786, 0.177, 0.199, 0.671, 0.938, 0.151,
];

type SkylineLayer = {
  /** Parallax rate. Far scrolls slowest, ground fastest. */
  rate: number;
  /**
   * Buildings per screen width. Proportional, so the draw-call budget is fixed
   * however wide the device is — a tablet gets wider buildings, not more.
   */
  cells: number;
  hMin: number;
  hMax: number;
  /**
   * Width range as a fraction of the cell. Gaps matter more than bodies: they
   * are what lets the magenta core show through.
   */
  wMin: number;
  wVar: number;
  /** Base line raised above the horizon, so a far tower is not fully hidden. */
  lift: number;
  tint: string;
  alpha: number;
  /** Noise offset, so no two layers share a skyline. */
  salt: number;
  winCols: number;
  winRows: number;
  /** Lit top/left edge. Off for the far city — at that size it reads as noise. */
  rim: boolean;
  caps: boolean;
  /** Haze drawn over this layer, pushing it behind the next one. */
  veilSteps: number;
  veilAlpha: number;
  veilSpan: number;
};

const SKYLINE: readonly SkylineLayer[] = [
  {
    rate: 0.05,
    cells: 20,
    hMin: 0.07,
    hMax: 0.21,
    wMin: 0.46,
    wVar: 0.34,
    lift: 0.032,
    tint: '#35256A',
    alpha: 0.82,
    salt: 0,
    winCols: 0,
    winRows: 0,
    rim: false,
    caps: false,
    veilSteps: 9,
    veilAlpha: 0.44,
    veilSpan: 0.27,
  },
  {
    rate: 0.11,
    cells: 9,
    hMin: 0.11,
    hMax: 0.27,
    wMin: 0.4,
    wVar: 0.28,
    lift: 0.015,
    tint: '#241A55',
    alpha: 0.92,
    salt: 5,
    winCols: 2,
    winRows: 5,
    rim: true,
    caps: false,
    veilSteps: 7,
    veilAlpha: 0.18,
    veilSpan: 0.22,
  },
  {
    rate: 0.22,
    cells: 5,
    hMin: 0.13,
    hMax: 0.32,
    wMin: 0.38,
    wVar: 0.26,
    lift: 0,
    tint: '#150D31',
    alpha: 1,
    salt: 11,
    winCols: 3,
    winRows: 6,
    rim: true,
    caps: true,
    veilSteps: 0,
    veilAlpha: 0,
    veilSpan: 0,
  },
];

/**
 * Obstacle tone ramp — a render parameter, not inlined constants, so a
 * post-MVP wall skin stays a config change rather than a refactor
 * (`docs/ART_DIRECTION.md` §3).
 *
 * Sampled from the OBSTACLE ASSETS panel of `image copy 2.png`. The ramp is
 * deliberately wide — near-black mortar at one end, near-white cap at the
 * other — because contrast between gameplay objects and background outranks
 * everything else here.
 */
const OBSTACLE_TONES = {
  /** Mortar, silhouette, and the gaps between cubes. */
  mortar: '#07080F',
  /** Cube front face. Slate with a blue cast, per the sheet. */
  face: '#2A2C3C',
  /** Cube right face, turned away from the light. */
  side: '#1B1D2A',
  /** Lit top face of an interior cube. */
  tileTop: '#4E5366',
  /** Top face of the cube terminating a wall at an opening. */
  capFace: '#B5BAC9',
  /** Brightest hairline, sitting exactly on the opening boundary. */
  capEdge: '#DFE4EE',
  /**
   * Warm rim light from the ground neon. A theme token on purpose: it is the
   * same accent as the road glow, which is what motivates it in-fiction.
   */
  rim: colors.accent,
} as const;

/**
 * Hard ceiling on cube rows emitted for one wall.
 *
 * A wall may be the full world height (1800 units) while a cube is one wall
 * width (90 units), so 20 rows is the natural maximum; 22 leaves headroom
 * without letting a pathological rect build an unbounded path.
 */
const MAX_CUBE_ROWS = 22;

// --- Lighting ---
// Key light from upper-left, slightly toward the viewer. Screen y is down, so
// a negative Y component reads as "from above".
const LIGHT_X = -0.42;
const LIGHT_Y = -0.66;
const LIGHT_Z = 0.62;

/** Floor brightness. Never 0 — a neon cube's dark side still emits. */
const CUBE_AMBIENT = 0.12;
const CUBE_DIFFUSE = 0.42;
/**
 * Rim/fresnel term. Faces turning edge-on catch light, which is what makes a
 * cube read as glowing volume rather than a painted hexagon.
 *
 * Small on purpose. At 0.3 the terms summed past 1.0 on grazing faces, pinning
 * them to the top of the ramp — near-white — so a tumbling cube flashed as
 * white shards and lost its blue identity entirely.
 */
const CUBE_RIM = 0.11;
/** Nearer faces run slightly hotter, separating them at a glance. */
const CUBE_DEPTH_LIFT = 0.06;
/**
 * Quantisation of the shade ramp. Faces are flat-shaded, so 12 steps is well
 * past visible banding — and it lets every colour be precomputed once per
 * frame instead of once per face.
 */
const SHADE_STEPS = 12;

// --- Neon passes ---
// Widths are fractions of the cube's screen size, so the look survives any
// device scale.
const BLOOM_WIDTH = 0.085;
const BLOOM_ALPHA = 0.34;
const TUBE_WIDTH = 0.026;
const TUBE_ALPHA = 0.22;
const CORE_WIDTH = 0.011;
const CORE_MIN_WIDTH = 1.1;
const BLOOM_SIGMA = 0.09;

/**
 * Halo behind a player cube. Deliberately tight and low-alpha: an obstacle
 * edge behind it must stay readable (`docs/ART_DIRECTION.md` §1).
 */
const HALO_RADIUS = 0.62;
const HALO_ALPHA = 0.2;


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
  shadow: rgb01('#1E3F96'),
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

/** Enum values, passed in so the harness can supply CanvasKit's equivalents. */
export type SceneEnums = {
  strokeStyle: number;
  blendPlus: number;
  blurNormal: number;
  capRound: number;
  joinRound: number;
};

export function drawScene(
  Sk: any,
  canvas: any,
  s: RenderState,
  width: number,
  height: number,
  E: SceneEnums,
): void {
  "worklet";
  const Skia = Sk;
  const STYLE_STROKE = E.strokeStyle;
  const BLEND_PLUS = E.blendPlus;
  const BLUR_NORMAL = E.blurNormal;
  const CAP_ROUND = E.capRound;
  const JOIN_ROUND = E.joinRound;

      const { scale, offsetX, offsetY } = s;

      // --- Paints, created once per frame rather than per shape. ---
      const paint = Skia.Paint();
      paint.setAntiAlias(true);

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
                : mix(skin.highlight, skin.edge, ((t - 0.8) / 0.2) * 0.3);
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

      // --- Background: neon night city ---
      // The sky gradient and city bloom are declarative <Canvas> children; they
      // never change, so re-recording them every frame would be waste.
      // Everything below scrolls, so it belongs here.

      // Anti-aliasing stays off for the background: every shape is
      // axis-aligned, and AA on abutting bands leaves visible seams.
      const bgPaint = Skia.Paint();
      const dotPaint = Skia.Paint();
      dotPaint.setAntiAlias(true);

      const horizonY = Math.round(height * HORIZON);

      // One scratch rect, mutated in place. `SkRect` is read by value on the
      // native side, so this removes ~250 allocations per frame.
      const box = { x: 0, y: 0, width: 0, height: 0 };
      const setBox = (x: number, y: number, w: number, h: number) => {
        box.x = x;
        box.y = y;
        box.width = w;
        box.height = h;
        return box;
      };
      const fill = (x: number, y: number, w: number, h: number) => {
        canvas.drawRect(setBox(x, y, w, h), bgPaint);
      };

      const noise = (index: number, salt: number) =>
        NOISE[(((index * 7 + salt * 13) % 64) + 64) % 64]!;

      /**
       * Vertical alpha ramp as flat bands — cheaper than building a gradient
       * shader every frame, and at these alphas the steps are invisible.
       */
      const veil = (top: number, bottom: number, steps: number, peak: number) => {
        for (let k = 0; k < steps; k += 1) {
          const y0 = Math.round(top + ((bottom - top) * k) / steps);
          const y1 = Math.round(top + ((bottom - top) * (k + 1)) / steps);
          bgPaint.setAlphaf((peak * (k + 0.5)) / steps);
          fill(0, y0, width, y1 - y0);
        }
      };

      // Colours resolved once per frame, not once per draw.
      const hazeColor = Skia.Color(background.haze);
      const warmColor = Skia.Color(background.windowWarm);
      const coolColor = Skia.Color(background.windowCool);
      const rimColor = Skia.Color(background.rim);
      const lampColor = Skia.Color(background.lamp);

      // Clouds. Barely above the sky in value: they must never read as
      // something the stack could hit.
      {
        const cellW = width / 2.2;
        const offset = s.distance * 0.035 * MOTION * scale;
        const base = Math.floor(offset / cellW);
        const scroll = offset - base * cellW;
        const path = Skia.Path.Make();
        for (let k = -1; k < 4; k += 1) {
          const world = base + k;
          const n0 = noise(world, 21);
          const n1 = noise(world, 22);
          const cx = k * cellW - scroll + cellW * (0.2 + n0 * 0.5);
          const cy = height * (0.2 + n1 * 0.22);
          const r0 = width * (0.055 + n0 * 0.035);
          path.addCircle(cx, cy, r0);
          path.addCircle(cx - r0 * 0.95, cy + r0 * 0.35, r0 * 0.62);
          path.addCircle(cx + r0, cy + r0 * 0.4, r0 * 0.55);
          path.addRect(setBox(cx - r0 * 1.55, cy + r0 * 0.3, r0 * 3.1, r0 * 0.7));
        }
        dotPaint.setColor(Skia.Color(background.cloud));
        dotPaint.setAlphaf(0.13);
        canvas.drawPath(path, dotPaint);
      }

      // Static particles: sparse sky dust, per the sheet's panel. Capped at
      // 1.6px and 0.3 alpha so nothing here can mask an obstacle edge.
      {
        const path = Skia.Path.Make();
        const span = width + 20;
        const drift = s.elapsed * 3 * MOTION;
        for (let i = 0; i < 22; i += 1) {
          const x =
            ((((noise(i, 30) * width * 1.4 - drift) % span) + span) % span) - 10;
          const y =
            height * (0.04 + noise(i, 31) * 0.58) +
            Math.sin(s.elapsed * 0.5 * MOTION + i) * 4;
          path.addCircle(x, y, noise(i, 32) > 0.6 ? 1.6 : 1);
        }
        dotPaint.setColor(Skia.Color(background.sparkle));
        dotPaint.setAlphaf(0.3);
        canvas.drawPath(path, dotPaint);
      }

      // Skyline: far → near, each veiled back behind the next.
      for (let li = 0; li < SKYLINE.length; li += 1) {
        const layer = SKYLINE[li]!;
        const cellW = width / layer.cells;
        const offset = s.distance * layer.rate * MOTION * scale;
        // Index by *world* cell, not by screen slot. Keying off the loop
        // counter — as the previous version did — made every building morph
        // as the field scrolled past it.
        const base = Math.floor(offset / cellW);
        const scroll = offset - base * cellW;
        const count = layer.cells + 2;
        const baseY = horizonY - Math.round(height * layer.lift);

        const warmPath = layer.winCols > 0 ? Skia.Path.Make() : null;
        const coolPath = layer.winCols > 0 ? Skia.Path.Make() : null;
        const rimPath = layer.rim ? Skia.Path.Make() : null;
        const capPath = layer.caps ? Skia.Path.Make() : null;

        const tint = Skia.Color(layer.tint);
        bgPaint.setColor(tint);
        bgPaint.setAlphaf(layer.alpha);

        for (let k = -1; k < count; k += 1) {
          const world = base + k;
          const nH = noise(world, layer.salt);
          const nW = noise(world, layer.salt + 1);
          const nS = noise(world, layer.salt + 2);

          const bh = Math.round(
            height * (layer.hMin + nH * (layer.hMax - layer.hMin)),
          );
          const bw = Math.round(cellW * (layer.wMin + nW * layer.wVar));
          const bx = Math.round(k * cellW - scroll + (cellW - bw) * 0.5);
          const by = baseY - bh;
          if (bx > width || bx + bw < 0) continue;

          fill(bx, by, bw, bh);

          if (capPath && nS > 0.45) {
            const cw = Math.round(bw * (0.3 + nS * 0.22));
            const ch = Math.round(bh * (0.06 + nS * 0.08));
            capPath.addRect(
              setBox(bx + Math.round((bw - cw) * (0.2 + nW * 0.6)), by - ch, cw, ch),
            );
          }

          if (rimPath) {
            rimPath.addRect(setBox(bx, by, bw, 1.5));
            rimPath.addRect(setBox(bx, by, 1.5, bh));
          }

          if (!warmPath || !coolPath) continue;

          const pad = Math.max(2, bw * 0.16);
          const stepX = (bw - pad * 2) / layer.winCols;
          const stepY = (bh * 0.78) / layer.winRows;
          if (stepX < 2 || stepY < 3) continue;

          const top = by + Math.max(5, bh * 0.1);
          const ww = Math.max(1, Math.min(4, stepX * 0.44));
          const wh = Math.max(1, Math.min(4, stepY * 0.34));

          for (let c = 0; c < layer.winCols; c += 1) {
            for (let rw = 0; rw < layer.winRows; rw += 1) {
              const lit = noise(world * 5 + c * 3 + rw * 11, layer.salt + 4);
              if (lit < 0.34) continue;
              const target = lit > 0.66 ? coolPath : warmPath;
              target.addRect(
                setBox(
                  bx + pad + c * stepX + (stepX - ww) * 0.5,
                  top + rw * stepY,
                  ww,
                  wh,
                ),
              );
            }
          }
        }

        if (capPath) {
          bgPaint.setColor(tint);
          bgPaint.setAlphaf(layer.alpha);
          canvas.drawPath(capPath, bgPaint);
        }
        if (rimPath) {
          bgPaint.setColor(rimColor);
          bgPaint.setAlphaf(0.5);
          canvas.drawPath(rimPath, bgPaint);
        }
        if (warmPath && coolPath) {
          bgPaint.setColor(warmColor);
          bgPaint.setAlphaf(0.5 * layer.alpha);
          canvas.drawPath(warmPath, bgPaint);
          bgPaint.setColor(coolColor);
          bgPaint.setAlphaf(0.42 * layer.alpha);
          canvas.drawPath(coolPath, bgPaint);
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

      // Street-level uplight under the near towers.
      bgPaint.setColor(Skia.Color(background.uplight));
      bgPaint.setAlphaf(0.1);
      const upH = Math.round(height * 0.035);
      fill(0, horizonY - upH, width, upH);

      // Ground / road — a lit, reflective surface, as in the sheet's gameplay
      // screens and its Ground/Road layer. It was near-black here, which lost
      // the floor the stack and the walls visibly stand on.
      //
      // Contrast still works, just inverted: obstacles are near-black charcoal,
      // so against a light road they read as dark silhouettes rather than
      // dark-on-dark.
      const groundH = height - horizonY;
      bgPaint.setColor(Skia.Color(background.road));
      bgPaint.setAlphaf(1);
      fill(0, horizonY, width, groundH);

      // Vertical falloff: brightest where the road meets the city, sinking
      // toward the near edge, which is what gives it a receding surface.
      const bands = 7;
      bgPaint.setColor(Skia.Color(colors.ground));
      for (let k = 0; k < bands; k += 1) {
        const y0 = Math.round(horizonY + (groundH * k) / bands);
        const y1 = Math.round(horizonY + (groundH * (k + 1)) / bands);
        bgPaint.setAlphaf(0.1 + 0.62 * (k / (bands - 1)));
        fill(0, y0, width, y1 - y0);
      }

      // Wet-surface reflection: a soft magenta smear of the city, brightest
      // just below the horizon.
      bgPaint.setColor(Skia.Color(background.uplight));
      for (let k = 0; k < 4; k += 1) {
        const y0 = Math.round(horizonY + (groundH * k) / 10);
        const y1 = Math.round(horizonY + (groundH * (k + 1)) / 10);
        bgPaint.setAlphaf(0.16 * (1 - k / 4));
        fill(0, y0, width, y1 - y0);
      }

      const kerbH = Math.max(2, Math.round(height * 0.007));
      const kerbY = horizonY;
      bgPaint.setColor(Skia.Color(background.kerb));
      bgPaint.setAlphaf(0.85);
      fill(0, kerbY, width, kerbH);

      // Street lights: fastest parallax layer, brightest element in the frame.
      {
        const cellW = width / 2.6;
        const offset = s.distance * 0.3 * MOTION * scale;
        const base = Math.floor(offset / cellW);
        const scroll = offset - base * cellW;
        const py = kerbY + kerbH;

        const halo = Skia.Path.Make();
        const inner = Skia.Path.Make();
        const core = Skia.Path.Make();
        const reflect = Skia.Path.Make();
        for (let k = -1; k < 5; k += 1) {
          const cx = k * cellW - scroll + cellW * 0.5;
          halo.addCircle(cx, py, width * 0.085);
          inner.addCircle(cx, py, width * 0.045);
          core.addRect(
            setBox(cx - width * 0.028, py - kerbH - 1, width * 0.056, kerbH + 2),
          );
          reflect.addRect(
            setBox(cx - width * 0.012, py, width * 0.024, height * 0.05),
          );
        }
        dotPaint.setColor(lampColor);
        dotPaint.setAlphaf(0.1);
        canvas.drawPath(halo, dotPaint);
        dotPaint.setAlphaf(0.22);
        canvas.drawPath(inner, dotPaint);
        bgPaint.setColor(Skia.Color(background.lampCore));
        bgPaint.setAlphaf(0.85);
        canvas.drawPath(core, bgPaint);
        bgPaint.setColor(lampColor);
        bgPaint.setAlphaf(0.09);
        canvas.drawPath(reflect, bgPaint);
      }

      // The amber horizon edge. Load-bearing: it separates the play field from
      // the sky and gives the stack a datum to read against. The breath is ±8%
      // on a 2px line — felt, not seen.
      const breath =
        1 - HORIZON_BREATH + HORIZON_BREATH * Math.sin(s.elapsed * 0.9 * MOTION);
      bgPaint.setColor(lampColor);
      bgPaint.setAlphaf(0.07 * breath);
      fill(0, horizonY - 10, width, 10);
      bgPaint.setAlphaf(0.2 * breath);
      fill(0, horizonY - 3, width, 3);
      bgPaint.setColor(Skia.Color(background.lampCore));
      bgPaint.setAlphaf(0.75 * breath);
      fill(0, horizonY, width, 2);

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

      // --- Obstacles: stacked charcoal cubes, not slabs. ---
      //
      // Each wall is masonry built from cube-sized tiles that deliberately echo
      // the player's stack. Every cube uses a fixed 45° cabinet projection —
      // front face, lit top face receding up-and-right, shaded right face —
      // the same 3/4 read as the sheet's OBSTACLE ASSETS panel.
      //
      // This deliberately does not reuse `drawCube`: walls never rotate, so a
      // static projection is cheaper and steadier.
      //
      // Two edges carry the gameplay and are the brightest things in the wall:
      // the leading (left) face the stack meets, and the cap bordering an
      // opening. Both have hard boundaries and are never faded out.
      //
      // **Nothing drawn here exceeds the collision rect.** The cap is inset
      // inside the wall rather than overhanging it, so a wall can never look
      // taller or wider than it actually is.
      const cMortar = Skia.Color(OBSTACLE_TONES.mortar);
      const cFace = Skia.Color(OBSTACLE_TONES.face);
      const cSide = Skia.Color(OBSTACLE_TONES.side);
      const cTileTop = Skia.Color(OBSTACLE_TONES.tileTop);
      const cCapFace = Skia.Color(OBSTACLE_TONES.capFace);
      const cCapEdge = Skia.Color(OBSTACLE_TONES.capEdge);
      const cRim = Skia.Color(OBSTACLE_TONES.rim);

      const wallPaint = Skia.Paint();
      wallPaint.setAntiAlias(true);

      // Play-field bounds in screen space. `useGameLoop` maps the world onto
      // the full canvas height, so a wall touching these grew from the field
      // edge and has no opening on that side.
      const fieldTop = offsetY;
      const fieldBottom = height;

      const obstacles = s.obstacles;
      for (let i = 0; i < obstacles.length; i += OBSTACLE_STRIDE) {
        const wx = toX(obstacles[i]!);
        const wy = toY(obstacles[i + 1]!);
        const ww = obstacles[i + 2]! * scale;
        const wh = obstacles[i + 3]! * scale;
        if (ww <= 0 || wh <= 0) continue;
        if (wx > width || wx + ww < 0) continue;

        const wallTop = wy;
        const wallBottom = wy + wh;

        // Vertical culling. A wall may be the full world height; only the
        // on-screen band is ever detailed.
        const clipTop = Math.max(wallTop, 0);
        const clipBottom = Math.min(wallBottom, height);
        if (clipBottom <= clipTop) continue;
        const clipH = clipBottom - clipTop;

        // Cube grid: square cubes one wall-width tall, rounded so rows divide
        // the wall exactly and both ends terminate on a whole cube. The row cap
        // is what bounds the work for a full-height wall.
        let rows = Math.round(wh / ww);
        if (rows < 1) rows = 1;
        if (rows > MAX_CUBE_ROWS) rows = MAX_CUBE_ROWS;
        const rowH = wh / rows;

        const gutter = Math.max(0.75, Math.min(2, ww * 0.045));
        const x0 = wx + gutter;
        const x1 = wx + ww - gutter;
        const innerW = x1 - x0;
        if (innerW <= 0) continue;

        // Cabinet projection: the top face recedes by `depth` up-and-right and
        // the right face is `depth` wide. 45°, so both use one number.
        const depth = Math.max(1, Math.min(rowH * 0.2, innerW * 0.26));
        const faceR = x1 - depth;
        const seamH = Math.max(1, Math.min(2.25, rowH * 0.05));
        const rimW = Math.max(1.25, Math.min(2.5, ww * 0.05));

        // 1. Mortar / silhouette. Opaque backing, so a wall is never
        //    see-through whatever the detail passes above it do.
        wallPaint.setColor(cMortar);
        wallPaint.setAlphaf(1);
        canvas.drawRect(Skia.XYWHRect(wx, clipTop, ww, clipH), wallPaint);

        // 2. Front faces, as one fill: every interior cube shares this tone.
        wallPaint.setColor(cFace);
        canvas.drawRect(Skia.XYWHRect(x0, clipTop, faceR - x0, clipH), wallPaint);

        // 3. Right faces. The top-face path below notches into this band at
        //    every row, which is what makes the column read as cubes rather
        //    than one extruded bar.
        wallPaint.setColor(cSide);
        canvas.drawRect(Skia.XYWHRect(faceR, clipTop, x1 - faceR, clipH), wallPaint);

        // 4. Leading edge. Warm rim light on the exact face the stack meets —
        //    this is the wall's near side and it has to be findable at speed.
        wallPaint.setColor(cRim);
        wallPaint.setAlphaf(0.3);
        canvas.drawRect(Skia.XYWHRect(x0, clipTop, rimW, clipH), wallPaint);

        // Row range, clipped to the visible band.
        const firstRow = Math.max(0, Math.floor((clipTop - wallTop) / rowH));
        const lastRow = Math.min(
          rows - 1,
          Math.floor((clipBottom - wallTop - 0.001) / rowH),
        );

        // 5-7. Per-row detail batched into three paths, so wall height costs
        //      path vertices rather than draw calls.
        const seams = Skia.Path.Make();
        const tops = Skia.Path.Make();
        const nubs = Skia.Path.Make();
        let hasNubs = false;

        for (let r = firstRow; r <= lastRow; r += 1) {
          const ty = wallTop + r * rowH;
          const yb = ty + seamH; // back (upper) edge of the top face
          const yf = yb + depth; // front (lower) edge of the top face

          // Gap between cubes.
          seams.moveTo(x0, ty);
          seams.lineTo(x1, ty);
          seams.lineTo(x1, yb);
          seams.lineTo(x0, yb);
          seams.close();

          // Lit top face, receding up-and-right.
          tops.moveTo(x0, yf);
          tops.lineTo(x0 + depth, yb);
          tops.lineTo(x1, yb);
          tops.lineTo(faceR, yf);
          tops.close();

          // Amber edge on every cube, per the sheet's OBSTACLE ASSETS panel.
          // This is the walls' signature and it earns its place twice over:
          // it is also the strongest readability cue they have, outlining each
          // tile against a saturated background.
          hasNubs = true;
          const edgeW = Math.max(1, rimW * 0.8);
          // Along the front face's lower edge.
          nubs.moveTo(x0, yf - edgeW);
          nubs.lineTo(x1, yf - edgeW);
          nubs.lineTo(x1, yf);
          nubs.lineTo(x0, yf);
          nubs.close();
          // Down the left (leading) edge of this tile.
          nubs.moveTo(x0, yb);
          nubs.lineTo(x0 + edgeW, yb);
          nubs.lineTo(x0 + edgeW, ty + rowH);
          nubs.lineTo(x0, ty + rowH);
          nubs.close();
          // Down the right edge, so the tile is closed on both sides.
          nubs.moveTo(x1 - edgeW, yb);
          nubs.lineTo(x1, yb);
          nubs.lineTo(x1, ty + rowH);
          nubs.lineTo(x1 - edgeW, ty + rowH);
          nubs.close();
        }

        wallPaint.setColor(cMortar);
        wallPaint.setAlphaf(1);
        canvas.drawPath(seams, wallPaint);

        wallPaint.setColor(cTileTop);
        canvas.drawPath(tops, wallPaint);

        if (hasNubs) {
          wallPaint.setColor(cRim);
          wallPaint.setAlphaf(0.72);
          canvas.drawPath(nubs, wallPaint);
        }

        // 8-9. Caps, drawn only on an end bordering an opening. An end flush
        //      with the play-field edge is not a boundary and gets none.
        const capH = Math.min(Math.max(4, rowH * 0.34), wh * 0.34);
        const capDepth = Math.min(capH, innerW * 0.4);
        const edgeH = Math.max(1.5, capH * 0.26);
        const wantTop = wallTop > fieldTop + 1;
        const wantBottom = wallBottom < fieldBottom - 1;

        for (let c = 0; c < 2; c += 1) {
          const dir = c === 0 ? -1 : 1;
          if (dir < 0 ? !wantTop : !wantBottom) continue;

          const farY = dir < 0 ? wallTop : wallBottom;
          const nearY = farY - dir * capH;

          // Hard recess line on the body side, so the bright face always lands
          // against black rather than bleeding into the cubes.
          wallPaint.setColor(cMortar);
          wallPaint.setAlphaf(1);
          canvas.drawRect(
            Skia.XYWHRect(x0, dir < 0 ? nearY : nearY - 1.5, innerW, 1.5),
            wallPaint,
          );

          // Full cube face, in the same projection as the rows above it.
          const cap = Skia.Path.Make();
          cap.moveTo(x0, nearY);
          cap.lineTo(x0 + capDepth, farY);
          cap.lineTo(x1, farY);
          cap.lineTo(x1 - capDepth, nearY);
          cap.close();
          wallPaint.setColor(cCapFace);
          // An underside is physically darker than a top face. The difference
          // is kept small on purpose: readability outranks the lighting model.
          wallPaint.setAlphaf(dir < 0 ? 1 : 0.9);
          canvas.drawPath(cap, wallPaint);

          // The boundary hairline. The most important pixels on screen, so they
          // are drawn last and at full strength.
          wallPaint.setColor(cCapEdge);
          wallPaint.setAlphaf(1);
          canvas.drawRect(
            Skia.XYWHRect(
              x0 + capDepth,
              dir < 0 ? farY : farY - edgeH,
              innerW - capDepth,
              edgeH,
            ),
            wallPaint,
          );
        }
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
        // Centre on the slot, but draw the cube slightly smaller than it, so
        // perspective expansion cannot make neighbours overlap.
        const slot = blocks[o + 2]! * scale;
        const size = slot * CUBE_FILL;
        const cx = toX(blocks[o]!) + slot / 2;
        const cy = toY(blocks[o + 1]!) + slot / 2;
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
}

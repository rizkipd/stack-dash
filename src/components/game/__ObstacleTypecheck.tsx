import {
  Canvas,
  Fill,
  Picture,
  Skia,
  createPicture,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { OBSTACLE_STRIDE, type RenderState } from '@/game/render/renderState';
import { colors } from '@/theme/colors';

type Props = {
  state: SharedValue<RenderState>;
  width: number;
  height: number;
};

/**
 * Obstacle tone ramp — a *render parameter*, not a set of inlined constants,
 * so a post-MVP wall skin is a config change rather than a refactor
 * (`docs/ART_DIRECTION.md` §3). Two tones come straight from the theme; the
 * rest extend the ramp above and below them and belong in `src/theme/colors.ts`
 * once that file grows obstacle tokens.
 *
 * The ramp is deliberately wide: near-black mortar at one end, near-white cap
 * at the other. Contrast between gameplay objects and background outranks every
 * other consideration here.
 */
const OBSTACLE_TONES = {
  /** Mortar / silhouette. Also the guaranteed-opaque backing for every wall. */
  mortar: '#0D0D11',
  /** Recessed tile body. */
  body: colors.obstacle,
  /** Lit upper band of each tile. */
  lit: colors.obstacleEdge,
  /** Hairline along each tile's top edge — the masonry read. */
  seam: '#6A6F80',
  /** Leading (player-facing) vertical edge of the wall. */
  rim: '#565C6B',
  /** Cap face bordering an opening. Neutral-cool, never cyan: it must not be
   *  confused with the collectible's glow at speed. */
  capFace: '#C3C8D4',
  /** Brightest hairline, exactly on the opening boundary. */
  capEdge: '#F2F5FA',
  /** Hard recess line under the cap, so the bright face cannot smear into the
   *  dark body. */
  capShadow: '#08080B',
} as const;

/**
 * Hard ceiling on tiles emitted for a single wall.
 *
 * A wall may be the full world height (1800 units) while a tile is one wall
 * width (90 units), so 20 rows is the natural maximum; 22 leaves headroom
 * without letting a pathological rect emit hundreds of draw calls.
 */
const MAX_TILE_ROWS = 22;

export function ObstacleTypecheck({ state, width, height }: Props) {
  const picture = useDerivedValue(() => {
    return createPicture((canvas) => {
      const s = state.value;
      const { scale, offsetX, offsetY } = s;

      const toX = (x: number) => x * scale + offsetX;
      const toY = (y: number) => y * scale + offsetY;

      // ===================================================================
      // Obstacles — stacked charcoal tiles, not slabs.
      //
      // Each tile is one wall-width square, so a wall reads as masonry built
      // from cubes and deliberately echoes the player's stack. Lighting is a
      // three-step ramp per tile (bright top hairline → lit upper band →
      // recessed body) over a near-black mortar backing, which is what stops a
      // tall wall reading as one featureless rectangle.
      //
      // Two edges carry the gameplay: the leading (left) face the stack meets,
      // and the cap bordering an opening. Both are drawn brighter than anything
      // else in the wall and with hard boundaries — never faded.
      //
      // **Nothing drawn here exceeds the collision rect.** The cap is inset
      // *inside* the wall rather than overhanging it, so the wall can never
      // look taller or wider than it actually is.
      // ===================================================================

      // --- Precomputed once per frame, never inside the per-wall loop. ---
      const cMortar = Skia.Color(OBSTACLE_TONES.mortar);
      const cRim = Skia.Color(OBSTACLE_TONES.rim);
      const cCapFace = Skia.Color(OBSTACLE_TONES.capFace);
      const cCapEdge = Skia.Color(OBSTACLE_TONES.capEdge);
      const cCapShadow = Skia.Color(OBSTACLE_TONES.capShadow);

      const wallPaint = Skia.Paint();
      wallPaint.setAntiAlias(true);
      const tileBodyPaint = Skia.Paint();
      tileBodyPaint.setAntiAlias(true);
      tileBodyPaint.setColor(Skia.Color(OBSTACLE_TONES.body));
      const tileLitPaint = Skia.Paint();
      tileLitPaint.setAntiAlias(true);
      tileLitPaint.setColor(Skia.Color(OBSTACLE_TONES.lit));
      const tileSeamPaint = Skia.Paint();
      tileSeamPaint.setAntiAlias(true);
      tileSeamPaint.setColor(Skia.Color(OBSTACLE_TONES.seam));

      // Play-field bounds in screen space. `useGameLoop` maps the world to the
      // full canvas height, so a wall touching these is growing from the field
      // edge and has no opening on that side.
      const fieldTop = offsetY;
      const fieldBottom = height;

      /**
       * Draws the lit chamfer where a wall terminates against an opening.
       *
       * `dir` is −1 when the opening lies above the wall (cap on its top edge)
       * and +1 when it lies below. The face is a trapezoid inset toward the far
       * edge, which reads as a 3D cap without any overhang.
       */
      const drawCap = (
        cx: number,
        cw: number,
        edgeY: number,
        dir: number,
        rowHeight: number,
        wallHeight: number,
      ) => {
        const capH = Math.min(
          Math.max(3.5, Math.min(rowHeight * 0.26, 16)),
          wallHeight * 0.35,
        );
        const skew = Math.min(cw * 0.12, 6);
        const nearY = edgeY - dir * capH; // inner edge, against the body
        const farY = edgeY; // the opening boundary itself

        // Hard recess line on the body side of the cap, so the bright face
        // always lands against black instead of bleeding into the tiles.
        wallPaint.setColor(cCapShadow);
        wallPaint.setAlphaf(1);
        canvas.drawRect(
          Skia.XYWHRect(cx, dir < 0 ? nearY : nearY - 1.5, cw, 1.5),
          wallPaint,
        );

        // Capstone: full width at the opening boundary, inset where it meets
        // the shaft. That is the reference sheet's overhanging slab, achieved
        // by narrowing the neck rather than growing past the collision rect.
        const face = Skia.Path.Make();
        face.moveTo(cx + skew, nearY);
        face.lineTo(cx + cw - skew, nearY);
        face.lineTo(cx + cw, farY);
        face.lineTo(cx, farY);
        face.close();
        wallPaint.setColor(cCapFace);
        // An underside is physically darker than a top face; keep the
        // difference small, because readability outranks the lighting model.
        wallPaint.setAlphaf(dir < 0 ? 1 : 0.88);
        canvas.drawPath(face, wallPaint);

        // The boundary hairline, full wall width. These are the most important
        // pixels on screen.
        const edgeH = Math.max(1.5, capH * 0.28);
        wallPaint.setColor(cCapEdge);
        wallPaint.setAlphaf(1);
        canvas.drawRect(
          Skia.XYWHRect(cx, dir < 0 ? farY : farY - edgeH, cw, edgeH),
          wallPaint,
        );
      };

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
        // on-screen band is ever tiled.
        const clipTop = Math.max(wallTop, 0);
        const clipBottom = Math.min(wallBottom, height);
        if (clipBottom <= clipTop) continue;

        // Opaque mortar backing. Drawn before the tiles so a wall is never
        // see-through, whatever the tile loop above it does.
        wallPaint.setColor(cMortar);
        wallPaint.setAlphaf(1);
        canvas.drawRect(
          Skia.XYWHRect(wx, clipTop, ww, clipBottom - clipTop),
          wallPaint,
        );

        // Tile grid: square tiles, one wall-width tall, rounded to divide the
        // wall exactly so both ends terminate on a whole tile. The row count is
        // capped, which is what bounds the draw calls for a full-height wall.
        let rows = Math.round(wh / ww);
        if (rows < 1) rows = 1;
        if (rows > MAX_TILE_ROWS) rows = MAX_TILE_ROWS;
        const tileH = wh / rows;

        const gutter = Math.max(0.75, Math.min(2.5, tileH * 0.06));
        const radius = Math.min(3, tileH * 0.12);
        const bodyX = wx + gutter;
        const bodyW = ww - gutter * 2;
        const litX = bodyX + radius;
        const litW = bodyW - radius * 2;
        const litH = tileH * 0.34;
        const seamH = Math.max(1.25, Math.min(2.5, tileH * 0.075));

        // Stable seed: world y and height never change for a wall's lifetime,
        // so the masonry variation does not crawl as the wall scrolls left.
        const seed = Math.round(obstacles[i + 1]! * 31 + obstacles[i + 3]! * 17);

        const firstRow = Math.max(0, Math.floor((clipTop - wallTop) / tileH));
        const lastRow = Math.min(
          rows - 1,
          Math.floor((clipBottom - wallTop - 0.001) / tileH),
        );

        for (let r = firstRow; r <= lastRow; r += 1) {
          const ty = wallTop + r * tileH;

          // Cheap deterministic hash → ±0.09 brightness, so adjacent tiles
          // differ and the wall reads as individual blocks rather than stripes.
          const n = (((seed + r * 1013) * 9301 + 49297) % 233280) / 233280;
          const jitter = n * 0.18 - 0.09;

          tileBodyPaint.setAlphaf(0.92 + jitter);
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(bodyX, ty, bodyW, tileH - gutter),
              radius,
              radius,
            ),
            tileBodyPaint,
          );

          tileLitPaint.setAlphaf(0.72 + jitter);
          canvas.drawRect(Skia.XYWHRect(litX, ty, litW, litH), tileLitPaint);

          tileSeamPaint.setAlphaf(0.78 + jitter * 0.6);
          canvas.drawRect(Skia.XYWHRect(litX, ty, litW, seamH), tileSeamPaint);
        }

        // Leading edge: the face the stack actually meets. Lighter than the
        // body and dead crisp, so the wall's near side is unmistakable at speed.
        const rimW = Math.max(1.5, Math.min(3, ww * 0.055));
        wallPaint.setColor(cRim);
        wallPaint.setAlphaf(0.95);
        canvas.drawRect(
          Skia.XYWHRect(wx, clipTop, rimW, clipBottom - clipTop),
          wallPaint,
        );

        // Caps, drawn only on ends that border an opening. An end flush with
        // the play-field edge is not an opening and gets nothing.
        if (wallTop > fieldTop + 1) {
          drawCap(wx, ww, wallTop, -1, tileH, wh);
        }
        if (wallBottom < fieldBottom - 1) {
          drawCap(wx, ww, wallBottom, 1, tileH, wh);
        }
      }
    });
  });

  return (
    <Canvas style={{ width, height }}>
      <Fill color={colors.bgMid} />
      <Picture picture={picture} />
    </Canvas>
  );
}

export default ObstacleTypecheck;

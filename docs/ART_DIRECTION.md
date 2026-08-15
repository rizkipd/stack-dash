# Stack Dash --- Art Direction

`image.png` is the **visual reference of record**. This document
transcribes it into buildable tokens.

> **Scope note.** `image.png` also contains a *technology* panel (Vite,
> HTML5 Canvas, Zustand, Howler, Framer Motion, React Router). That
> panel is **superseded** by Amendment A-2026-08-15-3 in `CLAUDE.md`.
> The sheet governs how the game *looks*, not what it is built with.

## 1. Direction

Neon night city. A dark, saturated purple-to-navy skyline sits behind
the play field; gameplay objects read as bright, hard-edged shapes
against it. The mood is arcade and electric, never grim.

The governing constraint from `docs/GAME_DESIGN.md` §12 outranks every
aesthetic choice below:

> **Strong contrast between gameplay objects and background.**

Any glow, bloom or parallax that reduces the readability of an obstacle
edge is a bug, not polish.

## 2. Palette

Sampled from `image.png`. Values are **tunable starting points** for
`src/theme/colors.ts`, not fixed constants.

### Gameplay objects

| Token | Hex | Use |
| --- | --- | --- |
| `block` | `#3B82F6` | Player block front face |
| `blockLight` | `#60A5FA` | Block top face / bevel highlight |
| `blockDark` | `#1D4ED8` | Block side face / bevel shadow |
| `blockLost` | `#EF4444` | Block at the instant of destruction |
| `blockLostDark` | `#B91C1C` | Destruction particle shading |
| `obstacle` | `#27272A` | Wall body |
| `obstacleEdge` | `#3F3F46` | Wall panel lines and top highlight |
| `collect` | `#22D3EE` | `+1` collectible cube |
| `collectGlow` | `#67E8F9` | Collectible bloom halo |

### Background

| Token | Hex | Use |
| --- | --- | --- |
| `bgTop` | `#1E1B4B` | Sky gradient, top |
| `bgMid` | `#4C1D95` | Sky gradient, middle |
| `bgBottom` | `#831843` | Sky gradient, horizon glow |
| `skyline` | `#180F35` | City silhouette |
| `ground` | `#0F0A24` | Ground plane |

### UI

| Token | Hex | Use |
| --- | --- | --- |
| `surface` | `#0B0B12` | Screen background |
| `card` | `#16161F` | Panels, HUD chips |
| `primary` | `#3B82F6` | PLAY, RESUME |
| `secondary` | `#7C3AED` | RESTART, locked SHOP |
| `neutral` | `#3F3F46` | SETTINGS, HOME |
| `accent` | `#F59E0B` | RETRY |
| `danger` | `#EF4444` | GAME OVER title |
| `text` | `#FFFFFF` | Primary text |
| `textDim` | `#A1A1AA` | Labels: SCORE, BLOCKS, BEST |

Accent swatches from the sheet's palette strip --- `#8B5CF6`, `#22C55E`
--- are reserved for post-MVP skins (`docs/FUTURE.md`). Do not spend
them on MVP UI.

## 3. Objects

**Player block.** A genuinely 3D cube in **continuous 360° rotation** about
the X and Y axes, per the asset sheet. Eight vertices are rotated, projected
with weak perspective, and the visible faces drawn back-to-front with
depth-based shading — faking it with a fixed bevel reads as a flat hexagon
once the cube turns.

Three details carry the effect, and all three matter:

-   **Phase offset.** Each block is offset ~0.085 of a revolution from its
    neighbour. Without it the stack spins as one rigid object.
-   **Rotation tracks speed.** Spin rate rises with the difficulty tier and
    again with the in-run ramp — rotation is how speed is *felt*.
-   **Idle bob.** A small sine offset per block, so the stack breathes even
    when the player is still.

The stack also **trails and leans**: vertical velocity ripples up the stack as
a whip, with higher blocks lagging further behind. This is what makes the stack
read as one object with mass rather than a rigid bar.

> **Block colour must be a render parameter, not a constant.** This is
> what makes post-MVP skins a config change instead of a refactor.

**Obstacle.** Near-black column, full-bleed to the play field edge it
grows from, with faint horizontal panel lines and a single lighter top
edge so the opening boundary is unmistakable. Never gradient-fade an
obstacle edge into the background.

**Collectible.** Cyan cube, same silhouette as a player block, wrapped
in a soft radial bloom and a slow pulse. The `+1` label sits below it.
It must never be mistakable for an obstacle at speed --- colour and glow
carry that distinction.

## 4. Typography

Bold condensed sans, uppercase, generous letter spacing --- system
`Inter` / SF Pro at heavy weights is sufficient for MVP; no custom font
dependency.

| Role | Treatment |
| --- | --- |
| Title `STACK DASH` | Two lines, ~48pt, 900 weight. `STACK` white, `DASH` blue-cyan gradient |
| Screen title | ~32pt, 800, `danger` for GAME OVER, `primary` for PAUSED |
| Buttons | ~18pt, 700, uppercase, ~1.5px tracking |
| HUD value | ~28pt, 800, tabular figures so digits don't jitter |
| HUD label | ~12pt, 600, `textDim`, uppercase |

Tabular figures on the HUD are functional, not cosmetic: the distance
counter updates every frame and proportional digits visibly shimmer.

## 5. Layout

**Buttons.** Full-width within a ~280pt column, ~56pt tall, ~14pt
radius, vertical gradient, subtle top inner highlight. Minimum touch
target 44pt.

**HUD** (`docs/GAME_DESIGN.md` priority order): `SCORE` top-left,
`BLOCKS` top-right, pause button below the block count. Label above
value, both left-aligned in their corner. HUD sits inside the safe area
and must never overlap the play field's vertical bounds.

**Locked SHOP.** Rendered in `secondary` at reduced opacity with a lock
glyph and a "COMING SOON" caption. It must read as deliberately
unavailable, not as broken or as a failed load.

## 6. Motion & feedback

From `docs/GAME_DESIGN.md` §11. Every effect below is subordinate to
obstacle readability.

| Event | Treatment |
| --- | --- |
| Block destroyed | Flash `blockLost`, shatter into 6-10 particles, fade ~300ms |
| Collect `+1` | Cube scales up and fades, new block pops onto the stack |
| Collect pulse | Idle bloom breathing, ~1.2s cycle |
| Game Over | Brief desaturation, then transition |
| Screen change | Short cross-fade, ~200ms |

Parallax: skyline scrolls slowest, ground fastest. Purely decorative ---
it must never imply a collision surface that isn't there.

**Explicitly avoided:** heavy screen shake, full-screen flashes, and
particles dense enough to hide an approaching wall. `docs/GAME_DESIGN.md`
§11 rules these out and that ruling stands.

## 7. Accessibility

-   Gameplay never encodes meaning in colour alone --- player, obstacle
    and collectible differ in brightness and glow, not just hue.
-   Respect the OS reduce-motion setting: drop parallax and damp
    particles; never remove the destruction cue itself, which is
    load-bearing feedback.
-   All text targets WCAG AA against its own background.
-   Settings exposes sound, music and haptics toggles independently.

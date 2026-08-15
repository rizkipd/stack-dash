# Stack Dash — Background Art Brief

Owner: UI/UX (`docs/RACI.md` row 16). Reference: the **BACKGROUND LAYERS**
panel in `image copy 2.png`.

The game uses a **hybrid** art pipeline (Product Owner decision, 2026-08-15):

- **Background** — real painted PNG layers, scrolled as parallax. This is where
  illustrated art wins: the layers are large, static, and never recoloured.
- **Cubes, walls, effects** — drawn procedurally in Skia. They spin smoothly at
  any angle rather than snapping to 8 frames, stay sharp at any resolution, and
  recolour for free when skins arrive.

Until these files exist the game falls back to a procedural background, so
nothing is blocked on them.

## Files to export

Drop them in `assets/background/`. Exact filenames — the loader looks for these.

| File | Size | Notes |
| --- | --- | --- |
| `far_city.png` | 2048 × 512 | Distant skyline, heavily hazed. Deep violet/magenta silhouettes against the pink glow band. Lowest contrast of the three. |
| `mid_buildings.png` | 2048 × 640 | More defined towers, blue-violet, sparse lit windows. |
| `near_buildings.png` | 2048 × 768 | Nearest towers. Darkest and most saturated, denser lit windows in cyan and warm yellow. |
| `ground_road.png` | 2048 × 256 | Road strip with the bright warm amber glow line along its top edge. |

### Requirements

1. **PNG with transparency.** Each layer is a silhouette composited over the
   sky. Only `ground_road.png` may be fully opaque across its lower portion.
   Do **not** bake the sky gradient into a layer — the sky is drawn
   procedurally underneath so it scales to any screen without banding.

2. **Seamlessly tileable horizontally.** These scroll forever. The right edge
   must line up pixel-perfectly with the left edge. Verify by placing two
   copies side by side: no seam, no repeated landmark building near the join.

3. **2048 px wide.** At 2× the widest common phone this tiles roughly every two
   screens, which is long enough that the repeat is not obvious. Wider is fine;
   narrower will read as an obvious loop.

4. **No gameplay-coloured elements.** Avoid bright blue (`#3B82F6`), cyan
   (`#22D3EE`) and red (`#EF4444`) as *large* shapes — those read as player
   blocks, collectibles and destroyed blocks. Small lit windows in those hues
   are fine and desirable; a whole building in them is not.

## The rule that outranks everything above

From `docs/ART_DIRECTION.md` §1:

> **Strong contrast between gameplay objects and background.**

Obstacles are near-black (`#27272A`). If the near buildings are equally dark
and equally sharp, an approaching wall becomes hard to read at speed — which
at Insane difficulty is the difference between a fair death and a cheap one.

Keep the near layer **dark but low-contrast and soft**: hazier, less
detailed, lower local contrast than a wall. A gorgeous background that hides an
obstacle is a defect, not a trade-off. If in doubt, push the layers darker and
flatter than looks right in isolation — they are scenery, not subject.

## Optional

| File | Size | Notes |
| --- | --- | --- |
| `sky.png` | 1024 × 2048 | Only if the procedural gradient proves insufficient. Vertical gradient, indigo → violet → magenta horizon. Not tiled; stretched to fill. |

## How they will be used

Scroll rates are proportional to `distance`, slowest at the back:

| Layer | Rate |
| --- | --- |
| Far city | 0.06× |
| Mid buildings | 0.13× |
| Near buildings | 0.24× |
| Ground / road | 0.42× |

Layers anchor to the **bottom** of the screen and are scaled uniformly to the
viewport width, so aspect ratio is preserved on any device. Nothing stretches.

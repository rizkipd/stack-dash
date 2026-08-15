/**
 * `+1` block collectibles.
 * Owner: Gameplay Programmer (`docs/RACI.md` row 10).
 *
 * A collectible adds **exactly one** block and can be collected **once**
 * (QA Plan #11, #12). Both guarantees live here.
 */

import { getDifficultyConfig } from '../config/difficulty';
import { gameplay } from '../config/gameplay';
import type { Rng } from '../engine/Rng';
import type { Collectible, Difficulty } from '../types';

let collectibleIdCounter = 0;

function nextCollectibleId(): string {
  collectibleIdCounter += 1;
  return `collectible-${collectibleIdCounter}`;
}

export function resetCollectibleIds(): void {
  collectibleIdCounter = 0;
}

export const COLLECTIBLE_SIZE = gameplay.blockSize * 0.85;

/**
 * Maybe spawns a collectible inside one of an obstacle's openings.
 *
 * Placing it in a known opening is deliberate: a collectible floating inside a
 * wall would bait the player into a collision, which is exactly the kind of
 * accidental unfairness `docs/GAME_DESIGN.md` §6 rules out.
 */
export function maybeSpawnCollectible(
  difficulty: Difficulty,
  rng: Rng,
  openings: readonly { start: number; end: number }[],
  x: number,
  stackHeight: number,
): Collectible | null {
  const { collectibleChance } = getDifficultyConfig(difficulty);
  if (!rng.chance(collectibleChance)) return null;

  // Only openings that comfortably fit the stack plus the item.
  const usable = openings.filter(
    (o) => o.end - o.start >= stackHeight + COLLECTIBLE_SIZE,
  );
  if (usable.length === 0) return null;

  const opening = rng.pick(usable);
  const margin = COLLECTIBLE_SIZE / 2 + 4;
  const y = rng.nextRange(opening.start + margin, opening.end - margin);

  return {
    id: nextCollectibleId(),
    x,
    y,
    size: COLLECTIBLE_SIZE,
    collected: false,
  };
}

/**
 * Marks the given collectibles as collected.
 *
 * Returns how many were *newly* collected — the caller adds exactly that many
 * blocks. Filtering on `collected` here is what makes double-collection
 * impossible even if the same item is reported twice in one frame.
 */
export function collect(
  collectibles: Collectible[],
  toCollect: readonly Collectible[],
): { collectibles: Collectible[]; gained: number } {
  if (toCollect.length === 0) return { collectibles, gained: 0 };

  const ids = new Set(toCollect.map((c) => c.id));
  let gained = 0;

  const next = collectibles.map((item) => {
    if (!item.collected && ids.has(item.id)) {
      gained += 1;
      return { ...item, collected: true };
    }
    return item;
  });

  return { collectibles: next, gained };
}

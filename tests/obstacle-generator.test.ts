import { createRng } from '../src/game/engine/Rng';
import { gameplay } from '../src/game/config/gameplay';
import {
  generateObstacle,
  nextSpawnGap,
  resetObstacleIds,
} from '../src/game/systems/ObstacleGenerator';
import {
  ALL_PATTERNS,
  buildPattern,
} from '../src/game/patterns/obstaclePatterns';
import {
  MIN_REACTION_SECONDS,
  validatePattern,
} from '../src/game/patterns/validatePattern';
import { DIFFICULTIES, type Difficulty } from '../src/game/types';

const SPAWN_X = gameplay.playerX + gameplay.spawnAheadDistance;

function context(over: Partial<Parameters<typeof generateObstacle>[0]> = {}) {
  return {
    difficulty: 'medium' as Difficulty,
    rng: createRng(1234),
    speed: gameplay.baseSpeed,
    distance: 0,
    stackHeight: gameplay.blockSize * 8,
    playerY: gameplay.worldHeight / 2,
    spawnX: SPAWN_X,
    ...over,
  };
}

beforeEach(resetObstacleIds);

describe('fairness validation', () => {
  it('rejects a pattern with no opening', () => {
    const result = validatePattern(
      { rects: [], openings: [] },
      {
        spawnX: SPAWN_X,
        speed: gameplay.baseSpeed,
        stackHeight: 100,
        playerY: 900,
      },
    );
    expect(result).toEqual({ ok: false, reason: 'noOpening' });
  });

  it('rejects an opening the stack cannot fit through', () => {
    const result = validatePattern(
      { rects: [], openings: [{ start: 800, end: 820 }] },
      {
        spawnX: SPAWN_X,
        speed: gameplay.baseSpeed,
        stackHeight: 600,
        playerY: 810,
      },
    );
    expect(result.reason).toBe('openingTooSmall');
  });

  // The rule that keeps Insane brutal rather than unfair.
  it('rejects a spawn that gives too little reaction time', () => {
    const tooClose = gameplay.playerX + gameplay.blockSize;
    const result = validatePattern(
      { rects: [], openings: [{ start: 0, end: gameplay.worldHeight }] },
      {
        spawnX: tooClose,
        speed: gameplay.baseSpeed * 4,
        stackHeight: 100,
        playerY: 900,
      },
    );
    expect(result.reason).toBe('insufficientReactionDistance');
  });

  it('rejects a spawn on top of the player', () => {
    const result = validatePattern(
      { rects: [], openings: [{ start: 0, end: gameplay.worldHeight }] },
      {
        spawnX: gameplay.playerX - 10,
        speed: gameplay.baseSpeed,
        stackHeight: 100,
        playerY: 900,
      },
    );
    expect(result.reason).toBe('spawnsOnPlayer');
  });

  it('scales the reaction requirement with speed', () => {
    const opening = { rects: [], openings: [{ start: 0, end: gameplay.worldHeight }] };
    const distance = 400;
    const spawnX = gameplay.playerX + gameplay.blockSize / 2 + distance;

    // Exactly at the threshold speed it passes...
    const okSpeed = distance / MIN_REACTION_SECONDS - 1;
    expect(
      validatePattern(opening, {
        spawnX,
        speed: okSpeed,
        stackHeight: 100,
        playerY: 900,
      }).ok,
    ).toBe(true);

    // ...and just above it, it does not.
    const fastSpeed = distance / MIN_REACTION_SECONDS + 50;
    expect(
      validatePattern(opening, {
        spawnX,
        speed: fastSpeed,
        stackHeight: 100,
        playerY: 900,
      }).reason,
    ).toBe('insufficientReactionDistance');
  });

  it('rejects a sequence whose openings cannot be connected in time', () => {
    // Both openings are comfortably wide, so this fails on the *sequence*
    // rather than on either pattern in isolation.
    const result = validatePattern(
      { rects: [], openings: [{ start: 1560, end: 1800 }] },
      {
        spawnX: SPAWN_X,
        speed: gameplay.baseSpeed,
        stackHeight: 60,
        playerY: 1700,
        // Previous opening is at the far opposite end and essentially adjacent,
        // leaving no room to cross between them.
        previousOpenings: [{ start: 0, end: 240 }],
        previousRightEdge: SPAWN_X - 5,
      },
    );
    expect(result.reason).toBe('impossibleCombination');
  });
});

describe('generation', () => {
  // QA Plan #16.
  it('is reproducible from a seed', () => {
    resetObstacleIds();
    const a = generateObstacle(context({ rng: createRng(99) }));
    resetObstacleIds();
    const b = generateObstacle(context({ rng: createRng(99) }));
    expect(JSON.stringify(a.obstacle.rects)).toBe(JSON.stringify(b.obstacle.rects));
    expect(a.openings).toEqual(b.openings);
  });

  it('produces different layouts for different seeds', () => {
    const a = generateObstacle(context({ rng: createRng(1) }));
    const b = generateObstacle(context({ rng: createRng(9999) }));
    expect(JSON.stringify(a.obstacle.rects)).not.toBe(JSON.stringify(b.obstacle.rects));
  });

  // QA Plan #17 — the headline guarantee.
  it.each(DIFFICULTIES)(
    'only ever emits passable obstacles on %s, across many seeds',
    (difficulty) => {
      for (let seed = 0; seed < 250; seed += 1) {
        const rng = createRng(seed);
        const stackHeight = gameplay.blockSize * (2 + (seed % 9));
        const playerY = 200 + (seed * 37) % (gameplay.worldHeight - 400);

        const result = generateObstacle(
          context({ difficulty, rng, stackHeight, playerY, distance: seed * 40 }),
        );

        // Whatever was emitted — rolled or fallback — must have a real opening
        // big enough for the stack.
        const widest = result.openings.reduce(
          (max, o) => Math.max(max, o.end - o.start),
          0,
        );
        expect(widest).toBeGreaterThanOrEqual(stackHeight);
      }
    },
  );

  it('never spawns an obstacle on top of the player', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const result = generateObstacle(context({ rng: createRng(seed) }));
      expect(result.obstacle.x).toBeGreaterThan(
        gameplay.playerX + gameplay.blockSize / 2,
      );
    }
  });

  it('assigns unique ids', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      ids.add(generateObstacle(context({ rng: createRng(i) })).obstacle.id);
    }
    expect(ids.size).toBe(30);
  });

  it('tightens spawn spacing as distance grows, but never past the floor', () => {
    const near = nextSpawnGap('medium', 0);
    const far = nextSpawnGap('medium', 20000);
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(near * 0.6);
  });
});

describe('pattern library', () => {
  it.each(ALL_PATTERNS)('%s always yields at least one opening', (type) => {
    for (let seed = 0; seed < 60; seed += 1) {
      const result = buildPattern(type, {
        gap: gameplay.worldHeight * 0.3,
        rng: createRng(seed),
      });
      const widest = result.openings.reduce(
        (max, o) => Math.max(max, o.end - o.start),
        0,
      );
      expect(widest).toBeGreaterThan(0);
    }
  });

  it.each(ALL_PATTERNS)('%s keeps every opening inside the world', (type) => {
    for (let seed = 0; seed < 60; seed += 1) {
      const result = buildPattern(type, {
        gap: gameplay.worldHeight * 0.3,
        rng: createRng(seed),
      });
      for (const opening of result.openings) {
        expect(opening.start).toBeGreaterThanOrEqual(-1);
        expect(opening.end).toBeLessThanOrEqual(gameplay.worldHeight + 1);
      }
    }
  });
});

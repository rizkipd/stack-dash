/**
 * The cube's face-adjacency table.
 *
 * `drawCube` builds a cube's silhouette by keeping, from each visible face,
 * the edges whose neighbouring face is culled. That is only correct if
 * `CUBE_FACE_NBR` really is the cube's adjacency: one wrong entry produces a
 * silhouette that is open or self-intersecting, and only at the rotations
 * where that particular face pair straddles the horizon. It type-checks, it
 * lints, and it is invisible in a still — exactly the failure mode this
 * renderer has shipped before.
 *
 * So the table is asserted against the face list it is supposed to describe,
 * rather than trusted.
 */
import { CUBE_FACES, CUBE_FACE_NBR } from '@/components/game/scene';

/** Undirected key for the edge between two vertices. */
const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

describe('cube topology', () => {
  it('describes six quad faces over eight vertices', () => {
    expect(CUBE_FACES).toHaveLength(6);
    const seen = new Set<number>();
    for (const face of CUBE_FACES) {
      expect(face).toHaveLength(4);
      expect(new Set(face).size).toBe(4);
      for (const v of face) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(8);
        seen.add(v);
      }
    }
    expect(seen.size).toBe(8);
  });

  it('has twelve edges, each shared by exactly two faces', () => {
    const owners = new Map<string, number[]>();
    CUBE_FACES.forEach((face, f) => {
      for (let j = 0; j < 4; j += 1) {
        const k = key(face[j]!, face[(j + 1) % 4]!);
        const list = owners.get(k) ?? [];
        list.push(f);
        owners.set(k, list);
      }
    });

    expect(owners.size).toBe(12);
    for (const [edge, faces] of owners) {
      expect(`${edge}:${faces.length}`).toBe(`${edge}:2`);
    }
  });

  it('CUBE_FACE_NBR matches the adjacency implied by CUBE_FACES', () => {
    const owners = new Map<string, number[]>();
    CUBE_FACES.forEach((face, f) => {
      for (let j = 0; j < 4; j += 1) {
        const k = key(face[j]!, face[(j + 1) % 4]!);
        const list = owners.get(k) ?? [];
        list.push(f);
        owners.set(k, list);
      }
    });

    expect(CUBE_FACE_NBR).toHaveLength(24);
    CUBE_FACES.forEach((face, f) => {
      for (let j = 0; j < 4; j += 1) {
        const shared = owners.get(key(face[j]!, face[(j + 1) % 4]!))!;
        const expected = shared[0] === f ? shared[1] : shared[0];
        expect({ face: f, edge: j, nbr: CUBE_FACE_NBR[f * 4 + j] }).toEqual({
          face: f,
          edge: j,
          nbr: expected,
        });
      }
    });
  });

  it('is symmetric: a face is its neighbour’s neighbour', () => {
    CUBE_FACES.forEach((face, f) => {
      for (let j = 0; j < 4; j += 1) {
        const nbr = CUBE_FACE_NBR[f * 4 + j]!;
        // The same edge, walked from the neighbour, must point back at `f`.
        const nbrFace = CUBE_FACES[nbr]!;
        const k = key(face[j]!, face[(j + 1) % 4]!);
        let back = -1;
        for (let m = 0; m < 4; m += 1) {
          if (key(nbrFace[m]!, nbrFace[(m + 1) % 4]!) === k) {
            back = CUBE_FACE_NBR[nbr * 4 + m]!;
          }
        }
        expect(back).toBe(f);
      }
    });
  });

  it('never lists a face as its own neighbour', () => {
    CUBE_FACES.forEach((_, f) => {
      for (let j = 0; j < 4; j += 1) {
        expect(CUBE_FACE_NBR[f * 4 + j]).not.toBe(f);
      }
    });
  });
});

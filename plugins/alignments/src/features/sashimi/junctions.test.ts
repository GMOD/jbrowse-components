import { downJunctionKeys, junctionKey, mergeJunctions } from './junctions.ts'
import { SPLICE_MOTIF_NON_CANONICAL, SPLICE_MOTIF_UNKNOWN } from './motif.ts'

import type { RegionJunctions, SashimiArcsMode } from './junctions.ts'

// [start, end, count] per junction, optionally with a strand and a motif code.
type Spec =
  | [number, number, number]
  | [number, number, number, number]
  | [number, number, number, number, number]

const keep = (minSashimiScore = 0, hideNonCanonicalJunctions = false) => ({
  minSashimiScore,
  hideNonCanonicalJunctions,
})

function region(refName: string, junctions: Spec[]): RegionJunctions {
  return {
    refName,
    data: {
      sashimiX1: new Uint32Array(junctions.map(j => j[0])),
      sashimiX2: new Uint32Array(junctions.map(j => j[1])),
      sashimiCounts: new Uint32Array(junctions.map(j => j[2])),
      sashimiStrands: new Int8Array(junctions.map(j => j[3] ?? 0)),
      sashimiMotifs: new Uint8Array(junctions.map(j => j[4] ?? 0)),
    },
  }
}

function down(regions: RegionJunctions[], mode: SashimiArcsMode, min = 0) {
  return downJunctionKeys(mergeJunctions(regions, keep(min)).values(), mode)
}

// Two interleaving junctions, the second thinly supported.
const CROSSING: Spec[] = [
  [100, 500, 20],
  [300, 700, 2],
]

describe('mergeJunctions', () => {
  test('collapses the copies each region re-emits of one junction', () => {
    // A read carrying a junction spans it, so a BAM overlap query returns that
    // read for EVERY region intersecting its span — collapsed introns hit this
    // on every gene. Counts are the region's own view of the junction, so the
    // max is the best available estimate and the heavier copy wins the tint.
    const merged = mergeJunctions(
      [
        region('chr1', [[100, 1100, 5, -1]]),
        region('chr1', [[100, 1100, 8, 1]]),
        region('chr1', [[100, 1100, 3, -1]]),
      ],
      keep(),
    )
    expect([...merged.values()]).toEqual([
      {
        key: 'chr1:100:1100',
        refName: 'chr1',
        start: 100,
        end: 1100,
        count: 8,
        strand: 1,
        motif: 0,
      },
    ])
  })

  test('keeps same-coordinate junctions on different chromosomes apart', () => {
    const merged = mergeJunctions(
      [region('chr1', [[100, 500, 4]]), region('chr2', [[100, 500, 9]])],
      keep(),
    )
    expect([...merged.keys()]).toEqual(['chr1:100:500', 'chr2:100:500'])
  })

  test('drops junctions under the score floor', () => {
    const merged = mergeJunctions(
      [
        region('chr1', [
          [100, 500, 1],
          [200, 900, 2],
        ]),
      ],
      keep(2),
    )
    expect([...merged.keys()]).toEqual(['chr1:200:900'])
  })

  test('hides a non-canonical junction only when asked, never an unread one', () => {
    const regions = [
      region('chr1', [
        [100, 500, 9, 0, SPLICE_MOTIF_NON_CANONICAL],
        [200, 900, 9, 0, 1],
        [300, 700, 9, 0, SPLICE_MOTIF_UNKNOWN],
      ]),
    ]
    expect([...mergeJunctions(regions, keep(0, false)).keys()]).toEqual([
      'chr1:100:500',
      'chr1:200:900',
      'chr1:300:700',
    ])
    expect([...mergeJunctions(regions, keep(0, true)).keys()]).toEqual([
      'chr1:200:900',
      'chr1:300:700',
    ])
  })

  test('a copy that read the motif fills in one that could not', () => {
    // A region whose sequence stops short of the far end reports unknown; the
    // region holding that end reports the motif. Either order.
    const read = region('chr1', [[100, 1100, 30, 0, 3]])
    const unread = region('chr1', [[100, 1100, 1, 0, SPLICE_MOTIF_UNKNOWN]])
    for (const regions of [
      [read, unread],
      [unread, read],
    ]) {
      expect([...mergeJunctions(regions, keep()).values()][0]!.motif).toBe(3)
    }
  })

  test('a region reporting only a clipped count cannot lower the merged one', () => {
    // A region spanning the junction sees every read carrying it; one merely
    // abutting an end sees a strict subset. Order must not matter.
    const spanning = region('chr1', [[100, 1100, 30]])
    const clipping = region('chr1', [[100, 1100, 1]])
    for (const regions of [
      [spanning, clipping],
      [clipping, spanning],
    ]) {
      expect([...mergeJunctions(regions, keep()).values()][0]!.count).toBe(30)
    }
  })
})

describe('downJunctionKeys', () => {
  test('up sends nothing down, down sends everything', () => {
    const regions = [region('chr1', CROSSING)]
    expect(down(regions, 'up').size).toBe(0)
    expect([...down(regions, 'down')]).toEqual(['chr1:100:500', 'chr1:300:700'])
  })

  test('auto splits a crossing pair, dropping the lighter one', () => {
    // Heaviest-first, so the 20-read junction claims the upper band and the
    // 2-read one is the one pushed into the strip below coverage.
    expect([...down([region('chr1', CROSSING)], 'auto')]).toEqual([
      'chr1:300:700',
    ])
  })

  test('auto leaves nested and disjoint junctions alone', () => {
    // Nested/disjoint pairs never visually collide once heights are span-scaled,
    // and a shared donor (100-700 vs 100-200) nests rather than interleaves — so
    // none of these is worth splitting across bands.
    const junctions: Spec[] = [
      [100, 700, 9],
      [200, 400, 9],
      [100, 200, 9],
      [800, 900, 9],
    ]
    expect(down([region('chr1', junctions)], 'auto').size).toBe(0)
  })

  test('auto pools a junction across the regions that re-emitted it', () => {
    // Collapsed introns report one gene's junctions in each of its exon regions.
    // The crossing pair is the same pair however many regions repeat it, so the
    // greedy must see two junctions, not six.
    const repeated = [
      region('chr1', CROSSING),
      region('chr1', CROSSING),
      region('chr1', CROSSING),
    ]
    expect([...down(repeated, 'auto')]).toEqual(['chr1:300:700'])
  })

  test('auto sees a pair that interleaves across two regions of one gene', () => {
    const split = [
      region('chr1', [CROSSING[0]!]),
      region('chr1', [CROSSING[1]!]),
    ]
    expect(down(split, 'auto').size).toBe(1)
  })

  test('auto never crosses chromosomes', () => {
    // Each refName's displayed regions occupy their own screen range, so
    // junctions on different ones cannot visually collide. Pooling them onto one
    // bp number line read chr1:10k-50k and chr2:30k-70k as interleaving and
    // reserved a strip below coverage that no arc was ever bound for.
    const perChrom = [
      region('chr1', [[10_000, 50_000, 20]]),
      region('chr2', [[30_000, 70_000, 20]]),
    ]
    expect(down(perChrom, 'auto').size).toBe(0)
    // the same two spans on ONE chromosome do interleave
    const oneChrom = [
      region('chr1', [
        [10_000, 50_000, 20],
        [30_000, 70_000, 20],
      ]),
    ]
    expect(down(oneChrom, 'auto').size).toBe(1)
  })

  test('the score filter frees the strip when it leaves nothing to cross', () => {
    const regions = [region('chr1', CROSSING)]
    expect(down(regions, 'auto', 2).size).toBe(1)
    // filtering the 2-read junction leaves a single junction => no crossing
    expect(down(regions, 'auto', 5).size).toBe(0)
  })

  test('every emitted key is one junctionKey builds', () => {
    // The geometry looks its arcs up by this key, so the two spellings agreeing
    // is what makes the reserved strip and the arcs drawn into it one decision.
    expect(
      down([region('chr1', CROSSING)], 'auto').has(
        junctionKey('chr1', 300, 700),
      ),
    ).toBe(true)
  })
})

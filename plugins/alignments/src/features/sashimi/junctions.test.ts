import { downJunctionKeys, junctionKey, mergeJunctions } from './junctions.ts'
import {
  DINUCLEOTIDE_UNKNOWN,
  encodeDinucleotide,
  SPLICE_MOTIF_NON_CANONICAL,
} from './motif.ts'

import type { RegionJunctions, SashimiArcsMode } from './junctions.ts'

// [start, end, count] per junction, plus whatever this test cares about of the
// raw strand votes and the two motif halves. An absent dinucleotide is an end
// this region's sequence window did not cover.
interface JunctionDetail {
  fwd?: number
  rev?: number
  donor?: string
  acceptor?: string
}
type Spec = [number, number, number] | [number, number, number, JunctionDetail]

const keep = (minSashimiScore = 0, hideNonCanonicalJunctions = false) => ({
  minSashimiScore,
  hideNonCanonicalJunctions,
})

function dinucleotide(bases: string | undefined) {
  return bases === undefined ? DINUCLEOTIDE_UNKNOWN : encodeDinucleotide(bases)
}

function region(refName: string, junctions: Spec[]): RegionJunctions {
  const details = junctions.map(j => j[3] ?? {})
  return {
    refName,
    data: {
      sashimiX1: new Uint32Array(junctions.map(j => j[0])),
      sashimiX2: new Uint32Array(junctions.map(j => j[1])),
      sashimiCounts: new Uint32Array(junctions.map(j => j[2])),
      sashimiFwd: new Uint32Array(details.map(d => d.fwd ?? 0)),
      sashimiRev: new Uint32Array(details.map(d => d.rev ?? 0)),
      sashimiDonors: new Uint8Array(details.map(d => dinucleotide(d.donor))),
      sashimiAcceptors: new Uint8Array(
        details.map(d => dinucleotide(d.acceptor)),
      ),
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
        region('chr1', [[100, 1100, 5, { rev: 5 }]]),
        region('chr1', [[100, 1100, 8, { fwd: 8 }]]),
        region('chr1', [[100, 1100, 3, { rev: 3 }]]),
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
        [100, 500, 9, { donor: 'AA', acceptor: 'CC' }],
        [200, 900, 9, { donor: 'GT', acceptor: 'AG' }],
        [300, 700, 9],
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

  // The hide filter tests a property of the JUNCTION, so it has to run on the
  // merged motif. Applied per copy it dropped the copy that read the motif
  // before that answer reached the merge, and the junction survived as the
  // untinted low-count copy of a junction one region had classified
  // non-canonical.
  test('hiding non-canonical uses the merged motif, not one region s view', () => {
    const classified = region('chr1', [
      [100, 1100, 40, { donor: 'AA', acceptor: 'CC' }],
    ])
    const unread = region('chr1', [[100, 1100, 3]])
    for (const regions of [
      [classified, unread],
      [unread, classified],
    ]) {
      expect([...mergeJunctions(regions, keep(0, true)).keys()]).toEqual([])
      // And with the filter off it is one junction carrying both answers.
      expect([...mergeJunctions(regions, keep(0, false)).values()]).toEqual([
        {
          key: 'chr1:100:1100',
          refName: 'chr1',
          start: 100,
          end: 1100,
          count: 40,
          strand: 0,
          motif: SPLICE_MOTIF_NON_CANONICAL,
        },
      ])
    }
  })

  test('a copy that read the motif fills in one that could not', () => {
    // A region whose sequence stops short of the far end reports unknown; the
    // region holding that end reports the motif. Either order.
    const read = region('chr1', [
      [100, 1100, 30, { donor: 'GC', acceptor: 'AG' }],
    ])
    const unread = region('chr1', [[100, 1100, 1]])
    for (const regions of [
      [read, unread],
      [unread, read],
    ]) {
      expect([...mergeJunctions(regions, keep()).values()][0]!.motif).toBe(3)
    }
  })

  // The collapsed-intron layout (one padded exon per displayed region) puts a
  // junction's two ends in DIFFERENT regions by construction, so neither copy
  // can classify the pair and a per-junction motif left every arc in the view
  // unlabelled. The halves merge separately for exactly this.
  test('two regions holding one end each still classify the junction', () => {
    const donorSide = region('chr1', [[100, 1100, 30, { donor: 'GT' }]])
    const acceptorSide = region('chr1', [[100, 1100, 12, { acceptor: 'AG' }]])
    for (const regions of [
      [donorSide, acceptorSide],
      [acceptorSide, donorSide],
    ]) {
      const merged = [...mergeJunctions(regions, keep()).values()][0]!
      expect(merged.motif).toBe(1)
      // and the motif the merge resolved is what tints an untagged junction
      expect(merged.strand).toBe(1)
    }
  })

  test('the heavier copy s strand votes win, the motif only breaking a tie', () => {
    const tagged = region('chr1', [
      [100, 1100, 30, { rev: 30, donor: 'GT', acceptor: 'AG' }],
    ])
    const untagged = region('chr1', [[100, 1100, 4]])
    expect(
      [...mergeJunctions([tagged, untagged], keep()).values()][0]!.strand,
    ).toBe(-1)
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

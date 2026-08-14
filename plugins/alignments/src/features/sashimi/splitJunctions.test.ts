import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { namesToBlock } from '../../shared/readNameBlock.ts'
import {
  LINKED_READ_COLOR_SPLIT_INV,
  LINKED_READ_COLOR_SPLIT_NORMAL,
} from '../linkedReads/compute.ts'
import {
  computeSplitJunctionArcs,
  mergeSplitJunctions,
} from './splitJunctions.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// The BCR-ABL1 loci the tutorial's k562_bcr_abl_split figure is about, as two
// displayed regions of one view — the layout this module exists for.
const CHR22_BP = 23_290_413
const CHR9_BP = 130_854_064
const REGIONS = [{ refName: 'chr22' }, { refName: 'chr9' }]

interface Seg {
  name: string
  start: number
  end: number
  strand: number
  // Clip at the start of the READ, which is what orders a molecule's segments.
  clip: number
  flags?: number
}

// One region's fetch result, carrying only the fields the read walk reads.
function regionData(segs: Seg[]): PileupDataResult {
  const readPositions = new Uint32Array(segs.length * 2)
  segs.forEach((s, i) => {
    readPositions[i * 2] = s.start
    readPositions[i * 2 + 1] = s.end
  })
  return makePileupDataResult({
    ...namesToBlock(segs.map(s => s.name)),
    // Distinct per segment, since `dedupeByReadId` collapses a repeated key —
    // that is how the same read arriving from two regions is kept from looking
    // like a two-segment split read.
    readKeys: segs.map((s, i) => `${s.name}.${s.clip}.${i}`),
    readFlags: Uint16Array.from(segs.map(s => s.flags ?? 0)),
    readStrands: Int8Array.from(segs.map(s => s.strand)),
    readPositions,
    readClipAtStart: Uint32Array.from(segs.map(s => s.clip)),
  })
}

/**
 * One unpaired molecule split across the two regions, as the pair of segments
 * each region's fetch returns — with both breakpoints landing on `a` and `b`
 * whatever the strands, so a test can vary orientation without also moving the
 * junction it is asserting about.
 *
 * Which genomic edge that is flips twice over (`connectionEndpointBps`): the
 * first segment along the read contributes its read-TRAILING edge and the second
 * its read-LEADING edge, and each of those is `start` or `end` depending on the
 * segment's strand.
 *
 * `strand: -1` is the reverse-complement of the same molecule, which the aligner
 * reports with the chr9 arm first along the read — the end swap the canonical
 * ordering has to undo. `secondStrand: -1` alone is an inverted junction.
 */
function fusionMolecule(
  name: string,
  {
    a,
    b,
    strand = 1,
    secondStrand = strand,
  }: {
    a: number
    b: number
    strand?: number
    secondStrand?: number
  },
): [Seg, Seg] {
  const reversed = strand === -1
  // chr22 is first along the read when forward (trailing edge, = `end` at
  // strand +1) and second when reversed (leading edge, = `end` at strand -1).
  // The same span either way.
  const chr22 = {
    name,
    start: a - 100,
    end: a,
    strand,
    clip: reversed ? 100 : 0,
    ...(reversed ? { flags: SAM_FLAG_SUPPLEMENTARY } : {}),
  }
  // chr9 contributes its `end` only in the one case where it is the SECOND
  // segment and on the minus strand — a forward molecule crossing an inverted
  // junction.
  const chr9EndIsBreakpoint = !reversed && secondStrand === -1
  const chr9 = {
    name,
    start: chr9EndIsBreakpoint ? b - 100 : b,
    end: chr9EndIsBreakpoint ? b : b + 100,
    strand: secondStrand,
    clip: reversed ? 0 : 100,
    ...(reversed ? {} : { flags: SAM_FLAG_SUPPLEMENTARY }),
  }
  return [chr22, chr9]
}

// The two-region map a set of fusion molecules produces.
function fusionMap(
  mols: { a: number; b: number; strand?: number; secondStrand?: number }[],
) {
  const pairs = mols.map((m, i) => fusionMolecule(`mol${i}`, m))
  return new Map([
    [0, regionData(pairs.map(p => p[0]))],
    [1, regionData(pairs.map(p => p[1]))],
  ])
}

function merge(
  laidOutPileupMap: Map<number, PileupDataResult>,
  { windowBp = 10, minScore = 1 } = {},
) {
  return mergeSplitJunctions({
    laidOutPileupMap,
    displayedRegions: REGIONS,
    windowBp,
    minScore,
  })
}

const CLEAN = { a: CHR22_BP, b: CHR9_BP }

describe('mergeSplitJunctions', () => {
  test('coalesces every molecule over one fusion into a single counted junction', () => {
    const junctions = merge(fusionMap([CLEAN, CLEAN, CLEAN]))
    expect(junctions).toHaveLength(1)
    expect(junctions[0]).toMatchObject({
      e1: { displayedRegionIndex: 0, refName: 'chr22', bp: CHR22_BP },
      e2: { displayedRegionIndex: 1, refName: 'chr9', bp: CHR9_BP },
      count: 3,
      colorType: LINKED_READ_COLOR_SPLIT_NORMAL,
    })
  })

  test('a molecule sequenced the other way is the same junction, not a second one', () => {
    // The reverse-complement of the same fusion reports the chr9 arm first along
    // the read, on the minus strand. Both breakpoint coordinates come back
    // identical and the two ENDS come back swapped, so without the canonical
    // ordering this is one junction drawn as two arcs, each with half the count.
    const junctions = merge(fusionMap([CLEAN, { ...CLEAN, strand: -1 }]))
    expect(junctions).toHaveLength(1)
    expect(junctions[0]).toMatchObject({
      count: 2,
      e1: { bp: CHR22_BP },
      e2: { bp: CHR9_BP },
    })
  })

  test('scattered endpoints inside the window join, and report the modal site', () => {
    // Microhomology moves an arm's breakpoint by a base or two. The drawn
    // coordinate must be one a read actually reported — the heaviest — never an
    // average of them.
    const junctions = merge(
      fusionMap([
        CLEAN,
        CLEAN,
        CLEAN,
        { a: CHR22_BP + 3, b: CHR9_BP },
        { a: CHR22_BP - 2, b: CHR9_BP + 1 },
      ]),
    )
    expect(junctions).toHaveLength(1)
    expect(junctions[0]).toMatchObject({
      count: 5,
      e1: { bp: CHR22_BP },
      e2: { bp: CHR9_BP },
    })
  })

  test('a window of 0 keeps every exact site apart', () => {
    const mols = [CLEAN, CLEAN, { a: CHR22_BP + 3, b: CHR9_BP }]
    expect(merge(fusionMap(mols), { windowBp: 0 })).toHaveLength(2)
    expect(merge(fusionMap(mols), { windowBp: 10 })).toHaveLength(1)
  })

  test('endpoints further apart than the window stay distinct junctions', () => {
    // The failure the window must not cause: two real breakpoints of one complex
    // event merged into an arc indistinguishable from a clean junction.
    expect(
      merge(fusionMap([CLEAN, { a: CHR22_BP + 5000, b: CHR9_BP }])),
    ).toHaveLength(2)
  })

  test('the score floor drops light junctions', () => {
    const map = fusionMap([CLEAN, CLEAN, { a: CHR22_BP + 5000, b: CHR9_BP }])
    expect(merge(map, { minScore: 2 })).toHaveLength(1)
    expect(merge(map, { minScore: 3 })).toHaveLength(0)
  })

  test('an inverted junction buckets apart from a co-linear one', () => {
    // Different connection type, therefore a different tint, so merging the two
    // would draw one arc in a colour half its reads contradict.
    const junctions = merge(fusionMap([CLEAN, { ...CLEAN, secondStrand: -1 }]))
    expect(junctions.map(j => j.colorType).sort((x, y) => x - y)).toEqual(
      [LINKED_READ_COLOR_SPLIT_NORMAL, LINKED_READ_COLOR_SPLIT_INV].sort(
        (x, y) => x - y,
      ),
    )
  })

  test('mate links are not junctions', () => {
    // A plain pair: two reads of one fragment, neither supplementary. It
    // resolves to a mate link, which is a fact about a fragment rather than a
    // breakpoint a molecule crossed, so there is no junction to count.
    const map = new Map([
      [
        0,
        regionData([
          {
            name: 'pair',
            start: 1000,
            end: 1100,
            strand: 1,
            clip: 0,
            flags: SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
          },
          {
            name: 'pair',
            start: 1400,
            end: 1500,
            strand: -1,
            clip: 0,
            flags: SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
          },
        ]),
      ],
    ])
    expect(merge(map)).toEqual([])
  })
})

// Distinguishable values, not makeTestPalette's all-zero default: one assertion
// below is that two connection types carry different colours, which an
// everything-is-black palette satisfies vacuously. `colorSupplementary` is the
// co-linear split's swatch — see `swatchPaletteKeys`.
const PALETTE = makeTestPalette({
  colorSupplementary: [0.1, 0.2, 0.3],
  colorSplitInversion: [0.4, 0.5, 0.6],
})

// Each region gets its own half of a 2000px view: chr22 around x=400, chr9
// around x=1400.
function bpToScreenX(_refName: string, bp: number, idx?: number) {
  return idx === 1 ? 1400 + (bp - CHR9_BP) : 400 + (bp - CHR22_BP)
}

const HEIGHTS = { coverageHeight: 100, sashimiArcsHeight: 40 }
// The 'up' band's baseline: the coverage histogram's own zero line, one
// y-scalebar offset in from each end of the band.
const UP_BASELINE = 100 - 2 * YSCALEBAR_LABEL_OFFSET
const MAX_ARC_FRAC = 0.95

function arcsFor(junctions: ReturnType<typeof mergeSplitJunctions>) {
  return computeSplitJunctionArcs({
    junctions,
    bpToScreenX,
    heights: HEIGHTS,
    colors: PALETTE,
  })
}

describe('computeSplitJunctionArcs', () => {
  test('draws one arc across the seam, carrying both refNames and the count', () => {
    const arcs = arcsFor(merge(fusionMap([CLEAN, CLEAN])))
    expect(arcs).toHaveLength(1)
    expect(arcs[0]).toMatchObject({
      refName: 'chr22',
      endRefName: 'chr9',
      start: CHR22_BP,
      end: CHR9_BP,
      score: 2,
      side: 'up',
      // No single strand: a split junction joins two segments whose strands may
      // differ, and that difference is the connection type carrying the tint.
      strand: 0,
    })
    // Feet at each end's own projection rather than clamped into one region:
    // this is the only producer whose two ends resolve through different
    // displayed regions.
    expect(arcs[0]!.d.startsWith(`M 400 ${UP_BASELINE} `)).toBe(true)
    expect(arcs[0]!.d.endsWith(`1400 ${UP_BASELINE}`)).toBe(true)
  })

  test('an interchromosomal junction draws at the band ceiling', () => {
    // It has no genomic span — two coordinates on different number lines are not
    // a distance — and the largest event on screen is the honest height.
    const arcs = arcsFor(merge(fusionMap([CLEAN])))
    expect(arcs[0]!.labelY).toBeCloseTo(UP_BASELINE * (1 - MAX_ARC_FRAC))
  })

  test('a same-chromosome junction is span-scaled, so it sits lower', () => {
    const arcs = arcsFor(
      mergeSplitJunctions({
        laidOutPileupMap: new Map([
          [
            0,
            regionData([
              { name: 'del', start: 1000, end: 1100, strand: 1, clip: 0 },
              {
                name: 'del',
                start: 1300,
                end: 1400,
                strand: 1,
                clip: 100,
                flags: SAM_FLAG_SUPPLEMENTARY,
              },
            ]),
          ],
        ]),
        displayedRegions: REGIONS,
        windowBp: 10,
        minScore: 1,
      }),
    )
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.refName).toBe(arcs[0]!.endRefName)
    // A 200bp gap sits near the bottom of the log span scale, well under the
    // interchromosomal ceiling above (larger y = lower on screen).
    expect(arcs[0]!.labelY).toBeGreaterThan(UP_BASELINE * (1 - MAX_ARC_FRAC))
  })

  test('stroke width grows with support', () => {
    const one = arcsFor(merge(fusionMap([CLEAN])))
    const many = arcsFor(
      merge(fusionMap(Array.from({ length: 40 }, () => CLEAN))),
    )
    expect(many[0]!.score).toBe(40)
    expect(many[0]!.strokeWidth).toBeGreaterThan(one[0]!.strokeWidth)
  })

  test('the arc is tinted and titled by connection type, matching its connectors', () => {
    const colinear = arcsFor(merge(fusionMap([CLEAN])))
    const inverted = arcsFor(merge(fusionMap([{ ...CLEAN, secondStrand: -1 }])))
    expect(colinear[0]!.stroke).not.toBe(inverted[0]!.stroke)
    expect(colinear[0]!.title).not.toBe(inverted[0]!.title)
  })

  test('an end projecting nowhere drops the whole arc', () => {
    // A coordinate in no displayed region has no pixel to hang from, so the arc
    // is dropped rather than drawn against a clamped edge asserting a breakpoint
    // that is not on screen.
    expect(
      computeSplitJunctionArcs({
        junctions: merge(fusionMap([CLEAN])),
        bpToScreenX: (_r, _bp, idx) => (idx === 1 ? undefined : 400),
        heights: HEIGHTS,
        colors: PALETTE,
      }),
    ).toEqual([])
  })
})

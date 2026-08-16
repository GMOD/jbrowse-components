import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'

// Distinguishable values, not makeTestPalette's all-zero default: the
// assertions below are that two SLOTS carry different colors, which every
// palette entry being [0,0,0] would satisfy vacuously.
const PALETTE = makeTestPalette({
  colorPairLR: [0.1, 0.1, 0.1],
  colorPairRL: [0.2, 0.2, 0.2],
  colorPairRR: [0.3, 0.3, 0.3],
  colorPairLL: [0.4, 0.4, 0.4],
  colorSupplementary: [0.5, 0.5, 0.5],
  colorSplitInversion: [0.6, 0.6, 0.6],
})
import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { buildLinkedReadColorPalette } from '../../shaders/palettes.ts'
import { namesToBlock } from '../../shared/readNameBlock.ts'
import {
  LINKED_READ_COLOR_INTERCHROM,
  LINKED_READ_COLOR_PAIR_LR,
  LINKED_READ_COLOR_PAIR_RR,
  LINKED_READ_COLOR_PAIR_UNKNOWN,
  LINKED_READ_COLOR_SPLIT_INV,
  LINKED_READ_COLOR_SPLIT_NORMAL,
} from './compute.ts'
import {
  bezierConnectionLegendItems,
  computePileupBezierArcs,
  enumerateBezierPairs,
} from './computeOverlay.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Minimal PileupDataResult with only the fields computePileupBezierArcs reads.
function makeData(opts: {
  names: string[]
  flags: number[]
  strands: number[]
  positions: number[][]
  ys: number[]
  orientations?: number[]
  // Only needed when one read's segments are split across two data objects (one
  // per displayedRegion): `dedupeByReadId` collapses same-id entries, so the two
  // halves have to carry the distinct ids a real fetch would give them.
  ids?: string[]
  // 1 where the read's mate is on another chromosome. Defaults to all-zero
  // rather than being left off: `readInterchrom` is a REQUIRED field of
  // `PileupDataResult` that the worker always emits, and omitting it here only
  // ever compiled because of the `as unknown as` cast below.
  interchrom?: number[]
}): PileupDataResult {
  const n = opts.names.length
  const readPositions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    readPositions[i * 2] = opts.positions[i]![0]!
    readPositions[i * 2 + 1] = opts.positions[i]![1]!
  }
  return makePileupDataResult({
    ...namesToBlock(opts.names),
    readKeys: opts.ids ?? opts.names.map((_, i) => `id${i}`),
    readFlags: new Uint16Array(opts.flags),
    readStrands: new Int8Array(opts.strands),
    readPositions,
    readPairOrientations: Uint8Array.from(
      opts.orientations ?? new Array(n).fill(0),
    ),
    readYs: new Uint16Array(opts.ys),
    readInterchrom: Uint8Array.from(opts.interchrom ?? opts.names.map(() => 0)),
  })
}

const baseOpts = {
  displayedRegions: [{ refName: 'chr1' }],
  // Identity bp→screen so control-point math is checkable by hand.
  bpToScreenX: (_refName: string, bp: number) => bp,
  featureHeight: 10,
  featureSpacing: 2,
  pileupTopOffset: 0,
  scrollTop: 0,
  viewportBottom: 1000,
}

// Parse `M sx1 sy1 C cp1x cp1y cp2x cp2y sx2 sy2`.
function controlPoints(d: string) {
  const n = String.raw`[-\d.]+`
  const re = new RegExp(
    `M (${n}) (${n}) C (${n}) (${n}) (${n}) (${n}) (${n}) (${n})`,
  )
  const m = re.exec(d)!
  const [, sx1, sy1, cp1x, cp1y, cp2x, cp2y, sx2, sy2] = m.map(Number)
  return {
    sx1: sx1!,
    sy1: sy1!,
    cp1x: cp1x!,
    cp1y: cp1y!,
    cp2x: cp2x!,
    cp2y: cp2y!,
    sx2: sx2!,
    sy2: sy2!,
  }
}

describe('computePileupBezierArcs — split-read tangent direction', () => {
  // Mirrors BreakpointSplitView's AlignmentConnections (shared bezierTangentSign):
  // sx1 is segment1's read-trailing (3') edge, so its handle leaves along the
  // read's strand; sx2 is segment2's read-leading (5') edge, so for a split
  // junction its handle FLIPS and the curve folds back into the reversed segment
  // (it does not cut straight across). fwd primary → cp1x right; the rev
  // supplementary's 5' handle folds back the same way (right of sx2).
  it('fwd+rev split inversion: cp1x right of sx1, cp2x right of sx2', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    const { sx1, cp1x, cp2x, sx2 } = controlPoints(arcs[0]!.d)
    expect(cp1x).toBeGreaterThan(sx1) // s1 = +1, trailing → right
    expect(cp2x).toBeGreaterThan(sx2) // s2 = -1, leading split → folds back right
  })

  it('rev+fwd split inversion: cp1x left of sx1, cp2x left of sx2', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [-1, 1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    const { sx1, cp1x, cp2x, sx2 } = controlPoints(arcs[0]!.d)
    expect(cp1x).toBeLessThan(sx1) // s1 = -1, trailing → left
    expect(cp2x).toBeLessThan(sx2) // s2 = +1, leading split → folds back left
  })

  it('reverse-complemented region flips both handles', () => {
    // Same fwd+rev split as above (handles both head right), but the displayed
    // region is reversed, so screen-x is flipped and both handles flip with it.
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr1', reversed: true }],
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    const { sx1, cp1x, cp2x, sx2 } = controlPoints(arcs[0]!.d)
    expect(cp1x).toBeLessThan(sx1) // flipped from the non-reversed fwd case
    expect(cp2x).toBeLessThan(sx2) // flipped from the non-reversed split case
  })

  it('emits no NaN coordinates', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs[0]!.d).not.toMatch(/NaN/)
  })
})

describe('computePileupBezierArcs — distinct inversion hue + tooltip label', () => {
  // A split-read inversion gets its OWN color (colorSplitReadInversion), distinct
  // from the RR-pair blue, so the connector matches the magenta read fill and the
  // two categories are tellable apart in the legend.
  const rr = rgb255(
    buildLinkedReadColorPalette(PALETTE)[LINKED_READ_COLOR_PAIR_RR]!,
  )
  const splitInv = rgb255(
    buildLinkedReadColorPalette(PALETTE)[LINKED_READ_COLOR_SPLIT_INV]!,
  )

  it('split inversion: own inversion hue, distinct from RR, labeled', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    expect(splitInv).not.toBe(rr) // no longer shares the RR-pair blue
    expect(arcs[0]!.stroke).toBe(splitInv)
    expect(arcs[0]!.label).toBe('Split alignment (inverted)')
  })

  it('RR pair: navy blue, distinct label', () => {
    const data = makeData({
      names: ['p', 'p'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, 1],
      orientations: [LINKED_READ_COLOR_PAIR_RR, LINKED_READ_COLOR_PAIR_RR],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.stroke).toBe(rr)
    expect(arcs[0]!.label).toBe('RR - Both mates reverse strand')
  })
})

describe('computePileupBezierArcs — paired tangent direction', () => {
  // A mate link joins two 3' (trailing) edges, so neither handle is a 5' leading
  // edge and neither flips (unlike a split junction). Both handles leave along
  // their read's strand — for an aberrant same-strand (RR) pair that means both
  // point right, the consistent oval the breakpoint view also draws.
  it('aberrant RR pair: both handles leave along strand, no fold-back', () => {
    const data = makeData({
      names: ['p', 'p'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, 1],
      orientations: [LINKED_READ_COLOR_PAIR_RR, LINKED_READ_COLOR_PAIR_RR],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    const { sx1, cp1x, cp2x, sx2 } = controlPoints(arcs[0]!.d)
    expect(cp1x).toBeGreaterThan(sx1) // s1 = +1 → right
    expect(cp2x).toBeGreaterThan(sx2) // s2 = +1, paired (no flip) → right
  })
})

describe('computePileupBezierArcs — discordant curves dip', () => {
  // The shape language is shared with BreakpointSplitView: a plain line is a
  // normal-orientation pair, a curve below the reads is a discordant one. Every
  // pair that gets a curve here is discordant (normal ones take the line
  // branch), so every curve dips — larger y is down the screen.
  it('a split inversion bows below both of its endpoints', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 0],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    const { sy1, cp1y, cp2y, sy2 } = controlPoints(arcs[0]!.d)
    expect(cp1y).toBeGreaterThan(sy1)
    expect(cp2y).toBeGreaterThan(sy2)
  })

  it('an aberrant RR pair dips too, not just split reads', () => {
    const data = makeData({
      names: ['p', 'p'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, 1],
      orientations: [LINKED_READ_COLOR_PAIR_RR, LINKED_READ_COLOR_PAIR_RR],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 0],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    const { sy1, cp1y, cp2y, sy2 } = controlPoints(arcs[0]!.d)
    expect(cp1y).toBeGreaterThan(sy1)
    expect(cp2y).toBeGreaterThan(sy2)
  })
})

describe('computePileupBezierArcs — one refName displayed twice', () => {
  // A derivative allele laid out in one row is an ordered list of reference
  // intervals, and a foldback puts the same arm in that list twice, OVERLAPPING
  // itself. Both regions then contain either endpoint of the junction between
  // them, so a refName-only projection resolves both ends into region 0 and the
  // junction — the whole point of the layout — draws as a zero-length arc.
  //
  // Disjoint windows on one refName (collapsed introns) are not affected: the
  // coordinate alone picks the region out. Only overlap needs the index.
  const REGIONS = [
    { refName: 'chr3', start: 1000, end: 3000, screenOffset: 0 },
    { refName: 'chr3', start: 2000, end: 3000, screenOffset: 2000 },
  ]

  // Stands in for makeBpToScreenX: prefer the pinned region, fall back to the
  // first region containing the coordinate, exactly as view.bpToPx does.
  function bpToScreenX(
    refName: string,
    bp: number,
    displayedRegionIndex?: number,
  ) {
    const at = (i: number) => {
      const r = REGIONS[i]
      return r && r.refName === refName && bp >= r.start && bp <= r.end
        ? bp - r.start + r.screenOffset
        : undefined
    }
    return (
      (displayedRegionIndex === undefined
        ? undefined
        : at(displayedRegionIndex)) ??
      REGIONS.map((_, i) => at(i)).find(x => x !== undefined)
    )
  }

  // One split read: its primary was fetched in region 0, its supplementary in
  // region 1. Both alignments sit at coordinates the two regions share.
  const primary = makeData({
    names: ['r'],
    ids: ['r-primary'],
    flags: [0],
    strands: [1],
    positions: [[2400, 2500]],
    ys: [0],
  })
  const supplementary = makeData({
    names: ['r'],
    ids: ['r-supplementary'],
    flags: [SAM_FLAG_SUPPLEMENTARY],
    strands: [-1],
    positions: [[2600, 2700]],
    ys: [0],
  })
  const pairs = enumerateBezierPairs(
    new Map([
      [0, primary],
      [1, supplementary],
    ]),
  )

  it('draws each endpoint in the region it was fetched from', () => {
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: REGIONS,
      bpToScreenX,
      pairs,
    })
    expect(arcs).toHaveLength(1)
    const { sx1, sx2 } = controlPoints(arcs[0]!.d)
    // region 0 spans screen [0, 2000), region 1 spans [2000, 3000]
    expect(sx1).toBeLessThan(2000)
    expect(sx2).toBeGreaterThanOrEqual(2000)
  })

  it('collapses onto region 0 when the index is ignored', () => {
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: REGIONS,
      // the pre-fix projection: refName + coordinate, no region index
      bpToScreenX: (refName: string, bp: number) => bpToScreenX(refName, bp),
      pairs,
    })
    expect(arcs).toHaveLength(1)
    const { sx1, sx2 } = controlPoints(arcs[0]!.d)
    expect(sx1).toBeLessThan(2000)
    expect(sx2).toBeLessThan(2000)
  })
})

describe('computePileupBezierArcs — off-screen culling', () => {
  // readScreenY = y*rowH + pileupTopOffset - scrollTop + featureHeight/2, so
  // scrollTop 25 puts row 0 at -20: both reads sit just above the viewport.
  // The pair is wide, so its dip is deep enough to hang back into view — the
  // curve bows away from its endpoints, and culling on the endpoints alone
  // would drop a connector the user can see.
  const scrolledJustAbove = { ...baseOpts, scrollTop: 25 }
  const wideInversion = makeData({
    names: ['r', 'r'],
    flags: [0, SAM_FLAG_SUPPLEMENTARY],
    strands: [1, -1],
    positions: [
      [100, 200],
      [3000, 3100],
    ],
    ys: [0, 0],
  })

  it('keeps a curve whose endpoints are off-screen but whose body is not', () => {
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...scrolledJustAbove,
      pairs: enumerateBezierPairs(new Map([[0, wideInversion]])),
    })
    expect(arcs).toHaveLength(1)
    const { sy1, sy2 } = controlPoints(arcs[0]!.d)
    // the endpoints really are above the viewport — the dip is what's visible
    expect(sy1).toBeLessThan(0)
    expect(sy2).toBeLessThan(0)
  })

  it('still culls a curve that is wholly off-screen', () => {
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      scrollTop: 5000,
      pairs: enumerateBezierPairs(new Map([[0, wideInversion]])),
    })
    expect(arcs).toHaveLength(0)
  })
})

describe('computePileupBezierArcs — exclusions', () => {
  // Normal-orientation within-region pairs are drawn by the GPU/Canvas2D
  // straight-line pass, so the bezier overlay must not duplicate them.
  it('excludes normal within-region paired reads', () => {
    const data = makeData({
      names: ['p', 'p'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 0],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(0)
  })

  it('skips pairs whose endpoints fall outside the displayed regions', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
      bpToScreenX: () => undefined,
    })
    expect(arcs).toHaveLength(0)
  })
})

// What `enumerateBezierPairs` returns IS what the overlay draws, so the two
// consumers (the arc emitter and the legend) never re-derive the skip rule — and
// the memoized list doesn't carry every ordinary pair at depth for both of them
// to throw away.
describe('enumerateBezierPairs — the list is what gets drawn', () => {
  it('drops normal-orientation pairs wholly inside one region', () => {
    // An ordinary LR pair: the GPU / Canvas2D line pass owns it.
    const normalPair = makeData({
      names: ['p', 'p'],
      ids: ['p1', 'p2'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, -1],
      positions: [
        [100, 200],
        [600, 700],
      ],
      orientations: [LINKED_READ_COLOR_PAIR_LR, LINKED_READ_COLOR_PAIR_LR],
      ys: [0, 0],
    })
    expect(enumerateBezierPairs(new Map([[0, normalPair]]))).toHaveLength(0)
  })

  // A PAF/synteny block has no QNAME, and LGVSyntenyDisplay runs this same
  // overlay. Bucketed under '' they were one read's segment chain, so N blocks
  // produced N-1 junctions between features that share nothing.
  it('never connects nameless features to each other', () => {
    const blocks = makeData({
      names: ['', '', ''],
      ids: ['block-a', 'block-b', 'block-c'],
      flags: [0, 0, 0],
      strands: [1, 1, -1],
      positions: [
        [100, 200],
        [5000, 5100],
        [900_000, 900_100],
      ],
      ys: [0, 1, 2],
    })
    expect(enumerateBezierPairs(new Map([[0, blocks]]))).toHaveLength(0)
  })
})

// Chain layout puts a chain's alignments on one row across displayed regions but
// its connecting-line pass is per region, so nothing joins them. This overlay is
// the only pass that resolves both ends, and `crossRegion` is it doing exactly
// that job and nothing the per-region pass already covers.
describe('enumerateBezierPairs — crossRegion scope', () => {
  // A split read whose supplementary was fetched in region 1, plus a second read
  // wholly inside region 0 whose junction the per-region line already draws.
  const inRegion0 = makeData({
    names: ['r', 'w', 'w'],
    ids: ['r-primary', 'w-primary', 'w-supplementary'],
    flags: [0, 0, SAM_FLAG_SUPPLEMENTARY],
    strands: [1, 1, -1],
    positions: [
      [2400, 2500],
      [100, 200],
      [300, 400],
    ],
    ys: [0, 1, 1],
  })
  const inRegion1 = makeData({
    names: ['r'],
    ids: ['r-supplementary'],
    flags: [SAM_FLAG_SUPPLEMENTARY],
    strands: [1],
    positions: [[9000, 9100]],
    ys: [0],
  })
  const twoRegions = new Map([
    [0, inRegion0],
    [1, inRegion1],
  ])

  it('keeps only the pairs that straddle a region boundary', () => {
    expect(enumerateBezierPairs(twoRegions, 'all')).toHaveLength(2)
    const cross = enumerateBezierPairs(twoRegions, 'crossRegion')
    expect(cross).toHaveLength(1)
    expect(cross[0]!.e1.displayedRegionIndex).toBe(0)
    expect(cross[0]!.e2.displayedRegionIndex).toBe(1)
  })

  // The short-circuit that makes this scope affordable to turn on by default:
  // one region can hold no straddling pair, so the O(reads) grouping is skipped.
  it('answers a single-region section without enumerating', () => {
    expect(
      enumerateBezierPairs(new Map([[0, inRegion0]]), 'crossRegion'),
    ).toHaveLength(0)
    expect(enumerateBezierPairs(new Map([[0, inRegion0]]))).toHaveLength(1)
  })

  it('none yields nothing at all', () => {
    expect(enumerateBezierPairs(twoRegions, 'none')).toHaveLength(0)
  })

  // The straddling pair still draws through the normal geometry: a co-linear
  // split is a straight line, matching BreakpointSplitView's rule that a curve
  // means something aberrant.
  it('draws the straddling pair as a connector', () => {
    const arcs = computePileupBezierArcs({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr1' }, { refName: 'chr1' }],
      pairs: enumerateBezierPairs(twoRegions, 'crossRegion'),
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.d).toMatch(/^M [\d.]+ [\d.]+ L /)
  })
})

// The key is built from the palette, labels and straight-vs-curved rule the
// overlay itself draws with, so the glyph is part of that guarantee: a color the
// reader met as a curve must not be keyed by a square.
describe('bezierConnectionLegendItems', () => {
  it('draws each row as the connector shape that color is drawn in', () => {
    const mark = (colorType: number) =>
      bezierConnectionLegendItems([colorType], PALETTE)[0]!.mark
    // aberrant orientations and inverted splits are the beziers
    expect(mark(LINKED_READ_COLOR_PAIR_RR)).toBe('curve')
    expect(mark(LINKED_READ_COLOR_SPLIT_INV)).toBe('curve')
    // the normal slots reach this overlay only as cross-region pairs, which it
    // draws as straight `M..L..` paths
    expect(mark(LINKED_READ_COLOR_PAIR_LR)).toBe('line')
    expect(mark(LINKED_READ_COLOR_SPLIT_NORMAL)).toBe('line')
    // a translocated mate link is discordant by definition, so it curves —
    // `classifyPair` gives it `isNormal: false`, and these two have to agree or
    // the key shows a glyph the overlay never drew
    expect(mark(LINKED_READ_COLOR_INTERCHROM)).toBe('curve')
  })

  // Slot 7 was the fallback and worded 'Read pair'. It carries a meaning now,
  // and on a CURVE that meaning is the overlay's own: SPLIT_JUNCTION_LABELS
  // overrides CATEGORY_LEGEND's bare 'Inter-chromosomal', which is a property of
  // the pair rather than of the mark. The two rows beside it are split
  // alignments, so this one is too, and the parenthetical carries the finding.
  it('names the inter-chromosomal slot as the split alignment it draws', () => {
    expect(
      bezierConnectionLegendItems([LINKED_READ_COLOR_INTERCHROM], PALETTE)[0]!
        .label,
    ).toBe('Split alignment (interchromosomal)')
  })

  it('keys the connection colors in view, sorted, in the arcs own words', () => {
    expect(
      bezierConnectionLegendItems(
        [LINKED_READ_COLOR_SPLIT_INV, LINKED_READ_COLOR_PAIR_RR],
        PALETTE,
      ).map(i => i.label),
    ).toEqual(['RR - Both mates reverse strand', 'Split alignment (inverted)'])
  })

  // Slots 0 and 1 are both `pairLR` in LINKED_READ_SLOT_CATEGORY, so a view
  // holding an LR mate link and one whose orientation the worker never computed
  // drew ONE grey and listed it twice, under two names. The lower slot's
  // wording survives, which is the neutral one: `connectionLabel` refuses to
  // call slot 0 an LR because nothing measured that orientation, and a row
  // covering both pair kinds must not claim it either.
  it('keys one row per color, not one per slot', () => {
    expect(
      bezierConnectionLegendItems(
        [LINKED_READ_COLOR_PAIR_LR, LINKED_READ_COLOR_PAIR_UNKNOWN],
        PALETTE,
      ),
    ).toEqual([{ color: expect.any(String), label: 'Read pair', mark: 'line' }])
    // …and the LR wording still stands on its own when slot 0 is absent
    expect(
      bezierConnectionLegendItems([LINKED_READ_COLOR_PAIR_LR], PALETTE)[0]!
        .label,
    ).toBe('LR - Normal pair orientation')
  })
})

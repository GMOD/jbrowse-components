import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { linkedReadColorPalette } from '../../shaders/palettes.ts'
import {
  LINKED_READ_COLOR_PAIR_RR,
  LINKED_READ_COLOR_SPLIT_INV,
} from './compute.ts'
import {
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
}): PileupDataResult {
  const n = opts.names.length
  const readPositions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    readPositions[i * 2] = opts.positions[i]![0]!
    readPositions[i * 2 + 1] = opts.positions[i]![1]!
  }
  return {
    readNames: opts.names,
    readIds: opts.ids ?? opts.names.map((_, i) => `id${i}`),
    readFlags: new Uint16Array(opts.flags),
    readStrands: new Int8Array(opts.strands),
    readPositions,
    readPairOrientations: Uint8Array.from(
      opts.orientations ?? new Array(n).fill(0),
    ),
    readYs: new Uint16Array(opts.ys),
  } as unknown as PileupDataResult
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
  const rr = rgb255(linkedReadColorPalette[LINKED_READ_COLOR_PAIR_RR]!)
  const splitInv = rgb255(linkedReadColorPalette[LINKED_READ_COLOR_SPLIT_INV]!)

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
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    expect(splitInv).not.toBe(rr) // no longer shares the RR-pair blue
    expect(arcs[0]!.stroke).toBe(splitInv)
    expect(arcs[0]!.label).toBe('Split-read inversion')
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
      ...baseOpts,
      pairs: enumerateBezierPairs(new Map([[0, data]])),
      bpToScreenX: () => undefined,
    })
    expect(arcs).toHaveLength(0)
  })
})

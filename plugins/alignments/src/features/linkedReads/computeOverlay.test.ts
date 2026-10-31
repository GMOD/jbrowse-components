import {
  PAIR_DIRECTION_NUM,
  namesToBlock,
  readNameAt,
} from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { CUBIC_APEX_RATIO } from '@jbrowse/core/util'
import {
  CONNECTOR_DASHED,
  CONNECTOR_STRAIGHT,
  connectorMark,
} from '@jbrowse/render-core/marks'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'
import { HIDDEN_SEGMENT_DASH, hiddenSegmentsNote } from '@jbrowse/sv-core'

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
import { arcCategoryColor } from '../../shaders/palettes.ts'
import { getArcLegendItems } from '../../shared/legendUtils.ts'
import {
  ARC_COLOR_INTERCHROM,
  ARC_COLOR_DEFAULT,
  ARC_COLOR_SPLIT_INV_LL,
  connectorColorType,
  pairColorType,
} from '../arcs/arcColors.ts'
import {
  connectorCategories,
  connectorDipReservePx,
  connectorFilterOf,
  enumerateConnectorPairs,
  resolveConnectors,
} from './computeOverlay.ts'
import { buildConnectorFeeds } from './connectorFeed.ts'

import type { SwatchCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { ArcColorField, ConnectionFilter } from '../../shared/types.ts'
import type { LinkedPair } from './compute.ts'
import type { LinkRegion } from '@jbrowse/render-core/marks'

// The connectors as the feed and the connector mark draw them, read back off
// the mark's own path: a straight one as `M x y L x y`, a curve as
// `M x y C ...`. The region table is sampled from `bpToScreenX`, which every
// fixture here keeps linear.
function drawnConnectors(opts: {
  pairs: LinkedPair[]
  displayedRegions: { refName: string; reversed?: boolean }[]
  bpToScreenX: (
    refName: string,
    bp: number,
    index?: number,
  ) => number | undefined
  featureHeight: number
  featureSpacing: number
  pileupTopOffset: number
  pileupHeight: number
  scrollTop: number
  colors: ColorPalette
  colorField?: ArcColorField
  labels?: Partial<Record<SwatchCategory, string>>
  regions?: LinkRegion[]
}) {
  const regions: LinkRegion[] =
    opts.regions ??
    opts.displayedRegions.map((r, i) => {
      const a = opts.bpToScreenX(r.refName, 0, i) ?? 0
      return {
        anchorPx: a,
        anchorBp: 0,
        signedPxPerBp: (opts.bpToScreenX(r.refName, 1, i) ?? 0) - a,
      }
    })
  const params = {
    regions,
    rowOffsetPx: opts.pileupTopOffset - opts.scrollTop + opts.featureHeight / 2,
    rowPitchPx: opts.featureHeight + opts.featureSpacing,
    arrowPx: 0,
  }
  const frame = { canvasWidth: 1e9, canvasHeight: 1e9 }
  const feeds = buildConnectorFeeds({
    colorField: 'insertSizeAndOrientation',
    ...opts,
  })
  return [...feeds].flatMap(([regionIdx, feed]) =>
    feed.hits.flatMap((hit, i) => {
      const block = canvasWideBlock(regionIdx, frame.canvasWidth)
      const ink = connectorMark.ink!(feed.channels, block, frame, params, i)
      if (!ink) {
        return []
      }
      const n = ink.stroke!.d.match(/-?[\d.]+(e[-+]?\d+)?/g)!.map(Number)
      const [x0, y0, x1, y1, x2, y2, x3, y3] = n
      const bits = feed.channels.bits[i]!
      const color = feed.channels.color[i]!
      return {
        ...hit,
        d:
          bits & CONNECTOR_STRAIGHT
            ? `M ${x0} ${y0} L ${x3} ${y3}`
            : `M ${x0} ${y0} C ${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`,
        stroke: `rgb(${color & 255},${(color >>> 8) & 255},${(color >>> 16) & 255})`,
        dash: bits & CONNECTOR_DASHED ? HIDDEN_SEGMENT_DASH : undefined,
        x1: x0,
        x2: x3,
      }
    }),
  )
}

// The straight-line pass's records, as the display resolves them.
function linesOf(
  map: Parameters<typeof resolveConnectors>[0],
  canonicalRefName?: (refName: string) => string,
) {
  return resolveConnectors(map, {
    lines: true,
    scope: 'all',
    canonicalRefName,
  }).lines
}

// Minimal PileupDataResult with only the fields drawnConnectors reads.
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
  // Both OPTIONAL in the DTO and left absent unless a fixture asks, which is
  // what keeps the read-order sort and the SA walk out of every other test
  // here: clip-at-start-of-read is the axis a split read's segments chain on,
  // and the SA tag is the only statement of the segments no region fetched.
  clipAtStart?: number[]
  suppAlignments?: string[]
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
    ...(opts.clipAtStart
      ? { readClipAtStart: Uint32Array.from(opts.clipAtStart) }
      : {}),
    ...(opts.suppAlignments ? { readSuppAlignments: opts.suppAlignments } : {}),
  })
}

const baseOpts = {
  displayedRegions: [{ refName: 'chr1' }],
  // Identity bp→screen so control-point math is checkable by hand.
  bpToScreenX: (_refName: string, bp: number) => bp,
  featureHeight: 10,
  featureSpacing: 2,
  pileupTopOffset: 0,
  pileupHeight: 200,
  scrollTop: 0,
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

describe('connectors — split-read tangent direction', () => {
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
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
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
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
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
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr1', reversed: true }],
      bpToScreenX: (_refName: string, bp: number) => 1000 - bp,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
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
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
    })
    expect(arcs[0]!.d).not.toMatch(/NaN/)
  })
})

describe('connectors — the arc band colors and labels', () => {
  // A connector paints as the arc over the same connection: an inversion
  // junction in the color of the pair class spanning it, named as the arc key
  // names it.
  const rr = rgb255(arcCategoryColor(PALETTE, 'pairRR'))
  const invLL = rgb255(arcCategoryColor(PALETTE, 'splitInvLL'))

  it("split inversion: the LL-type junction, in the LL pair's color", () => {
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
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    expect(invLL).toBe(rgb255(arcCategoryColor(PALETTE, 'pairLL')))
    expect(arcs[0]!.stroke).toBe(invLL)
    expect(arcs[0]!.label).toBe('Split read (inversion, LL-type)')
  })

  it('RR pair: the RR color and label', () => {
    const data = makeData({
      names: ['p', 'p'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, 1],
      orientations: [PAIR_DIRECTION_NUM.RR, PAIR_DIRECTION_NUM.RR],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.stroke).toBe(rr)
    expect(arcs[0]!.label).toBe('RR - Both mates reverse strand')
  })
})

describe('connectors — paired tangent direction', () => {
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
      orientations: [PAIR_DIRECTION_NUM.RR, PAIR_DIRECTION_NUM.RR],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    const { sx1, cp1x, cp2x, sx2 } = controlPoints(arcs[0]!.d)
    expect(cp1x).toBeGreaterThan(sx1) // s1 = +1 → right
    expect(cp2x).toBeGreaterThan(sx2) // s2 = +1, paired (no flip) → right
  })
})

describe('connectors — discordant curves dip', () => {
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
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
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
      orientations: [PAIR_DIRECTION_NUM.RR, PAIR_DIRECTION_NUM.RR],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 0],
    })
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
    })
    expect(arcs).toHaveLength(1)
    const { sy1, cp1y, cp2y, sy2 } = controlPoints(arcs[0]!.d)
    expect(cp1y).toBeGreaterThan(sy1)
    expect(cp2y).toBeGreaterThan(sy2)
  })

  // The depth is the mark's one free channel, so it has to say how big the event
  // is and not how much screen it happens to cover. Keyed on the endpoints' pixel
  // separation, as it was, this same event drew 55 px deep zoomed in and 7.5 px
  // deep zoomed out.
  it('dips the same depth for one event at every zoom', () => {
    const data = makeData({
      names: ['p', 'p'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, 1],
      orientations: [PAIR_DIRECTION_NUM.RR, PAIR_DIRECTION_NUM.RR],
      positions: [
        [1000, 1100],
        [21_000, 21_100],
      ],
      ys: [0, 0],
    })
    const depthAt = (bpPerPx: number) => {
      const arcs = drawnConnectors({
        colors: PALETTE,
        ...baseOpts,
        bpToScreenX: (_refName: string, bp: number) => bp / bpPerPx,
        pairs: enumerateConnectorPairs(new Map([[0, data]])),
      })
      const { sy1, cp1y } = controlPoints(arcs[0]!.d)
      return cp1y - sy1
    }
    expect(depthAt(20)).toBeCloseTo(depthAt(1))
    expect(depthAt(400)).toBeCloseTo(depthAt(1))
  })

  it('scales the dip to the band, overshooting the clip by at most a row', () => {
    const arcsFor = (positions: [number, number][], pileupHeight: number) =>
      drawnConnectors({
        colors: PALETTE,
        ...baseOpts,
        pileupHeight,
        pairs: enumerateConnectorPairs(
          new Map([
            [
              0,
              makeData({
                names: ['p', 'p'],
                flags: [
                  SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
                  SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
                ],
                strands: [1, 1],
                orientations: [PAIR_DIRECTION_NUM.RR, PAIR_DIRECTION_NUM.RR],
                positions,
                ys: [0, 0],
              }),
            ],
          ]),
        ),
      })
    // A five-read pileup is the regime the previous rule failed in: it drew a
    // 55 px apex under a ~54 px band, and the section's clip cut the curve into
    // a tick.
    for (const pileupHeight of [12, 54, 200]) {
      for (const far of [3000, 21_000, 201_000, 901_000]) {
        const arcs = arcsFor(
          [
            [1000, 1100],
            [far, far + 100],
          ],
          pileupHeight,
        )
        const { sy1, cp1y } = controlPoints(arcs[0]!.d)
        // the apex, not the control point, is the ink the clip has to hold
        // What this pins is that the band reaches the law — not that the ink
        // lands inside the clip, which it does not: the depth is measured from
        // the read's own row while the band is measured from its top, so the
        // curve passes the clip by that row's offset. See discordantDip.ts.
        expect((cp1y - sy1) * CUBIC_APEX_RATIO).toBeLessThanOrEqual(
          pileupHeight,
        )
      }
    }
  })
})

describe('connectorDipReservePx', () => {
  // Three rows of 12 px: the band ends at the last read, which is where the
  // section's clip used to cut the bottom rows' curves.
  const pileupHeight = 36
  const rrPair = (ys: [number, number]) =>
    makeData({
      names: ['p', 'p'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, 1],
      orientations: [PAIR_DIRECTION_NUM.RR, PAIR_DIRECTION_NUM.RR],
      positions: [
        [1000, 1100],
        [21_000, 21_100],
      ],
      ys,
    })
  const reserveFor = (data: PileupDataResult) =>
    connectorDipReservePx({
      ...baseOpts,
      pileupHeight,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
    })

  it('holds the apex of a curve on the last row', () => {
    const data = rrPair([2, 2])
    const reserve = reserveFor(data)
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pileupHeight,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
    })
    const { sy1, cp1y } = controlPoints(arcs[0]!.d)
    const apex = sy1 + (cp1y - sy1) * CUBIC_APEX_RATIO
    expect(apex).toBeGreaterThan(pileupHeight)
    expect(apex).toBeLessThan(pileupHeight + reserve)
    // only what the curve takes, plus the stroke's clearance
    expect(pileupHeight + reserve - apex).toBeLessThan(3)
  })

  it('measures from the lower of two rows', () => {
    expect(reserveFor(rrPair([0, 2]))).toBe(reserveFor(rrPair([2, 2])))
    expect(reserveFor(rrPair([0, 0]))).toBeLessThan(reserveFor(rrPair([2, 2])))
  })

  it('reserves nothing when no connector dips', () => {
    // An LR pair across two regions is a straight line.
    const lr = (ys: number[]) =>
      makeData({
        names: ['p'],
        flags: [SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR],
        strands: [1],
        orientations: [PAIR_DIRECTION_NUM.LR],
        positions: [[1000, 1100]],
        ys,
      })
    const pairs = enumerateConnectorPairs(
      new Map([
        [0, lr([2])],
        [1, lr([2])],
      ]),
    )
    expect(
      connectorDipReservePx({
        ...baseOpts,
        displayedRegions: [{ refName: 'chr1' }, { refName: 'chr1' }],
        pileupHeight,
        pairs,
      }),
    ).toBe(0)
    expect(
      connectorDipReservePx({ ...baseOpts, pileupHeight, pairs: [] }),
    ).toBe(0)
  })

  it('reserves nothing when the dip ends inside a band dragged taller', () => {
    expect(
      connectorDipReservePx({
        ...baseOpts,
        pileupHeight: 400,
        pairs: enumerateConnectorPairs(new Map([[0, rrPair([2, 2])]])),
      }),
    ).toBe(0)
  })
})

describe('connectors — one refName displayed twice', () => {
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
  const pairs = enumerateConnectorPairs(
    new Map([
      [0, primary],
      [1, supplementary],
    ]),
  )

  it('draws each endpoint in the region it was fetched from', () => {
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: REGIONS,
      bpToScreenX,
      regions: REGIONS.map(r => ({
        anchorPx: r.screenOffset,
        anchorBp: r.start,
        signedPxPerBp: 1,
      })),
      pairs,
    })
    expect(arcs).toHaveLength(1)
    const { sx1, sx2 } = controlPoints(arcs[0]!.d)
    // region 0 spans screen [0, 2000), region 1 spans [2000, 3000]
    expect(sx1).toBeLessThan(2000)
    expect(sx2).toBeGreaterThanOrEqual(2000)
  })
})

// A long read fetched in one displayed region can run past its end, so the
// junction at its trailing edge lies in the next region. Placed through the
// region it was fetched in, that end extrapolates off its region's edge, a
// hook where the junction is not.
describe('connectors — an end past the region its read was fetched in', () => {
  const displayedRegions = [
    { refName: 'chr3', start: 1000, end: 3000 },
    { refName: 'chr3', start: 3000, end: 5000 },
  ]
  // region 1 starts 100 px past region 0's end
  const regions = [
    { anchorPx: 0, anchorBp: 1000, signedPxPerBp: 1 },
    { anchorPx: 2100, anchorBp: 3000, signedPxPerBp: 1 },
  ]
  const primary = makeData({
    names: ['r'],
    ids: ['r-primary'],
    flags: [0],
    strands: [1],
    positions: [[1500, 3200]],
    ys: [0],
    clipAtStart: [0],
  })
  const supplementary = makeData({
    names: ['r'],
    ids: ['r-supplementary'],
    flags: [SAM_FLAG_SUPPLEMENTARY],
    strands: [-1],
    positions: [[4000, 4100]],
    ys: [1],
    clipAtStart: [1700],
  })

  it('places the end through the region that holds its bp', () => {
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions,
      regions,
      pairs: enumerateConnectorPairs(
        new Map([
          [0, primary],
          [1, supplementary],
        ]),
      ),
    })
    expect(arcs).toHaveLength(1)
    // bp 3200 is 200 bp into region 1, not 2200 bp past region 0's start
    expect(arcs[0]!.x1).toBe(2300)
  })

  // the next window is another chromosome, so no region holds the overhang
  it('ends at its own region edge where no region holds its bp', () => {
    const otherChromosome = [
      { refName: 'chr3', start: 1000, end: 3000 },
      { refName: 'chr7', start: 3000, end: 5000 },
    ]
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: otherChromosome,
      regions,
      pairs: enumerateConnectorPairs(
        new Map([
          [0, primary],
          [1, supplementary],
        ]),
      ),
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.x1).toBe(2000)
  })
})

describe('connectors — exclusions', () => {
  // Normal-orientation within-region pairs are drawn by the GPU/Canvas2D
  // straight-line pass, so the connector mark must not duplicate them.
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
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
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
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      pairs: enumerateConnectorPairs(new Map([[0, data]])),
      regions: [],
    })
    expect(arcs).toHaveLength(0)
  })
})

// What `enumerateConnectorPairs` returns IS what the overlay draws, so the two
// consumers (the arc emitter and the legend) never re-derive the skip rule — and
// the memoized list doesn't carry every ordinary pair at depth for both of them
// to throw away.
describe('enumerateConnectorPairs — the list is what gets drawn', () => {
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
      orientations: [PAIR_DIRECTION_NUM.LR, PAIR_DIRECTION_NUM.LR],
      ys: [0, 0],
    })
    expect(enumerateConnectorPairs(new Map([[0, normalPair]]))).toHaveLength(0)
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
    expect(enumerateConnectorPairs(new Map([[0, blocks]]))).toHaveLength(0)
  })
})

// COLO829 tumour ONT chain 1, the shape it takes in a chr3-only view: one
// unpaired read leaves chr3 forward, hops 199bp on chr10 and 183bp on chr12, and
// lands back on chr3 reversed. The two chr3 arms OVERLAP, so that view fetches
// both and neither of the two middle segments — leaving the arms read-adjacent on
// screen and 382bp apart on the molecule. Joining them solid is a false
// inversion, indistinguishable from a real one.
describe('enumerateConnectorPairs — a junction across segments nothing fetched', () => {
  // `refName,pos(1-based),strand,CIGAR,mapQ,NM` — the read's four segments as its
  // own SA tags state them. Each fetched segment's tag lists the other three.
  const CHR3_FWD = 'chr3,25359069,+,500M882S,60,0'
  const CHR10 = 'chr10,600001,+,500S199M683S,60,0'
  const CHR12 = 'chr12,700001,+,699S183M500S,60,0'
  const CHR3_REV = 'chr3,25358612,-,500M882S,60,0'

  const foldback = makeData({
    names: ['chain1', 'chain1'],
    ids: ['chain1-primary', 'chain1-supp'],
    flags: [0, SAM_FLAG_SUPPLEMENTARY],
    strands: [1, -1],
    positions: [
      [25_359_068, 25_359_568],
      [25_358_611, 25_359_111],
    ],
    // Read order, which for a foldback is not genomic order: the reverse arm's
    // 882 clipped bases at the start of the read are the three segments before
    // it, two of which no region fetched.
    clipAtStart: [0, 882],
    suppAlignments: [
      [CHR10, CHR12, CHR3_REV].join(';'),
      [CHR3_FWD, CHR10, CHR12].join(';'),
    ],
    ys: [0, 1],
  })
  const sections = new Map([[0, foldback]])
  const identity = (refName: string) => refName

  it('names the hidden loci in read order, once per hop', () => {
    const pairs = enumerateConnectorPairs(sections, 'all', identity)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]!.hiddenSegmentsBetween).toEqual([
      'chr10:600,001-600,199',
      'chr12:700,001-700,183',
    ])
  })

  it('dashes the arc and carries the loci to the hover', () => {
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr3' }],
      pairs: enumerateConnectorPairs(sections, 'all', identity),
    })
    expect(arcs).toHaveLength(1)
    // The same arc as before the dash existed: the connector is real, only its
    // directness is not, so nothing about the geometry or the label moves.
    expect(arcs[0]!.d).toMatch(/^M 25359568 5 C .* 25359111 17$/)
    expect(arcs[0]!.label).toBe('Split read (inversion, LL-type)')
    expect(arcs[0]!.dash).toBe(HIDDEN_SEGMENT_DASH)
    expect(hiddenSegmentsNote(arcs[0]!.hiddenSegmentsBetween!)).toBe(
      'hidden segments not in view: chr10:600,001-600,199, chr12:700,001-700,183',
    )
  })

  // The SA tag names chromosomes in the BAM's own spelling. Reported raw, a
  // tooltip sends the reader to a refName the view does not have.
  it('reports the loci in the assembly-canonical spelling', () => {
    const pairs = enumerateConnectorPairs(sections, 'all', refName =>
      refName.replace('chr', ''),
    )
    expect(pairs[0]!.hiddenSegmentsBetween).toEqual([
      '10:600,001-600,199',
      '12:700,001-700,183',
    ])
  })

  // A junction whose flanking segments really are read-adjacent says nothing —
  // the SA tag lists both of them, and neither is BETWEEN the two.
  it('marks nothing when the read has no unfetched segment', () => {
    const twoSegments = makeData({
      names: ['chain2', 'chain2'],
      ids: ['chain2-primary', 'chain2-supp'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [25_359_068, 25_359_568],
        [25_358_611, 25_359_111],
      ],
      clipAtStart: [0, 500],
      suppAlignments: [
        'chr3,25358612,-,500M500S,60,0',
        'chr3,25359069,+,500M500S,60,0',
      ],
      ys: [0, 1],
    })
    const pairs = enumerateConnectorPairs(
      new Map([[0, twoSegments]]),
      'all',
      identity,
    )
    expect(pairs).toHaveLength(1)
    expect(pairs[0]!.hiddenSegmentsBetween).toBeUndefined()
    expect(
      drawnConnectors({
        colors: PALETTE,
        ...baseOpts,
        displayedRegions: [{ refName: 'chr3' }],
        pairs,
      })[0]!.dash,
    ).toBeUndefined()
  })

  // Without a normalizer no junction reports hidden segments.
  it('skips the walk when no normalizer is passed', () => {
    expect(
      enumerateConnectorPairs(sections)[0]!.hiddenSegmentsBetween,
    ).toBeUndefined()
  })
})

// Chain layout puts a chain's alignments on one row across displayed regions but
// its connecting-line pass is per region, so nothing joins them. This overlay is
// the only pass that resolves both ends, and `crossRegion` is it doing exactly
// that job and nothing the per-region pass already covers.
const chr1chr2 = (i: number) => ['chr1', 'chr2'][i]

describe('enumerateConnectorPairs — crossRegion scope', () => {
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
    expect(enumerateConnectorPairs(twoRegions, 'all')).toHaveLength(2)
    const cross = enumerateConnectorPairs(twoRegions, 'crossRegion')
    expect(cross).toHaveLength(1)
    expect(cross[0]!.e1.displayedRegionIndex).toBe(0)
    expect(cross[0]!.e2.displayedRegionIndex).toBe(1)
  })

  // The short-circuit that makes this scope affordable to turn on by default:
  // one region can hold no straddling pair, so the O(reads) grouping is skipped.
  it('answers a single-region section without enumerating', () => {
    expect(
      enumerateConnectorPairs(new Map([[0, inRegion0]]), 'crossRegion'),
    ).toHaveLength(0)
    expect(enumerateConnectorPairs(new Map([[0, inRegion0]]))).toHaveLength(1)
  })

  it('none yields nothing at all', () => {
    expect(enumerateConnectorPairs(twoRegions, 'none')).toHaveLength(0)
  })

  it('draws the straddling co-linear split as a straight line', () => {
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr1' }, { refName: 'chr1' }],
      pairs: enumerateConnectorPairs(twoRegions, 'crossRegion'),
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.d).toMatch(/^M [\d.]+ [\d.]+ L /)
  })

  it('draws a same-strand split between two chromosomes along its row', () => {
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr1' }, { refName: 'chr2' }],
      pairs: enumerateConnectorPairs(
        twoRegions,
        'crossRegion',
        undefined,
        chr1chr2,
      ),
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.d).toBe('M 2500 5 L 9000 5')
    expect(arcs[0]!.label).toBe('Inter-chromosomal')
  })

  it('dips an inverted split between two chromosomes', () => {
    const inverted = makeData({
      names: ['r'],
      ids: ['r-supplementary'],
      flags: [SAM_FLAG_SUPPLEMENTARY],
      strands: [-1],
      positions: [[9000, 9100]],
      ys: [0],
    })
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr1' }, { refName: 'chr2' }],
      pairs: enumerateConnectorPairs(
        new Map([
          [0, inRegion0],
          [1, inverted],
        ]),
        'crossRegion',
        undefined,
        chr1chr2,
      ),
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.label).toBe('Inter-chromosomal')
    const { sy1, cp1y, cp2y } = controlPoints(arcs[0]!.d)
    expect(cp1y).toBeGreaterThan(sy1)
    expect(cp2y).toBeGreaterThan(sy1)
  })

  // A fusion onto a minus-strand partner, viewed with that partner's region
  // flipped: both segments point right on screen, so the molecule reads
  // straight across the seam, in the inter-chromosomal color its arc takes.
  it('draws an inverted split straight when one partner region is flipped', () => {
    const inverted = makeData({
      names: ['r'],
      ids: ['r-supplementary'],
      flags: [SAM_FLAG_SUPPLEMENTARY],
      strands: [-1],
      positions: [[9000, 9100]],
      ys: [0],
    })
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [
        { refName: 'chr1' },
        { refName: 'chr2', reversed: true },
      ],
      pairs: enumerateConnectorPairs(
        new Map([
          [0, inRegion0],
          [1, inverted],
        ]),
        'crossRegion',
        undefined,
        chr1chr2,
      ),
    })
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.d).toMatch(/^M [\d.]+ 5 L [\d.]+ 5$/)
    expect(arcs[0]!.label).toBe('Inter-chromosomal')
  })

  const dips = (d: string) => {
    const { sy1, cp1y, cp2y } = controlPoints(d)
    return cp1y > sy1 && cp2y > sy1
  }

  // Alignments on chr1, chr2, then chr1 again left of the first, all on the
  // chain's one row.
  it('dips a same-strand junction whose line would cross its own alignments', () => {
    const chr1 = makeData({
      names: ['f', 'f'],
      ids: ['f-a', 'f-c'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, 1],
      positions: [
        [1000, 1100],
        [500, 600],
      ],
      ys: [0, 0],
      clipAtStart: [0, 200],
    })
    const chr2 = makeData({
      names: ['f'],
      ids: ['f-b'],
      flags: [SAM_FLAG_SUPPLEMENTARY],
      strands: [1],
      positions: [[5000, 5100]],
      ys: [0],
      clipAtStart: [100],
    })
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr1' }, { refName: 'chr2' }],
      pairs: enumerateConnectorPairs(
        new Map([
          [0, chr1],
          [1, chr2],
        ]),
        'crossRegion',
      ),
    })
    expect(arcs.find(a => a.x1 === 1100)!.d).toBe('M 1100 5 L 5000 5')
    expect(dips(arcs.find(a => a.x1 === 5100)!.d)).toBe(true)
  })

  // The same chain with both regions flipped: every segment still faces one
  // way, but screen order now runs right to left, so the chr1 to chr2 line is
  // the one that would cross the read's other chr1 alignment.
  it('finds the crossing in screen order when both regions are reversed', () => {
    const chr1 = makeData({
      names: ['f', 'f'],
      ids: ['f-a', 'f-c'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, 1],
      positions: [
        [1000, 1100],
        [500, 600],
      ],
      ys: [0, 0],
      clipAtStart: [0, 200],
    })
    const chr2 = makeData({
      names: ['f'],
      ids: ['f-b'],
      flags: [SAM_FLAG_SUPPLEMENTARY],
      strands: [1],
      positions: [[5000, 5100]],
      ys: [0],
      clipAtStart: [100],
    })
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [
        { refName: 'chr1', reversed: true },
        { refName: 'chr2', reversed: true },
      ],
      pairs: enumerateConnectorPairs(
        new Map([
          [0, chr1],
          [1, chr2],
        ]),
        'crossRegion',
      ),
    })
    expect(dips(arcs.find(a => a.x1 === 1100)!.d)).toBe(true)
    expect(arcs.find(a => a.x1 === 5100)!.d).toBe('M 5100 5 L 500 5')
  })

  // Reversing chr2 alone puts the supplementary's 5' edge on its right, so the
  // line would cross it; flipping the whole view keeps the two ends facing.
  it('reads the crossing in screen order across reversed regions', () => {
    const primary = makeData({
      names: ['r'],
      ids: ['r-primary'],
      flags: [0],
      strands: [1],
      positions: [[2400, 2500]],
      ys: [0],
      clipAtStart: [0],
    })
    const supplementary = makeData({
      names: ['r'],
      ids: ['r-supplementary'],
      flags: [SAM_FLAG_SUPPLEMENTARY],
      strands: [1],
      positions: [[9000, 9100]],
      ys: [0],
      clipAtStart: [100],
    })
    const arcFor = (
      map: Map<number, PileupDataResult>,
      displayedRegions: { refName: string; reversed?: boolean }[],
    ) =>
      drawnConnectors({
        colors: PALETTE,
        ...baseOpts,
        displayedRegions,
        pairs: enumerateConnectorPairs(map, 'crossRegion'),
      })[0]!
    const chr2Reversed = arcFor(
      new Map([
        [0, primary],
        [1, supplementary],
      ]),
      [{ refName: 'chr1' }, { refName: 'chr2', reversed: true }],
    )
    expect(dips(chr2Reversed.d)).toBe(true)
    const flipped = arcFor(
      new Map([
        [0, supplementary],
        [1, primary],
      ]),
      [
        { refName: 'chr2', reversed: true },
        { refName: 'chr1', reversed: true },
      ],
    )
    expect(flipped.d).toBe('M 2500 5 L 9000 5')
  })

  it('carries the read name and both endpoint xs for the overlay', () => {
    const arcs = drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr1' }, { refName: 'chr1' }],
      pairs: enumerateConnectorPairs(twoRegions, 'crossRegion'),
    })
    expect(arcs[0]).toMatchObject({
      readName: 'r',
      id1: 'r-primary',
      id2: 'r-supplementary',
      x1: 2500,
      x2: 9000,
    })
  })
})

// A read that leaves chr3 forward, hops 199bp on chr10, and lands back on chr3
// forward 1.5kb on. The two chr3 arms are a normal-orientation pair in one
// region, which the straight-line pass would join solid as a plain deletion.
describe('a same-strand junction across segments nothing fetched', () => {
  const sameStrand = (ys: number[]) =>
    new Map([
      [
        0,
        makeData({
          names: ['chain3', 'chain3'],
          ids: ['chain3-primary', 'chain3-supp'],
          flags: [0, SAM_FLAG_SUPPLEMENTARY],
          strands: [1, 1],
          positions: [
            [1000, 1500],
            [3000, 3500],
          ],
          clipAtStart: [0, 699],
          suppAlignments: [
            'chr10,600001,+,500S199M500S,60,0;chr3,3001,+,699S500M,60,0',
            'chr3,1001,+,500M699S,60,0;chr10,600001,+,500S199M500S,60,0',
          ],
          ys,
        }),
      ],
    ])
  const identity = (refName: string) => refName
  const arcOf = (ys: number[]) =>
    drawnConnectors({
      colors: PALETTE,
      ...baseOpts,
      displayedRegions: [{ refName: 'chr3' }],
      pairs: enumerateConnectorPairs(sameStrand(ys), 'all', identity),
    })

  it('leaves the straight-line pass for the overlay', () => {
    const map = sameStrand([0, 1])
    expect(linesOf(map).get(0)?.numLinkedReadLines).toBe(1)
    expect(linesOf(map, identity).size).toBe(0)
  })

  it('draws a dashed straight line between rows, naming the loci', () => {
    const arcs = arcOf([0, 1])
    expect(arcs).toHaveLength(1)
    expect(arcs[0]!.d).toBe('M 1500 5 L 3000 17')
    expect(arcs[0]!.dash).toBe(HIDDEN_SEGMENT_DASH)
    expect(arcs[0]!.hiddenSegmentsBetween).toEqual(['chr10:600,001-600,199'])
  })

  // A chain puts both ends on one row, where a straight dash would lie on the
  // chain's own connecting line.
  it('bows up over the row when both ends share it', () => {
    const [arc] = arcOf([2, 2])
    const cp = controlPoints(arc!.d)
    expect(cp.sy1).toBe(29)
    expect(cp.sy2).toBe(29)
    expect(cp.cp1y).toBeLessThan(29)
    expect(cp.cp2y).toBeLessThan(29)
    expect(arc!.dash).toBe(HIDDEN_SEGMENT_DASH)
  })
})

// The key is built from the palette and labels the overlay itself draws with,
// so a color the reader met on screen is keyed by that same color.
describe('connectorCategories', () => {
  const field = 'insertSizeAndOrientation'
  const every = (slot: number) => connectorColorType(() => slot)
  const labels = (colorTypes: number[], f: ArcColorField = field) =>
    getArcLegendItems(connectorCategories(colorTypes, f), PALETTE).map(
      i => i.label,
    )

  it('names the inter-chromosomal slot as the arc key does', () => {
    expect(labels([every(ARC_COLOR_INTERCHROM)])).toEqual(['Inter-chromosomal'])
  })

  it('keys the connection colors in view in the arc key own words', () => {
    expect(
      labels([
        every(ARC_COLOR_SPLIT_INV_LL),
        connectorColorType(f => pairColorType(f, 3, 0, undefined)),
      ]),
    ).toEqual([
      'RR - Both mates reverse strand',
      'Split read (inversion, LL-type)',
    ])
  })

  // An LR pair and one whose orientation the worker never computed share the
  // arcs' baseline slot, so they key one row, named for the field.
  it('keys one row per category, not one per connector kind', () => {
    const lr = connectorColorType(f => pairColorType(f, 1, 0, undefined))
    const unknown = connectorColorType(f => pairColorType(f, 0, 0, undefined))
    expect(labels([lr, unknown])).toHaveLength(1)
    expect(
      labels([lr, unknown, every(ARC_COLOR_DEFAULT)], 'pairOrientation'),
    ).toEqual(['LR - Normal pair orientation'])
  })
})

// The `connection` filter fields as the connectors read them: the test the arc band
// applies to the same connection
describe('connectorFilterOf', () => {
  const first = SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR
  const second = SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR
  // region 0 holds an ordinary pair `w`, one mate of `m` and the primary of
  // the split read `r`; region 1 the other mate and the supplementary. `m`'s
  // records name their mates on another chromosome where the regions' refNames
  // differ, as a real BAM's RNEXT does.
  const twoRegions = (mInterchrom: number) =>
    new Map([
      [
        0,
        makeData({
          names: ['w', 'w', 'm', 'r'],
          ids: ['w1', 'w2', 'm1', 'r-primary'],
          flags: [first, second, first, 0],
          strands: [1, -1, 1, 1],
          orientations: [PAIR_DIRECTION_NUM.LR, PAIR_DIRECTION_NUM.LR, 0, 0],
          positions: [
            [100, 200],
            [300, 400],
            [500, 600],
            [2400, 2500],
          ],
          ys: [0, 1, 2, 3],
          interchrom: [0, 0, mInterchrom, 0],
        }),
      ],
      [
        1,
        makeData({
          names: ['m', 'r'],
          ids: ['m2', 'r-supplementary'],
          flags: [second, SAM_FLAG_SUPPLEMENTARY],
          strands: [-1, 1],
          positions: [
            [9500, 9600],
            [9000, 9100],
          ],
          ys: [0, 1],
          interchrom: [mInterchrom, 0],
        }),
      ],
    ])

  function drawn(
    filter: Partial<ConnectionFilter>,
    {
      refNames = ['chr1', 'chr2'],
      belowFloor = () => new Set<string>(),
      mInterchrom = refNames[0] === refNames[1] ? 0 : 1,
    }: {
      refNames?: string[]
      belowFloor?: () => ReadonlySet<string>
      mInterchrom?: number
    } = {},
  ) {
    const { lines, overlayPairs } = resolveConnectors(twoRegions(mInterchrom), {
      lines: true,
      scope: 'all',
      admits: connectorFilterOf(
        { minInterchromReads: 2, ...filter },
        i => refNames[i],
        belowFloor,
      ),
    })
    return {
      lines: lines.get(0)?.numLinkedReadLines ?? 0,
      curves: overlayPairs
        .map(({ e1 }) => readNameAt(e1.data, e1.readIdx))
        .toSorted(),
    }
  }

  test('unfiltered, every connection draws', () => {
    expect(drawn({})).toEqual({ lines: 1, curves: ['m', 'r'] })
  })

  test('interchrom takes both connections whose ends are on two contigs', () => {
    expect(drawn({ interchrom: 'exclude' })).toEqual({ lines: 1, curves: [] })
    expect(drawn({ interchrom: 'only' })).toEqual({
      lines: 0,
      curves: ['m', 'r'],
    })
  })

  test('two regions on one contig cross no chromosomes', () => {
    expect(
      drawn({ interchrom: 'exclude' }, { refNames: ['chr1', 'chr1'] }).curves,
    ).toEqual(['m', 'r'])
  })

  // a translocated mate's supplementary beside its partner: the records name
  // the mate on another chromosome, the connector paints inter-chromosomal,
  // and the filter takes it with the rest
  test('a mate link whose records name a mate elsewhere is inter-chromosomal on one contig', () => {
    expect(
      drawn(
        { interchrom: 'exclude' },
        { refNames: ['chr1', 'chr1'], mInterchrom: 1 },
      ).curves,
    ).toEqual(['r'])
  })

  test('a connector is never an off-screen mate', () => {
    expect(drawn({ offscreenMates: 'only' })).toEqual({ lines: 0, curves: [] })
    expect(drawn({ offscreenMates: 'exclude' })).toEqual(drawn({}))
  })

  test('the floor drops a mate link, and a split read is exempt', () => {
    expect(drawn({}, { belowFloor: () => new Set(['m', 'r']) })).toEqual({
      lines: 1,
      curves: ['r'],
    })
  })

  // chain layout runs no straight-line pass, and its overlay takes the filter
  test('the filter reaches the overlay with the straight-line pass off', () => {
    const curves = (filter: Partial<ConnectionFilter>) =>
      resolveConnectors(twoRegions(1), {
        lines: false,
        scope: 'all',
        admits: connectorFilterOf(
          { minInterchromReads: 2, ...filter },
          i => ['chr1', 'chr2'][i],
          () => new Set(),
        ),
      })
        .overlayPairs.map(({ e1 }) => readNameAt(e1.data, e1.readIdx))
        .toSorted()
    expect(curves({})).toEqual(['m', 'r'])
    expect(curves({ interchrom: 'exclude' })).toEqual([])
  })

  test('a floor of 1 never asks for the band collection', () => {
    const belowFloor = jest.fn(() => new Set(['m']))
    expect(drawn({ minInterchromReads: 1 }, { belowFloor }).curves).toEqual([
      'm',
      'r',
    ])
    expect(belowFloor).not.toHaveBeenCalled()
  })
})

import { SAM_FLAG_PAIRED, SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/cigar-utils'

import { basePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.consts.generated.ts'
import { namesToBlock } from '../../shared/readNameBlock.ts'
import { nextRefsToTable } from '../../shared/readNextRefs.ts'
import { computeArcsByGroup, computeArcsFromPileupData } from './compute.ts'
import { arcMarkFrom } from './mark.ts'
import {
  ARC_SHAPE_FLAT,
  ARC_SHAPE_FLAT_SPLIT,
  ARC_SHAPE_FLAT_UNPLACED,
} from './shapes.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { RegionInfo } from './arcTypes.ts'

// The read cloud draws a bar only where the view can place BOTH of a
// connection's ends. A partner outside every loaded region has no second pixel
// to draw to, so the mark collapses onto the end that is on screen and sits on
// the band's zero anchor.
//
// It reaches PAST the fetch by a multiple of the fetched span (`cloudReachBp`),
// so a real event just off the edge keeps its bars while a mate dropped at a
// random spot on the chromosome does not.
//
// THE RULE IS PLACEMENT, NOT DISTANCE, and these are written so that a span
// threshold passes half of them and fails the other half: the same 5 Mb pair is
// parked out of one window and drawn across two, and the same 30 kb pair is
// drawn out of a 20 kb window and parked out of a 1 kb one.

function pairData(overrides: Partial<PileupDataResult>): PileupDataResult {
  const n = (overrides.readPositions?.length ?? 0) / 2
  return { ...basePileupDataResult(n), ...overrides }
}

// One read whose mate the aligner placed `mateBp` away on the same contig.
// Orientation 2 (RL) keeps it out of the concordant-FR drop whatever band the
// fixture happens to produce.
function loneMateAt(mateBp: number, tlen: number, readBp = 1000) {
  return pairData({
    readPositions: new Uint32Array([readBp, readBp + 150]),
    readFlags: new Uint16Array([SAM_FLAG_PAIRED]),
    readStrands: new Int8Array([1]),
    readInsertSizes: new Float32Array([tlen]),
    readPairOrientations: new Uint8Array([2]),
    ...namesToBlock(['readA']),
    ...nextRefsToTable(['chr1']),
    readNextPositions: new Uint32Array([mateBp]),
  })
}

const CLOUD = {
  colorByType: 'insertSizeAndOrientation' as const,
  cloud: true,
  drawInter: false,
  drawLongRange: true,
}

function region(start: number, end: number, displayedRegionIndex = 0) {
  return { refName: 'chr1', start, end, displayedRegionIndex }
}

// The single-window view: one loaded region, one displayed region covering it.
function runCloud(data: PileupDataResult, loaded: RegionInfo[]) {
  return computeArcsFromPileupData(new Map([[0, data]]), loaded, CLOUD)
}

describe('a connection the view can place only one end of', () => {
  test('collapses onto the end that is on screen and sits on the anchor', () => {
    const { arcs } = runCloud(loneMateAt(50_001_000, 50_000_000), [
      region(0, 20_000),
    ])
    expect(arcs).toHaveLength(1)
    const arc = arcs[0]!
    expect(arc.shapeType).toBe(ARC_SHAPE_FLAT_UNPLACED)
    // The anchor, which `arcYFraction` reads as offset 0 — off the axis rather
    // than at the top of it, so the row cannot be mistaken for a real maximal
    // event.
    expect(arc.yBp).toBe(0)
    // BOTH FEET on the read that is loaded. This is what lets all four
    // renderers draw the mark with no geometry of their own, and what stops the
    // bar being extrapolated to a coordinate no block covers.
    expect(arc.p1.bp).toBe(1000)
    expect(arc.p2.bp).toBe(1000)
    // The distance is not lost, only unplotted — this is what the hover reports
    // (`formatArcTooltip`).
    expect(arc.spanBp).toBe(50_000_000)
  })

  // The case the whole design turns on, and the one a span threshold gets
  // wrong. Nothing about the pair changed: the reader opened a second region at
  // the far breakpoint, and now both ends are on screen.
  test('keeps its bar once a second region shows the partner', () => {
    const loaded = [region(0, 20_000, 0), region(5_000_000, 5_020_000, 1)]
    const { arcs, crossRegion } = computeArcsFromPileupData(
      new Map([[0, loneMateAt(5_001_000, 5_000_000)]]),
      loaded,
      CLOUD,
      loaded,
    )
    const all = [...arcs, ...crossRegion]
    expect(all).toHaveLength(1)
    expect(all[0]!.shapeType).toBe(ARC_SHAPE_FLAT)
    expect(all[0]!.yBp).toBeGreaterThan(0)
    // Both real feet survive: this is a bar between two places on screen.
    expect(all[0]!.p1.bp).toBe(1000)
    expect(all[0]!.p2.bp).toBe(5_001_000)
    // No per-region pass can join two displayed regions, so it belongs to the
    // overlay that draws across the seam.
    expect(crossRegion).toHaveLength(1)
  })

  // THE distinction the rule turns on in the real app, and the one a test built
  // out of `computeArcsFromPileupData`'s defaults cannot see: an ordinary LGV
  // shows ONE displayed region and it is the whole chromosome, so every mate on
  // that chromosome resolves to it. Only the loaded list — the fetch — says what
  // is on screen.
  test('placement is asked of the loaded list, not the displayed one', () => {
    const { arcs } = computeArcsFromPileupData(
      new Map([[0, loneMateAt(50_001_000, 50_000_000)]]),
      [region(0, 20_000)],
      CLOUD,
      [region(0, 249_250_621)],
    )
    expect(arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT_UNPLACED)
  })

  test('a pair whose mate is inside the loaded region keeps its bar', () => {
    const { arcs } = runCloud(loneMateAt(9_000, 8_000), [region(0, 20_000)])
    expect(arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT)
    expect(arcs[0]!.p2.bp).toBe(9_000)
  })

  // The reach: a partner OUTSIDE the fetch still gets a bar while it is close
  // enough to be something rather than nowhere. A strict containment test threw
  // away the case the band is most worth looking at — a real event just past the
  // window edge, whose pairs agree on one span and draw one clean row.
  test('a mate just outside the loaded region still gets its bar', () => {
    const { arcs } = runCloud(loneMateAt(30_000, 29_000), [region(0, 20_000)])
    expect(arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT)
    expect(arcs[0]!.p2.bp).toBe(30_000)
  })

  // BOTH SIDES. Every other case here puts the partner to the right of the
  // window, so a reach applied to one edge only passes all of them — the read
  // sits at 110 kb inside a region starting at 100 kb, and its mate is 20 kb
  // BELOW that start.
  test('the reach runs off the near edge of the region as well', () => {
    const loaded = [region(1_000_000, 1_020_000)]
    const near = runCloud(loneMateAt(990_000, 20_000, 1_010_000), loaded)
    expect(near.arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT)
    expect(near.arcs[0]!.p2.bp).toBe(990_000)

    // And ends on that side too: 20 x 20 kb of reach reaches back to 600 kb.
    const far = runCloud(loneMateAt(500_000, 510_000, 1_010_000), loaded)
    expect(far.arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT_UNPLACED)
  })

  // THE REACH IS RELATIVE TO WHAT IS LOADED, which is what a constant cannot be:
  // the same 30 kb pair is drawn out of a 20 kb window and parked out of a 1 kb
  // one, and no bp threshold produces both answers. The far side of the reach is
  // pinned beside it so "lenient" does not quietly mean "unbounded".
  test('the reach scales with the fetch, and ends', () => {
    const wide = runCloud(loneMateAt(30_000, 29_000), [region(0, 20_000)])
    expect(wide.arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT)

    const narrow = runCloud(loneMateAt(30_000, 29_000), [region(0, 1_000)])
    expect(narrow.arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT_UNPLACED)

    // Past the reach out of the same 20 kb window: 20x20 kb is 400 kb.
    const past = runCloud(loneMateAt(600_000, 599_000), [region(0, 20_000)])
    expect(past.arcs[0]!.shapeType).toBe(ARC_SHAPE_FLAT_UNPLACED)
    expect(past.arcs[0]!.p2.bp).toBe(1000)
  })

  // Every segment of the chain is a read, so the rule is the connection's and
  // not the mate link's: a split junction whose far segment is off screen draws
  // the same bar to nowhere.
  test('a split junction to an off-screen segment is unplaced', () => {
    const data = pairData({
      readPositions: new Uint32Array([1000, 1500, 5_000_001, 5_000_201]),
      readFlags: new Uint16Array([0, SAM_FLAG_SUPPLEMENTARY]),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([0, 0]),
      readPairOrientations: new Uint8Array([0, 0]),
      ...namesToBlock(['readA', 'readA']),
    })
    expect(runCloud(data, [region(0, 20_000)]).arcs[0]!.shapeType).toBe(
      ARC_SHAPE_FLAT_UNPLACED,
    )
    // Loaded wide enough to hold both segments, and it is an ordinary dashed
    // split junction again.
    expect(runCloud(data, [region(0, 6_000_000)]).arcs[0]!.shapeType).toBe(
      ARC_SHAPE_FLAT_SPLIT,
    )
  })

  test('arc mode places nothing on the anchor — its Y is a genomic radius', () => {
    const { arcs } = computeArcsFromPileupData(
      new Map([[0, loneMateAt(50_001_000, 50_000_000)]]),
      [region(0, 20_000)],
      { ...CLOUD, cloud: false },
    )
    expect(arcs[0]!.shapeType).not.toBe(ARC_SHAPE_FLAT_UNPLACED)
    expect(arcs[0]!.p2.bp).toBe(50_001_000)
  })
})

// An unplaced connection's span is what used to set `arcsYDomainBp` for every
// lane — `insertSizeTickSections` then LABELS the top of the axis with it, so
// one mismapped mate printed "50Mb" over a band whose real content topped out
// at a few kb. Taking the bar away is only half the fix if the span still sizes
// the axis.
describe('an unplaced connection no longer sizes the axis', () => {
  test('the domain is the largest span the view can actually place', () => {
    const data = pairData({
      readPositions: new Uint32Array([1000, 1150, 2000, 2150]),
      readFlags: new Uint16Array([SAM_FLAG_PAIRED, SAM_FLAG_PAIRED]),
      readStrands: new Int8Array([1, 1]),
      readInsertSizes: new Float32Array([50_000_000, 8_000]),
      readPairOrientations: new Uint8Array([2, 2]),
      ...namesToBlock(['readFar', 'readNear']),
      ...nextRefsToTable(['chr1', 'chr1']),
      readNextPositions: new Uint32Array([50_001_000, 10_000]),
    })
    const loaded = [region(0, 20_000)]
    const result = computeArcsByGroup(
      new Map([['', new Map([[0, data]])]]),
      { loaded, displayed: loaded },
      CLOUD,
    )
    // The near pair, and only it. 50000000 is what the domain was.
    expect(result.maxFlatArcSpanBp).toBe(8_000)
  })
})

// The collapse in `resolveArcs` is what buys the unplaced mark its geometry:
// with both feet on one bp every consumer already handles it, so there is no
// fourth mark kind for a renderer to get wrong. This pins the shape that
// follows.
describe('an unplaced connection resolves to a minimum-width mark on the anchor', () => {
  const frame = {
    arcsYDomainBp: 8000,
    arcsYLog: true,
    arcsTop: 100,
    arcsH: 60,
    pairedArcsDown: false,
    screenWidthPx: 800,
  }

  test('one square`s worth of bar at the placed foot, on the zero anchor', () => {
    const mark = arcMarkFrom(
      { sx1: 420, sx2: 420, yBp: 0, shapeType: ARC_SHAPE_FLAT_UNPLACED },
      frame,
    )
    expect(mark.kind).toBe('bar')
    if (mark.kind !== 'bar') {
      throw new Error('unplaced marks are bars')
    }
    // Up mode: the anchor is the band's bottom edge.
    expect(mark.markY).toBe(frame.arcsTop + frame.arcsH)
    expect(mark.destY).toBe(0)
    // Not the screen-wide extent the uncollapsed pair would have widened to.
    expect(mark.halfPx).toBe(ARC_FLAT_MIN_PX / 2)
    expect(mark.sx1).toBe(mark.sx2)
  })
})

import { CIGAR_D, CIGAR_M } from '@jbrowse/cigar-utils'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'

import {
  RULER_GRID_ORIGIN,
  buildSyntenyGeometry,
  markerGridPitch,
} from './buildSyntenyGeometry.ts'
import { KIND_BASE, KIND_MARKER } from './syntenyColors.ts'

// Everything here runs at bpPerPx=1 with viewOff=0 on both axes, so cumBp,
// genomic bp and screen px are all the same number and a marker's position can
// be read straight off `bp1`. The grid the markers land on is the query view's
// scalebar grid subdivided, which at this scale is:
const PITCH = markerGridPitch(1) // 40

// The subdivision, stated against the ruler it subdivides rather than as the
// literal 40 above: every labelled scalebar gridline carries a tick, and so do
// the evenly spaced positions between each adjacent pair.
test('the marker pitch divides the query ruler pitch', () => {
  for (const bpPerPx of [0.5, 1, 13, 500, 6428, 103_571]) {
    const ruler = chooseGridPitch(bpPerPx, 120, 15).majorPitch
    expect(ruler % markerGridPitch(bpPerPx)).toBe(0)
    expect(markerGridPitch(bpPerPx)).toBeLessThanOrEqual(ruler)
    // never a fractional bp — a tick has to land on a base
    expect(Number.isInteger(markerGridPitch(bpPerPx))).toBe(true)
  }
})

// One feature spanning [0, widthBp] on both axes. `cigar` defaults to none;
// passing one turns CIGAR detail on, which routes the markers through the
// rendered segments instead of the feature's corners.
function buildWithMarkers(widthBp: number, cigar: number[] = []) {
  return buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([widthBp]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([widthBp]),
    // A forward region starting at genomic 0, so cumBp IS the genomic
    // coordinate and the anchor is the grid origin itself: ticks land at
    // RULER_GRID_ORIGIN plus multiples of the pitch (99, 199, ...), one base
    // below each round coordinate, which is where the scalebar draws them.
    queryGridAnchors: new Float64Array([RULER_GRID_ORIGIN]),
    strands: new Int8Array([1]),
    parsedCigars: [cigar],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([widthBp]),
    drawCIGAR: cigar.length > 0,
    drawCIGARMatchesOnly: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: widthBp,
  })
}

const op = (len: number, code: number) => (len << 4) | code

function markerIndices(kinds: Uint8Array) {
  return [...kinds].flatMap((k, i) => (k === KIND_MARKER ? [i] : []))
}

test('markers land on the query axis grid, not at fractions of the feature', () => {
  const g = buildWithMarkers(400)
  const markers = markerIndices(g.kinds)

  // One base below each multiple of the pitch, because that is where the
  // scalebar puts the gridline it labels with that coordinate — the ruler's
  // phase, not an off-by-one here. See RULER_GRID_ORIGIN.
  expect(markers.map(i => g.bp1[i])).toEqual([
    39, 79, 119, 159, 199, 239, 279, 319, 359, 399,
  ])

  // Each marker is a vertical tick: a point on each axis (top span and bottom
  // span both zero).
  for (const i of markers) {
    expect(g.bp1[i]!).toBe(g.bp2[i]!)
    expect(g.bp3[i]!).toBe(g.bp4[i]!)
  }
})

test('the grid is absolute, so panning does not slide the markers', () => {
  // Same 400bp feature, moved 30bp along the query axis. A per-feature ladder
  // would carry its ticks with it; a grid does not.
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([30]),
    p12_cumBp: new Float64Array([430]),
    p21_cumBp: new Float64Array([30]),
    p22_cumBp: new Float64Array([430]),
    queryGridAnchors: new Float64Array([RULER_GRID_ORIGIN]),
    strands: new Int8Array([1]),
    parsedCigars: [[]],
    starts: new Uint32Array([30]),
    ends: new Uint32Array([430]),
    drawCIGAR: false,
    drawCIGARMatchesOnly: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 500,
  })
  // The same ten positions the un-moved feature above took, not the same ten
  // offsets into the feature.
  expect(markerIndices(g.kinds).map(i => g.bp1[i])).toEqual([
    39, 79, 119, 159, 199, 239, 279, 319, 359, 399,
  ])
})

test('feature narrower than the 30px gate emits no markers', () => {
  const g = buildWithMarkers(20)
  expect(markerIndices(g.kinds)).toEqual([])
  // The base block is still present.
  expect([...g.kinds]).toEqual([KIND_BASE])
})

// INSTANCE ORDER IS DRAW ORDER — the Canvas2D loop walks it and
// `interleaveInstances` packs the GPU buffer in it — so the ticks have to be last
// or a feature drawn later paints over them. They used to be emitted beside their
// own feature, which left every feature's ticks under whatever sorted after it. A
// grid that is over the ribbons for some features and under them for others is not
// a ruler.
test('every marker sorts after every ribbon, whichever branch emitted it', () => {
  // Two features on the same span: one plain (whole-feature markers) and one
  // carrying a CIGAR (per-segment markers), so both emit paths are in one build.
  const cigar = Array.from({ length: 20 }, () => op(20, CIGAR_M))
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0, 0]),
    p12_cumBp: new Float64Array([400, 400]),
    p21_cumBp: new Float64Array([0, 0]),
    p22_cumBp: new Float64Array([400, 400]),
    queryGridAnchors: new Float64Array([RULER_GRID_ORIGIN, RULER_GRID_ORIGIN]),
    strands: new Int8Array([1, 1]),
    parsedCigars: [[], cigar],
    starts: new Uint32Array([0, 0]),
    ends: new Uint32Array([400, 400]),
    drawCIGAR: true,
    // Transparent indels, so the CIGAR branch emits RIBBON quads too (one per
    // match segment) rather than only markers — the ordering claim is about
    // ribbons from both branches against ticks from both branches. It also
    // leaves the tiled feature's reserved full-span base slot unused, which is
    // the slack the gap between the two regions is made of.
    drawCIGARMatchesOnly: true,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 400,
  })
  const markers = markerIndices(g.kinds)
  const ribbons = [...g.kinds].flatMap((k, i) => (k === KIND_MARKER ? [] : [i]))
  // both features laddered, and both drew ribbons
  expect(new Set(markers.map(i => g.instanceFeatureIdx[i])).size).toBe(2)
  expect(ribbons.length).toBeGreaterThan(2)
  expect(Math.min(...markers)).toBeGreaterThan(Math.max(...ribbons))
  // and the two regions abut — the gap the ribbon region's unused slack leaves is
  // closed, so `instanceCount` covers exactly the instances written
  expect(markers.length + ribbons.length).toBe(g.instanceCount)
})

// The regression this file exists for. Rendered CIGAR segments are ~1px wide by
// construction (visitCigarRenderedSegments emits as soon as either axis has
// advanced past one pixel), so the old per-segment "at least 30px wide" gate
// rejected all of them: with the default cigarMode 'full', every feature
// carrying a CIGAR lost its markers entirely. The grid is a property of the
// query axis, so how the feature was cut into spans cannot change it.
test('a fine-grained CIGAR does not cost the feature its markers', () => {
  const width = 1000
  // 100 x 10M: 100 rendered segments, each 10px, none of them 30px wide.
  const cigar = Array.from({ length: 100 }, () => op(10, CIGAR_M))

  const withCigar = buildWithMarkers(width, cigar)
  const without = buildWithMarkers(width)
  expect(markerIndices(withCigar.kinds).map(i => withCigar.bp1[i])).toEqual(
    markerIndices(without.kinds).map(i => without.bp1[i]),
  )
  expect(markerIndices(withCigar.kinds).length).toBe(width / PITCH)
})

// And the reason the CIGAR branch feeds the segments rather than the corners: a
// marker's two ends are the pair the CIGAR actually aligns, so the ticks shear
// where the alignment does. Interpolating across the corners would smear one
// 100bp deletion evenly over the whole ribbon.
test('markers follow the CIGAR through a deletion', () => {
  // Query spans 400, target 360: 200M, 40D (query only), 160M.
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([400]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([360]),
    queryGridAnchors: new Float64Array([RULER_GRID_ORIGIN]),
    strands: new Int8Array([1]),
    parsedCigars: [[op(200, CIGAR_M), op(40, CIGAR_D), op(160, CIGAR_M)]],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([400]),
    drawCIGAR: true,
    drawCIGARMatchesOnly: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 400,
  })
  const markers = markerIndices(g.kinds)
  // Ticks are still on the query grid — the deletion moves where they LAND on
  // the target axis, never where they sit on the query one.
  expect(markers.map(i => g.bp1[i])).toEqual([
    39, 79, 119, 159, 199, 239, 279, 319, 359, 399,
  ])
  // Query 240 and up is past the deletion, so those pair 40bp back. The tick at
  // 239 falls INSIDE the deletion, which is a span of query with no target to
  // travel over: it pairs at the target coordinate the whole deletion collapses
  // to (200), which is 39 back rather than a round 40.
  expect(markers.map(i => g.bp1[i]! - g.bp3[i]!)).toEqual([
    0, 0, 0, 0, 0, 39, 40, 40, 40, 40,
  ])
})

// The marker ladder is the one budget in this file with no natural bound: a
// ribbon is one instance per feature and `cigarBudget` takes a `min` against the
// CIGAR's own length, but grid steps are a property of the feature's genomic
// width. A block wider than the viewport keeps its full corner span unless it
// carries a CIGAR (`clipLargeBlockToWindow` re-anchors only those), so this used
// to reserve — and, because the lanes are `subarray` views, transfer — a slot per
// grid step across the whole alignment: 1,000,003 of them for the 85 ticks below,
// scaling to about a gigabyte at base-level zoom.
//
// Asserted against the ALLOCATION rather than the emitted count, because the
// emitted count was always right; what was wrong was how much was reserved to
// arrive at it.
test('a block far wider than the view budgets for the window, not the block', () => {
  const span = 40_000_000
  const viewWidth = 1400
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([span]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([span]),
    queryGridAnchors: new Float64Array([RULER_GRID_ORIGIN]),
    strands: new Int8Array([1]),
    // no CIGAR, which is what leaves the corners at their full span
    parsedCigars: [[]],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([span]),
    drawCIGAR: false,
    drawCIGARMatchesOnly: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth,
  })
  // 3 view widths + 4 pan buffers, over the pitch, plus the ribbon and the slack
  // — a few hundred, against span/PITCH = a million.
  const allocatedSlots =
    g.bp1.buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
  expect(allocatedSlots).toBeLessThan(1000)
  expect(allocatedSlots).toBeGreaterThanOrEqual(g.instanceCount)
  // and the ticks that survive the emit cull are unchanged: every grid step from
  // the block's left edge out to the far side of the window
  const bp1s = markerIndices(g.kinds).map(i => g.bp1[i]!)
  expect(bp1s[0]).toBe(PITCH - 1)
  expect(new Set(bp1s.map((b, i) => b - (i * PITCH + PITCH - 1)))).toEqual(
    new Set([0]),
  )
  expect(bp1s.length).toBeGreaterThan(30)
})

// Direction, which the grid passes through in two independent places: the CIGAR
// walk's start corner and per-axis sign (`cigarWalkBp1`/`cigarWalkRev1`), and the
// anchor's own (`cumBpAtGenomicCoord` encodes a reversed DISPLAYED REGION —
// tested there). An inversion is the case a marker is most worth reading, so it
// is also the case worth pinning: the ticks stay on the query ruler and the
// pairing runs the other way.
test('an inverted alignment keeps the query grid and pairs backwards', () => {
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([400]),
    // target corners swapped: query 0 pairs with target 400
    p21_cumBp: new Float64Array([400]),
    p22_cumBp: new Float64Array([0]),
    queryGridAnchors: new Float64Array([RULER_GRID_ORIGIN]),
    strands: new Int8Array([-1]),
    parsedCigars: [Array.from({ length: 20 }, () => op(20, CIGAR_M))],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([400]),
    drawCIGAR: true,
    drawCIGARMatchesOnly: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 400,
  })
  const markers = markerIndices(g.kinds)
  // The same ten query coordinates a forward feature over this span takes — the
  // walk runs the other way, so they arrive descending, which nothing downstream
  // reads (instance order is draw order, and every tick is drawn identically).
  expect([...markers.map(i => g.bp1[i]!)].sort((a, b) => a - b)).toEqual([
    39, 79, 119, 159, 199, 239, 279, 319, 359, 399,
  ])
  // and each pairs at the target coordinate the inversion sends it to
  for (const i of markers) {
    expect(g.bp3[i]!).toBeCloseTo(400 - g.bp1[i]!, 6)
  }
})

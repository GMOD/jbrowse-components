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
const PITCH = markerGridPitch(1) // 100

// The subdivision, stated against the ruler it subdivides rather than as the
// literal 100 above: every labelled scalebar gridline carries a tick, and so
// does the midpoint between each adjacent pair.
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
    drawLocationMarkers: true,
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
  const g = buildWithMarkers(1000)
  const markers = markerIndices(g.kinds)

  // One base below each round coordinate, because that is where the scalebar
  // puts the gridline it labels with that coordinate — the ruler's phase, not
  // an off-by-one here. See RULER_GRID_ORIGIN.
  expect(markers.map(i => g.bp1[i])).toEqual([
    99, 199, 299, 399, 499, 599, 699, 799, 899, 999,
  ])

  // Each marker is a vertical tick: a point on each axis (top span and bottom
  // span both zero).
  for (const i of markers) {
    expect(g.bp1[i]!).toBe(g.bp2[i]!)
    expect(g.bp3[i]!).toBe(g.bp4[i]!)
  }
})

test('the grid is absolute, so panning does not slide the markers', () => {
  // Same 1000bp feature, moved 30bp along the query axis. A per-feature ladder
  // would carry its ticks with it; a grid does not.
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([30]),
    p12_cumBp: new Float64Array([1030]),
    p21_cumBp: new Float64Array([30]),
    p22_cumBp: new Float64Array([1030]),
    queryGridAnchors: new Float64Array([RULER_GRID_ORIGIN]),
    strands: new Int8Array([1]),
    parsedCigars: [[]],
    starts: new Uint32Array([30]),
    ends: new Uint32Array([1030]),
    drawCIGAR: false,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: true,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 1100,
  })
  // The same ten positions the un-moved feature above took, not the same ten
  // offsets into the feature.
  expect(markerIndices(g.kinds).map(i => g.bp1[i])).toEqual([
    99, 199, 299, 399, 499, 599, 699, 799, 899, 999,
  ])
})

test('feature narrower than the 30px gate emits no markers', () => {
  const g = buildWithMarkers(20)
  expect(markerIndices(g.kinds)).toEqual([])
  // The base block is still present.
  expect([...g.kinds]).toEqual([KIND_BASE])
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

// And the reason pass 2 feeds the segments rather than the corners: a marker's
// two ends are the pair the CIGAR actually aligns, so the ticks shear where the
// alignment does. Interpolating across the corners would smear one 100bp
// deletion evenly over the whole ribbon.
test('markers follow the CIGAR through a deletion', () => {
  // Query spans 1000, target 900: 500M, 100D (query only), 400M.
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([1000]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([900]),
    queryGridAnchors: new Float64Array([RULER_GRID_ORIGIN]),
    strands: new Int8Array([1]),
    parsedCigars: [[op(500, CIGAR_M), op(100, CIGAR_D), op(400, CIGAR_M)]],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([1000]),
    drawCIGAR: true,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: true,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 1000,
  })
  const markers = markerIndices(g.kinds)
  // Ticks are still on the query grid — the deletion moves where they LAND on
  // the target axis, never where they sit on the query one.
  expect(markers.map(i => g.bp1[i])).toEqual([
    99, 199, 299, 399, 499, 599, 699, 799, 899, 999,
  ])
  // Query 600 and up is past the deletion, so those pair 100bp back. The tick at
  // 599 falls INSIDE the deletion, which is a span of query with no target to
  // travel over: it pairs at the target coordinate the whole deletion collapses
  // to (500), which is 99 back rather than a round 100.
  expect(markers.map(i => g.bp1[i]! - g.bp3[i]!)).toEqual([
    0, 0, 0, 0, 0, 99, 100, 100, 100, 100,
  ])
})

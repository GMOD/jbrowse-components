import { syntenyPanBufferPx } from '@jbrowse/synteny-core'

import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import { KIND_MARKER } from './syntenyColors.ts'

// One CIGAR-less 800bp feature placed at a fixed off-screen px offset, at
// bpPerPx=1 with viewOff=0, so cumBp equals screen px on both axes. It is wide
// enough (>=30px average) for location markers, which are emit-culled against
// the pan buffer — as CIGAR detail segments are. The whole-feature base
// trapezoid is not: features that far off-screen were already dropped by
// executeSyntenyFeaturesAndPositions' cull, which uses the same buffer.
function markersAt({
  viewWidth,
  screenX,
}: {
  viewWidth: number
  screenX: number
}) {
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([screenX]),
    p12_cumBp: new Float64Array([screenX + 800]),
    p21_cumBp: new Float64Array([screenX]),
    p22_cumBp: new Float64Array([screenX + 800]),
    queryGridAnchors: new Float64Array([0]),
    strands: new Int8Array([1]),
    parsedCigars: [[]],
    starts: new Uint32Array([screenX]),
    ends: new Uint32Array([screenX + 800]),
    drawCIGAR: false,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: true,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth,
  })
  return [...g.kinds.subarray(0, g.instanceCount)].filter(
    k => k === KIND_MARKER,
  ).length
}

// The emit cull must use the same width-scaled buffer as the fetch window and
// the worker's whole-feature cull. A fixed 2000px here was narrower than both on
// a view wider than 4000px: the fetch key snaps to a buffer-sized grid, so a pan
// of up to syntenyPanBufferPx doesn't refetch, and detail culled inside that
// distance left plain base ribbons — no indel segments, no markers — at the
// leading edge of the pan until the snapped window rolled over.
test('a wide view emits detail out to its half-width pan buffer', () => {
  const viewWidth = 6000
  expect(syntenyPanBufferPx(viewWidth)).toBe(3000)
  // 2100..2900px off the right edge: inside the 3000px buffer, outside a
  // fixed 2000
  expect(markersAt({ viewWidth, screenX: viewWidth + 2100 })).toBeGreaterThan(0)
})

test('detail past the pan buffer is still culled', () => {
  expect(markersAt({ viewWidth: 6000, screenX: 6000 + 3100 })).toBe(0)
})

test('a narrow view keeps the PAN_BUFFER_PX floor', () => {
  const viewWidth = 800
  expect(syntenyPanBufferPx(viewWidth)).toBe(2000)
  expect(markersAt({ viewWidth, screenX: viewWidth + 1100 })).toBeGreaterThan(0)
  expect(markersAt({ viewWidth, screenX: viewWidth + 2100 })).toBe(0)
})

// A tick spanning the band with NEITHER end inside it, which is what an
// inversion wide enough to leave the frame on both sides produces: the top ends
// sit far left of the buffer and the bottom ends far right of it. The hull test
// keeps it — testing the two endpoints separately would drop every such tick
// while the ribbon under them stays — and the travel cap then drops it anyway.
//
// Both rules are deliberate and they cannot both hold here. Reaching this
// geometry means the tick's two ends are at least an emit window apart, so it
// draws a few degrees off horizontal across the whole frame with neither end
// anywhere a reader can look, which is what `hg002_haplotypes_location_markers`
// was denied for twice. The hull test is left doing the ordinary
// same-direction off-screen cull, which is what the tests above pin.
test('a marker straddling the whole band travels too far to be worth drawing', () => {
  const viewWidth = 800
  const buffer = syntenyPanBufferPx(viewWidth) // 2000
  // Query axis 3000..3800px (left of -2000 once the view offset is applied);
  // target axis lands past the right edge of the buffer. Both endpoints are
  // outside the band, in opposite directions.
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([800]),
    p21_cumBp: new Float64Array([viewWidth + buffer + 500]),
    p22_cumBp: new Float64Array([viewWidth + buffer + 1300]),
    queryGridAnchors: new Float64Array([0]),
    strands: new Int8Array([1]),
    parsedCigars: [[]],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([800]),
    drawCIGAR: false,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: true,
    bpPerPx0: 1,
    bpPerPx1: 1,
    // shifts the query ends to -3000..-2200, past the left edge of the band
    viewOff0: 3000,
    viewOff1: 0,
    viewWidth,
  })
  expect(
    [...g.kinds.subarray(0, g.instanceCount)].filter(k => k === KIND_MARKER)
      .length,
  ).toBe(0)
})

// The cap's two sides, on the same feature, so the only thing separating them is
// how far the tick travels. `shearPx` is the offset between the two axes: the
// target span sits that many px right of the query span, and since both axes are
// at bpPerPx 1 with the query at viewOff 0, it IS the horizontal distance
// between a tick's two ends.
function markersWithShear(shearPx: number) {
  const viewWidth = 800
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([800]),
    p21_cumBp: new Float64Array([shearPx]),
    p22_cumBp: new Float64Array([shearPx + 800]),
    queryGridAnchors: new Float64Array([0]),
    strands: new Int8Array([1]),
    parsedCigars: [[]],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([800]),
    drawCIGAR: false,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: true,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth,
  })
  return [...g.kinds.subarray(0, g.instanceCount)].filter(
    k => k === KIND_MARKER,
  ).length
}

// Below the cap the tick is a correspondence a reader can follow with their
// eyes: both of its ends are within a frame's width of each other, which is the
// most an inversion or an indel INSIDE the frame can shear one.
test('a tick shorter than a view width is kept', () => {
  expect(markersWithShear(700)).toBeGreaterThan(0)
})

// Past it the mark is a near-horizontal line with neither end anywhere useful.
// This is the shape the review rejected on hg002_haplotypes_location_markers.
test('a tick travelling further than the view is wide is dropped', () => {
  expect(markersWithShear(900)).toBe(0)
})

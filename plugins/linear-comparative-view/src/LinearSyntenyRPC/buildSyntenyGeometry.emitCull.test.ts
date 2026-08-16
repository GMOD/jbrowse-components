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
// while the ribbon under them stays.
//
// The tick is nonetheless not drawn: it travels a whole emit window, so the
// TRAVEL CAP drops it, which is what `hg002_haplotypes_location_markers` was
// denied for twice. That cap is not here, though, and the division is the point
// of this test. How far a tick travels is a function of how far the two views
// have panned APART, which changes without a refetch — so the worker cannot
// answer it, and both renderers ask it per frame instead (markerTravelsTooFar,
// pinned in syntenyRibbonCull.test.ts). What the worker culls is only what a pan
// cannot bring back without refetching: the emit window IS the pan buffer.
test('the emit cull keeps a marker the travel cap will drop, and leaves that to the cull', () => {
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
  ).toBeGreaterThan(0)
})

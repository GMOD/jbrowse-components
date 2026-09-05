import { CIGAR_D, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import { KIND_BASE, KIND_CIGAR_D, KIND_MARKER } from './syntenyColors.ts'

import type { CumBpSpan } from '@jbrowse/synteny-core'

const op = (len: number, o: number) => (len << 4) | o

// One 800bp feature at bpPerPx=1 with viewOff=0, so cumBp equals screen px on
// both axes. Wide enough (>=30px) for location markers; with a CIGAR it draws
// detail too. The windows are the test's own, in cumBp: the emit cull is
// against them and nothing else.
function build({
  top,
  bottom = top,
  window0,
  window1 = window0,
  cigar = [],
}: {
  top: number
  bottom?: number
  window0: CumBpSpan
  window1?: CumBpSpan
  cigar?: number[]
}) {
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([top]),
    p12_cumBp: new Float64Array([top + 800]),
    p21_cumBp: new Float64Array([bottom]),
    p22_cumBp: new Float64Array([bottom + 800]),
    queryGridAnchors: new Float64Array([0]),
    strands: new Int8Array([1]),
    parsedCigars: [cigar],
    starts: new Uint32Array([top]),
    ends: new Uint32Array([top + 800]),
    drawCIGAR: cigar.length > 0,
    drawCIGARMatchesOnly: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 800,
    window0,
    window1,
  })
  const kinds = [...g.kinds.subarray(0, g.instanceCount)]
  return {
    base: kinds.filter(k => k === KIND_BASE).length,
    markers: kinds.filter(k => k === KIND_MARKER).length,
    deletions: kinds.filter(k => k === KIND_CIGAR_D).length,
  }
}

const WINDOW = { lo: -3000, hi: 3800 }

// The emit window IS the fetch window, whatever its width: a pan that keeps
// the fetch key stays inside it, so detail emitted to its edge and no further
// is exactly what the frame can reach before a refetch.
test('detail is emitted out to the window edge and not past it', () => {
  expect(build({ top: 2900, window0: WINDOW }).markers).toBeGreaterThan(0)
  expect(build({ top: 3900, window0: WINDOW }).markers).toBe(0)
  expect(build({ top: -3900, window0: WINDOW }).markers).toBe(0)
})

// The base trapezoid is never culled: a mate the target row cannot reach
// before a refetch still needs an instance, since `culledRibbonMates` reads the
// marks it draws for such a feature off the instances, not the feature lanes.
test('the base ribbon survives a feature entirely outside both windows', () => {
  const r = build({ top: 9000, bottom: 9000, window0: WINDOW })
  expect(r.base).toBe(1)
  expect(r.markers).toBe(0)
})

// Per edge, as `isRibbonCulled` drops a ribbon at draw time: a CIGAR segment
// whose bottom edge is off the target row's window cannot draw before the key
// rolls, whichever row it is in view on.
test('a CIGAR segment is culled when either edge is outside its own window', () => {
  const cigar = [op(300, CIGAR_M), op(200, CIGAR_D), op(300, CIGAR_M)]
  expect(build({ top: 100, window0: WINDOW, cigar }).deletions).toBe(1)
  expect(
    build({ top: 100, bottom: 9000, window0: WINDOW, cigar }).deletions,
  ).toBe(0)
  expect(
    build({ top: 9000, bottom: 100, window0: WINDOW, cigar }).deletions,
  ).toBe(0)
})

// The two rows have their own windows: the target row can have panned
// further, or be clamped at its region's edge, and only ITS window says what
// its edge of a segment can reach.
test("each edge is tested against its own row's window", () => {
  const cigar = [op(300, CIGAR_M), op(200, CIGAR_D), op(300, CIGAR_M)]
  const window1 = { lo: 8000, hi: 12000 }
  expect(
    build({ top: 100, bottom: 9000, window0: WINDOW, window1, cigar })
      .deletions,
  ).toBe(1)
  expect(
    build({ top: 100, bottom: 100, window0: WINDOW, window1, cigar }).deletions,
  ).toBe(0)
})

// A tick spanning the band with NEITHER end inside a window, which is what an
// inversion wide enough to leave the frame on both sides produces: the top ends
// sit far left of the query window and the bottom ends far right of the
// target's. The hull rule keeps it — testing the two endpoints separately would
// drop every such tick while the ribbon under them stays.
//
// The tick is nonetheless not drawn: it travels a whole window, so the TRAVEL
// CAP drops it, which is what `hg002_haplotypes_location_markers` was denied
// for twice. That cap is not here, though, and the division is the point of
// this test. How far a tick travels is a function of how far the two views
// have panned APART, which changes without a refetch — so the worker cannot
// answer it, and both renderers ask it per frame instead (markerTravelsTooFar,
// pinned in syntenyRibbonCull.test.ts). What the worker culls is only what a
// pan cannot bring back without refetching.
test('the emit cull keeps a marker the travel cap will drop, and leaves that to the cull', () => {
  expect(
    build({ top: -3900, bottom: 3900, window0: WINDOW }).markers,
  ).toBeGreaterThan(0)
  expect(build({ top: 3900, bottom: 3900, window0: WINDOW }).markers).toBe(0)
})

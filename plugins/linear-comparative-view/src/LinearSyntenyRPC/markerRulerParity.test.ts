import { makeTicks } from '@jbrowse/plugin-linear-genome-view'

import { RULER_GRID_ORIGIN, markerGridPitch } from './buildSyntenyGeometry.ts'

// Location markers claim to be the query panel's ruler continued down through
// the ribbons. That claim has two halves — a pitch and a PHASE — and it is
// checked here against the ruler's own `makeTicks` rather than asserted in a
// comment, because the second half was wrong for as long as it was only a
// comment: the grid was anchored at genomic 0, which put every tick one base to
// the right of the gridline it was supposed to be continuing.
//
// One base is nothing at the zooms these views are usually read at, which is
// why it survived. At base-level zoom it is not: the ruler's pitch floors at
// 5bp, so at 0.02 bp/px one base is 50px of a 250px pitch.
//
// The sweep spans the range that matters — 0.02 bp/px is base-level, 5000 is
// whole-chromosome.
const ZOOMS = [0.02, 0.05, 0.1, 0.5, 1, 13, 500, 5000]
const WIDTH_PX = 1400

// Where the ruler draws its major gridlines, as 0-based coordinates. `base` is
// already in the frame the marker grid works in: the scalebar labels a tick
// `base + 1`, so a gridline sits on the LEFT EDGE of the base it names.
function rulerMajorBases(bpPerPx: number, end: number) {
  return makeTicks(0, end, bpPerPx, true, false)
    .map(t => t.base)
    .filter(base => base >= 0 && base < end)
}

// Where the markers go, from the two things buildSyntenyGeometry derives the
// grid from. In a forward region starting at genomic 0 the per-feature anchor
// IS the grid origin and cumBp is the genomic coordinate, so this is the same
// ladder `emitGridMarkers` walks.
function markerBases(bpPerPx: number, end: number) {
  const pitch = markerGridPitch(bpPerPx)
  const bases: number[] = []
  for (
    let n = Math.ceil(-RULER_GRID_ORIGIN / pitch);
    RULER_GRID_ORIGIN + n * pitch < end;
    n++
  ) {
    bases.push(RULER_GRID_ORIGIN + n * pitch)
  }
  return bases
}

test('every ruler gridline in view carries a marker', () => {
  for (const bpPerPx of ZOOMS) {
    const end = Math.ceil(WIDTH_PX * bpPerPx)
    const markers = new Set(markerBases(bpPerPx, end))
    const ruler = rulerMajorBases(bpPerPx, end)
    expect(ruler.length).toBeGreaterThan(0)
    for (const base of ruler) {
      expect(markers.has(base)).toBe(true)
    }
  }
})

// The other half of "the grid IS the ruler's": the extra ticks the halving adds
// are midpoints between neighbouring gridlines, not a second grid that happens
// to be finer. A phase error would show here too — as markers that are neither
// a gridline nor centred between two.
test('a marker is a gridline, or the midpoint between two', () => {
  for (const bpPerPx of ZOOMS) {
    const end = Math.ceil(WIDTH_PX * bpPerPx)
    const pitch = markerGridPitch(bpPerPx)
    // Both neighbours of an in-window midpoint have to be in the set, and the
    // ones bracketing the window's own edges sit outside it — so this set is
    // taken unfiltered and over a window widened past both ends.
    const ruler = new Set(
      makeTicks(0, end + 4 * pitch, bpPerPx, true, false).map(t => t.base),
    )
    for (const base of markerBases(bpPerPx, end)) {
      if (!ruler.has(base)) {
        expect(ruler.has(base - pitch) && ruler.has(base + pitch)).toBe(true)
      }
    }
  }
})

import { syntenyFetchRegions } from '@jbrowse/synteny-core'

import { Dotplot1DView } from './1dview.ts'

// 1000bp of content in a 500px view. At bpPerPx=4 the content is 250px — half
// the view — which is the regime the offset bounds used to special-case.
function setup(bpPerPx: number) {
  const view = Dotplot1DView.create({
    bpPerPx,
    offsetPx: 0,
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  view.setVolatileWidth(500)
  return view
}

// screen px of a genomic coordinate on this axis
function locusPx(view: ReturnType<typeof setup>, coord: number) {
  return coord / view.bpPerPx - view.offsetPx
}

test('offset bounds stay open when content is narrower than the view', () => {
  const view = setup(4)
  expect(view.displayedRegionsTotalPx).toBeLessThan(view.width)
  // a degenerate range here is what made zoomTo discard its anchor
  expect(view.minOffset).toBeLessThan(view.maxOffset)
})

test('center() still centers content narrower than the view', () => {
  const view = setup(4)
  view.center()
  expect(-view.offsetPx).toBe((view.width - view.displayedRegionsTotalPx) / 2)
})

test('zooming in holds an off-center locus under its anchor when zoomed out', () => {
  const view = setup(4)
  view.center()
  // anchor near the left edge of the view, well off-center
  const anchorPx = 140
  const coord = (anchorPx + view.offsetPx) * view.bpPerPx
  expect(locusPx(view, coord)).toBeCloseTo(anchorPx, 6)

  view.zoomTo(view.bpPerPx / 1.5, anchorPx)

  // the previous bounds pinned offsetPx to the new centered offset, landing the
  // locus at 85px — 55px from the cursor — on this very first step
  expect(Math.abs(locusPx(view, coord) - anchorPx)).toBeLessThan(2)
})

// Two 100kb regions on one axis — the second starting at 50000, so a block
// clamped against the wrong one lands somewhere else — with 500px of viewport
// scrolled to straddle the join, so both are partly on screen.
function setupTwoRegions() {
  const view = Dotplot1DView.create({
    bpPerPx: 1,
    offsetPx: 0,
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100000 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 50000, end: 150000 },
    ],
  })
  view.setVolatileWidth(500)
  view.scrollTo(99900)
  return view
}

test('visibleRegions names each block its own displayed region', () => {
  const view = setupTwoRegions()
  // the index is what the shared fetch window clamps against, so a block
  // carrying the wrong one silently truncates the other region's fetch
  expect(
    view.visibleRegions.map(r => [r.refName, r.displayedRegionIndex]),
  ).toEqual([
    ['ctgA', 0],
    ['ctgB', 1],
  ])
  expect(view.visibleRegions.every(r => r.assemblyName === 'volvox')).toBe(true)
})

test('a dotplot axis feeds the shared comparative fetch window directly', () => {
  const view = setupTwoRegions()
  // the display passes the axis itself (as a synteny row does) rather than
  // rebuilding this shape, so the fields have to line up here: each visible
  // block widened by the 2000bp pan buffer, snapped out to that grid, and
  // clamped to its OWN displayed region — ctgB's floor is its 50000 start, not
  // the 48000 the grid snapped to
  expect(syntenyFetchRegions(view)).toEqual([
    { refName: 'ctgA', assemblyName: 'volvox', start: 96000, end: 100000 },
    { refName: 'ctgB', assemblyName: 'volvox', start: 50000, end: 54000 },
  ])
})

test('anchored zoom stays stable across repeated steps', () => {
  const view = setup(4)
  view.center()
  const anchorPx = 140
  const coord = (anchorPx + view.offsetPx) * view.bpPerPx
  for (let i = 0; i < 6; i++) {
    view.zoomTo(view.bpPerPx / 1.1, anchorPx)
  }
  // zoomTo rounds offsetPx to whole px, so a few steps accumulate sub-px drift
  expect(Math.abs(locusPx(view, coord) - anchorPx)).toBeLessThan(2)
})

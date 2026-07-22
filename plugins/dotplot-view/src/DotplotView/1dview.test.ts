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

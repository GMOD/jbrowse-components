import { positionViewOnSpan } from './positionViewOnSpan.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The four members positionViewOnSpan touches, with a zoom limit it can be
// pushed past — which is the case worth pinning here.
function fakeView(minBpPerPx = 0) {
  const view = {
    width: 100,
    displayedRegions: [{ refName: 'ctgA', start: 0, end: 1000 }],
    bpPerPx: 1,
    offsetPx: 0,
    zoomTo(bpPerPx: number) {
      view.bpPerPx = Math.max(bpPerPx, minBpPerPx)
      return view.bpPerPx
    },
    scrollTo(offsetPx: number) {
      view.offsetPx = offsetPx
      return offsetPx
    },
  }
  return view
}

const place = (view: ReturnType<typeof fakeView>, start: number, end: number) =>
  positionViewOnSpan(view as unknown as LinearGenomeViewModel, {
    refName: 'ctgA',
    start,
    end,
  })

test('the span fills the row', () => {
  const view = fakeView()
  expect(place(view, 200, 400)).toBe(true)
  expect(view.bpPerPx).toBe(2)
  expect(view.offsetPx).toBe(100)
})

// A span narrower than the row can zoom to lands at a wider bpPerPx than asked
// for, and the leftover width has to be split either side of it. Scrolling to
// the span's own left edge instead put the row half a screen from where the
// exact pass — navToLocString, the same moveTo — puts it on the next settle.
test('a span past the zoom limit is centred rather than left-aligned', () => {
  const view = fakeView(5)
  expect(place(view, 200, 400)).toBe(true)
  expect(view.bpPerPx).toBe(5)
  // showing 50..550, whose centre is the span's; left-aligned it would be 40
  expect(view.offsetPx).toBe(10)
})

test('a span on a contig the row is not showing leaves it alone', () => {
  const view = fakeView()
  expect(
    positionViewOnSpan(view as unknown as LinearGenomeViewModel, {
      refName: 'ctgB',
      start: 200,
      end: 400,
    }),
  ).toBe(false)
  expect([view.bpPerPx, view.offsetPx]).toEqual([1, 0])
})

test('a span of no width leaves the row alone', () => {
  const view = fakeView()
  expect(place(view, 200, 200)).toBe(false)
  expect([view.bpPerPx, view.offsetPx]).toEqual([1, 0])
})

import { alreadyShowing } from './alreadyShowing.ts'

import type { FollowWindow } from './followAnchorWindow.ts'

const SPAN = { refName: 'ctgA', start: 10000, end: 11000 }

function shown(start: number, end: number, refName = 'ctgA'): FollowWindow {
  return { refName, start, end }
}

test('a row sitting on the resolved span is left alone', () => {
  expect(alreadyShowing(shown(10000, 11000), SPAN)).toBe(true)
})

test('a row a few bp off is left alone', () => {
  // navToLocString fits the span to the pane rather than landing on it exactly,
  // so the row never reports back the numbers it was given — without the slack
  // the follow would renavigate it forever, a few bp at a time
  expect(alreadyShowing(shown(10003, 10996), SPAN)).toBe(true)
})

test('a row nudged clear of the span is moved back', () => {
  expect(alreadyShowing(shown(14000, 15000), SPAN)).toBe(false)
})

test('the slack scales with the span, so a wide view is not renavigated on rounding', () => {
  const wide = { refName: 'ctgA', start: 0, end: 1_000_000 }
  expect(alreadyShowing(shown(5000, 1_005_000), wide)).toBe(true)
  expect(alreadyShowing(shown(100_000, 1_100_000), wide)).toBe(false)
})

test('a one-base span still has a base of slack rather than none', () => {
  // 2% of nothing is nothing, and an exact-equality test at this size renavigates
  // on the rounding that produced the span
  expect(alreadyShowing(shown(10000, 10001), { ...SPAN, end: 10001 })).toBe(
    true,
  )
})

test('a row showing another contig is moved whatever its coordinates say', () => {
  // the numbers can coincide across contigs; the refName is what decides
  expect(alreadyShowing(shown(10000, 11000, 'ctgB'), SPAN)).toBe(false)
})

test('a row with no settled window yet is moved', () => {
  expect(alreadyShowing(undefined, SPAN)).toBe(false)
})

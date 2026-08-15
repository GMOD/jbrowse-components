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

// The hang. A view asked for a span below its zoom floor centres and widens it,
// so the row reports back 16bp around a 1bp answer; on the numbers alone that is
// never "already there", and the follow renavigated to the same place on every
// wake — one core at 90%, indefinitely, on a swapped-assembly track whose CIGAR
// walk collapses to a point.
describe('a span narrower than the view can show', () => {
  const tiny = { refName: 'ctgA', start: 28498, end: 28499 }
  const FLOOR = 16

  test('is showing once the row has widened it', () => {
    expect(alreadyShowing(shown(28491, 28507), tiny, FLOOR)).toBe(true)
  })

  test('is not showing without the floor, which is the loop', () => {
    expect(alreadyShowing(shown(28491, 28507), tiny)).toBe(false)
  })

  test('is not showing when the row is parked somewhere else entirely', () => {
    // the whole-genome window a follow exists to correct is orders of magnitude
    // wider than the floor, so containment alone cannot swallow it
    expect(alreadyShowing(shown(0, 50000), tiny, FLOOR)).toBe(false)
    expect(alreadyShowing(shown(40000, 40016), tiny, FLOOR)).toBe(false)
  })

  test('near a contig end, where the widened window is not centred on it', () => {
    // navTo clamps to the displayed regions too, so the edges cannot be
    // arithmetic'd for — containment is what survives that
    expect(alreadyShowing(shown(28484, 28500), tiny, FLOOR)).toBe(true)
  })
})

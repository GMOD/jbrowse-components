import { fadesThinAt } from './fadeThin.ts'

// What `installAutoFadeLatch` does to a sequence of means: feed each one in and
// carry the latch forward, exactly as the autorun does over successive fetches.
function latchOver(meansPx: number[]) {
  let latch = false
  return meansPx.map(px => (latch = fadesThinAt(px, latch)))
}

// The reason the latch exists, measured rather than invented: peach_grape.paf
// panned across Pp01 in a 1000px view at 1.015 Mb — the zoom whose mean sits on
// the 1px threshold — reports these means at each of eleven fetch-window
// rollovers. A rollover swaps a pan buffer's worth of the population, which
// steps the mean by up to 11.3%, and here that walks it back and forth across
// 1px.
const PEACH_GRAPE_ROLLOVER_MEANS_PX = [
  0.992, 1.075, 1.129, 1.14, 1.056, 1.114, 1.005, 0.981, 1.071, 1.096, 1.037,
]

test('a real pan across the engage threshold does not flicker', () => {
  expect(latchOver(PEACH_GRAPE_ROLLOVER_MEANS_PX).every(Boolean)).toBe(true)
})

test('...and on one threshold the same pan would have flipped three times', () => {
  const unlatched = PEACH_GRAPE_ROLLOVER_MEANS_PX.map(px =>
    fadesThinAt(px, false),
  )
  const flips = unlatched.filter((on, i) => i > 0 && on !== unlatched[i - 1])
  expect(flips).toHaveLength(3)
})

test('a genuine zoom-in past the release width lets the fade go', () => {
  expect(latchOver([0.5, 1.5])).toEqual([true, false])
})

test('and it does not re-engage until the ribbons are thin again', () => {
  expect(latchOver([0.5, 3, 1.1, 0.9])).toEqual([true, false, false, true])
})

test('a sparse or wide view never engages it', () => {
  expect(latchOver([4, 9, 40])).toEqual([false, false, false])
})

test('a view with no display thin enough to judge never engages it', () => {
  expect(fadesThinAt(Number.POSITIVE_INFINITY, false)).toBe(false)
  expect(fadesThinAt(Number.POSITIVE_INFINITY, true)).toBe(false)
})

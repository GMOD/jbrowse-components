import { cappedMeanWidthPx, fadesThinAt } from './fadeThin.ts'

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

// hg38→hs1's chr1 query axis, to scale: 452 fragments at its 130 bp median
// beside 18 whole-arm chain blocks carrying the rest of its 615,963 bp mean. The
// plain mean of those widths is 2.48 px at whole-chromosome zoom in a 1000 px
// view, so an uncapped criterion calls a view whose blocks are 96% sub-pixel a
// wide one.
const CHR1_BP = 248387328
const BLOCKS = 470
const FRAGMENT_BP = 130
const FRAGMENTS = 452
const WIDE = BLOCKS - FRAGMENTS
const WIDE_BP = (615963 * BLOCKS - FRAGMENT_BP * FRAGMENTS) / WIDE

function chainLikeBlocks() {
  const starts = new Uint32Array(BLOCKS)
  const ends = new Uint32Array(BLOCKS)
  let at = 0
  for (let i = 0; i < BLOCKS; i++) {
    const span = Math.round(i < FRAGMENTS ? FRAGMENT_BP : WIDE_BP)
    starts[i] = at
    ends[i] = at + span
    at += span
  }
  return { starts, ends }
}

test('a handful of whole-arm blocks does not make a hairball read as wide', () => {
  const { starts, ends } = chainLikeBlocks()
  const bpPerPx = CHR1_BP / 1000

  const plainMean =
    starts.reduce((a, _, i) => a + (ends[i]! - starts[i]!), 0) /
    BLOCKS /
    bpPerPx
  expect(plainMean).toBeCloseTo(2.48, 2)
  expect(fadesThinAt(plainMean, false)).toBe(false)

  const capped = cappedMeanWidthPx(starts, ends, bpPerPx)
  expect(capped).toBeCloseTo(0.077, 3)
  expect(fadesThinAt(capped, false)).toBe(true)
})

test('the cap leaves a view of ordinary blocks alone', () => {
  // Every block under the cap, so capping is the identity: 1000 blocks of
  // 1200 bp at 1000 bp/px is a 1.2 px mean either way, and does not fade.
  const starts = new Uint32Array(1000)
  const ends = new Uint32Array(1000)
  for (let i = 0; i < 1000; i++) {
    starts[i] = i * 5000
    ends[i] = i * 5000 + 1200
  }
  expect(cappedMeanWidthPx(starts, ends, 1000)).toBeCloseTo(1.2, 6)
  expect(fadesThinAt(cappedMeanWidthPx(starts, ends, 1000), false)).toBe(false)
})

test('an empty display reports no width to judge by', () => {
  expect(cappedMeanWidthPx(new Uint32Array(0), new Uint32Array(0), 100)).toBe(0)
})

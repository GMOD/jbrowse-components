import { accumulateConservation } from './drawConservation.ts'
import { makeCellPxRange } from './visibleRegionGeometry.ts'

test('zoomed out: many bases average into one pixel', () => {
  const sum = new Float32Array(1)
  const count = new Uint32Array(1)
  // 4 bp per pixel; identity 1,0,1,0 → mean 0.5.
  accumulateConservation(
    sum,
    count,
    new Float32Array([1, 0, 1, 0]),
    0,
    makeCellPxRange(bp => bp / 4, 0, 1),
  )
  expect(count[0]).toBe(4)
  expect(sum[0]! / count[0]!).toBe(0.5)
})

test('zoomed in: one base fills every pixel of its span', () => {
  const sum = new Float32Array(10)
  const count = new Uint32Array(10)
  accumulateConservation(
    sum,
    count,
    new Float32Array([1]),
    0,
    makeCellPxRange(bp => bp * 10, 0, 10),
  )
  for (let x = 0; x < 10; x++) {
    expect(count[x]).toBe(1)
    expect(sum[x]).toBe(1)
  }
})

test('NaN positions are skipped', () => {
  const sum = new Float32Array(2)
  const count = new Uint32Array(2)
  accumulateConservation(
    sum,
    count,
    new Float32Array([Number.NaN, 1]),
    0,
    makeCellPxRange(bp => bp, 0, 2),
  )
  expect(count[0]).toBe(0)
  expect(count[1]).toBe(1)
  expect(sum[1]).toBe(1)
})

test('pixels outside the bound are clamped away', () => {
  const sum = new Float32Array(3)
  const count = new Uint32Array(3)
  // x = bp - 5, so only bp 5,6,7 land in [0,3).
  accumulateConservation(
    sum,
    count,
    new Float32Array(10).fill(1),
    0,
    makeCellPxRange(bp => bp - 5, 0, 3),
  )
  expect(Array.from(count)).toEqual([1, 1, 1])
})

// The bound is the *block's* scissor span, not the canvas: the fetched region
// is the buffered one, so it extends past its render block, and unbounded its
// bases would paint over whichever region occupies the neighboring columns.
test('bases outside the block scissor span do not bleed into neighbors', () => {
  const sum = new Float32Array(6)
  const count = new Uint32Array(6)
  // 6 bp at 1px each, but the owning block only holds columns [2, 4).
  accumulateConservation(
    sum,
    count,
    new Float32Array(6).fill(1),
    0,
    makeCellPxRange(bp => bp, 2, 4),
  )
  expect(Array.from(count)).toEqual([0, 0, 1, 1, 0, 0])
})

// [bpLo, bpHi) is the fast-path skip for the buffered region's off-block tail.
test('scores outside the bp bound are skipped', () => {
  const sum = new Float32Array(6)
  const count = new Uint32Array(6)
  accumulateConservation(
    sum,
    count,
    new Float32Array(6).fill(1),
    0,
    makeCellPxRange(bp => bp, 0, 6),
    2,
    4,
  )
  expect(Array.from(count)).toEqual([0, 0, 1, 1, 0, 0])
})

// The bound only has to be conservative — the per-position clamp is what
// decides. A bound wider than the block changes nothing.
test('a bp bound wider than the data is a no-op', () => {
  const sum = new Float32Array(3)
  const count = new Uint32Array(3)
  accumulateConservation(
    sum,
    count,
    new Float32Array(3).fill(1),
    0,
    makeCellPxRange(bp => bp, 0, 3),
    -100,
    100,
  )
  expect(Array.from(count)).toEqual([1, 1, 1])
})

// coverageStartPos offsets the array, so the bound is in genomic bp, not index.
test('the bp bound is genomic, offset by coverageStartPos', () => {
  const sum = new Float32Array(4)
  const count = new Uint32Array(4)
  accumulateConservation(
    sum,
    count,
    new Float32Array(4).fill(1),
    100,
    makeCellPxRange(bp => bp - 100, 0, 4),
    101,
    103,
  )
  expect(Array.from(count)).toEqual([0, 1, 1, 0])
})

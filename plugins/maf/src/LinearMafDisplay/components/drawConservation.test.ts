import { accumulateConservation } from './drawConservation.ts'

test('zoomed out: many bases average into one pixel', () => {
  const sum = new Float32Array(1)
  const count = new Uint32Array(1)
  // 4 bp per pixel; identity 1,0,1,0 → mean 0.5.
  accumulateConservation(
    sum,
    count,
    new Float32Array([1, 0, 1, 0]),
    0,
    bp => bp / 4,
    1,
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
    bp => bp * 10,
    10,
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
    bp => bp,
    2,
  )
  expect(count[0]).toBe(0)
  expect(count[1]).toBe(1)
  expect(sum[1]).toBe(1)
})

test('pixels outside [0, width) are clamped away', () => {
  const sum = new Float32Array(3)
  const count = new Uint32Array(3)
  // x = bp - 5, so only bp 5,6,7 land in [0,3).
  accumulateConservation(
    sum,
    count,
    new Float32Array(10).fill(1),
    0,
    bp => bp - 5,
    3,
  )
  expect(Array.from(count)).toEqual([1, 1, 1])
})

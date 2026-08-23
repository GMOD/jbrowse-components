import { buildColorRampLut, sampleColorRamp } from './colorRamp.ts'

import type { ColorRampStop } from './colorRamp.ts'

const BLACK_TO_WHITE: ColorRampStop[] = [
  [0, 0, 0, 255],
  [255, 255, 255, 255],
]

test('the end stops are the ends, exactly', () => {
  expect(sampleColorRamp(BLACK_TO_WHITE, 0)).toEqual([0, 0, 0, 255])
  expect(sampleColorRamp(BLACK_TO_WHITE, 1)).toEqual([255, 255, 255, 255])
})

test('stops are evenly spaced, whatever their values', () => {
  const stops: ColorRampStop[] = [
    [0, 0, 0, 0],
    [10, 20, 30, 40],
    [200, 200, 200, 200],
  ]
  expect(sampleColorRamp(stops, 0.5)).toEqual([10, 20, 30, 40])
  expect(sampleColorRamp(stops, 0.25)).toEqual([5, 10, 15, 20])
  expect(sampleColorRamp(stops, 0.75)).toEqual([105, 110, 115, 120])
})

// Alpha is a channel like any other: the hic juicebox scheme is two stops that
// differ ONLY in alpha, and a ramp that interpolated rgb alone would paint its
// whole fade at full opacity.
test('interpolates alpha with the color channels', () => {
  const fade: ColorRampStop[] = [
    [255, 0, 0, 0],
    [255, 0, 0, 255],
  ]
  expect(sampleColorRamp(fade, 0.5)).toEqual([255, 0, 0, 128])
})

test('a one-stop ramp is that stop everywhere', () => {
  expect(sampleColorRamp([[7, 8, 9, 10]], 0)).toEqual([7, 8, 9, 10])
  expect(sampleColorRamp([[7, 8, 9, 10]], 1)).toEqual([7, 8, 9, 10])
})

test('clamps rather than extrapolating past the ends', () => {
  expect(sampleColorRamp(BLACK_TO_WHITE, -1)).toEqual([0, 0, 0, 255])
  expect(sampleColorRamp(BLACK_TO_WHITE, 2)).toEqual([255, 255, 255, 255])
})

test('the lut is 256 RGBA entries at t = i / 255', () => {
  const lut = buildColorRampLut(BLACK_TO_WHITE)
  expect(lut).toHaveLength(256 * 4)
  expect([...lut.slice(0, 4)]).toEqual([0, 0, 0, 255])
  expect([...lut.slice(128 * 4, 128 * 4 + 4)]).toEqual([128, 128, 128, 255])
  expect([...lut.slice(255 * 4, 255 * 4 + 4)]).toEqual([255, 255, 255, 255])
})

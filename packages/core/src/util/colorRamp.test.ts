import { rampMidT } from '@jbrowse/render-core/shaders/colorRampLut'

import {
  buildColorRampLut,
  darkAtLowEnd,
  sampleColorRamp,
  stopsFromRampLut,
} from './colorRamp.ts'

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

// The one claim stopsFromRampLut owns: a legend swatch at bar fraction t is
// byte-identical to the LUT entry both backends color that t through — which,
// for a LUT built by buildColorRampLut, is sampleColorRamp at the entry's own
// i / 255.
test('stopsFromRampLut reads the entries sampleColorRamp defines, exactly', () => {
  const source: ColorRampStop[] = [
    [255, 0, 0, 0],
    [0, 128, 255, 255],
    [10, 20, 30, 64],
  ]
  const lut = buildColorRampLut(source)
  const n = 11
  const legend = stopsFromRampLut(lut, n)
  expect(legend).toHaveLength(n)
  legend.forEach((stop, i) => {
    const t = i / (n - 1)
    const entry = Math.round(t * 255)
    const [r, g, b, a] = sampleColorRamp(source, entry / 255)
    expect(stop).toEqual({
      offset: t,
      color: `rgb(${r},${g},${b})`,
      opacity: a / 255,
    })
  })
  expect(legend[0]!.offset).toBe(0)
  expect(legend.at(-1)!.offset).toBe(1)
})

// ggplot2's gradient2: the middle stop at `mid`, and both sides on one scale,
// so the farther end reaches its end stop, the nearer stops short of its own,
// and two values equally far from the middle take mirrored colours. Every
// reader of a straight table places a value through this one rule.
test('rampMidT puts the middle stop at mid, both sides on one scale', () => {
  expect(rampMidT(0.25, 0.25)).toBe(0.5)
  expect(rampMidT(1, 0.25)).toBe(1)
  expect(rampMidT(0, 0.25)).toBeCloseTo(1 / 3, 12)
  for (const d of [0.05, 0.1, 0.25]) {
    expect(rampMidT(0.25 - d, 0.25) + rampMidT(0.25 + d, 0.25)).toBeCloseTo(
      1,
      12,
    )
  }
  // exactly the identity with no middle declared, so such a ramp reads its
  // table as it always did
  for (const t of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
    expect(rampMidT(t, 0.5)).toBe(t)
  }
})

test('a ramp is dark at its low end when its first stop is darker over white', () => {
  expect(darkAtLowEnd('viridis')).toBe(true)
  expect(darkAtLowEnd('cividis')).toBe(true)
  expect(darkAtLowEnd('juicebox')).toBe(false)
  expect(darkAtLowEnd('fall')).toBe(false)
  expect(darkAtLowEnd('blues')).toBe(false)
})

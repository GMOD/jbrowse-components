import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
} from '../scoreScale.ts'
import { CLIP_STRIP_COLOR, CLIP_STRIP_PX } from './clipStrip.generated.ts'
import { clipSide } from './clipStrip.js.generated.ts'

// The twin every Canvas2D painter reads: which edge of the axis cut a bar. A
// log scale has no bottom to cut, since a value under its floor is a bar of no
// height on the baseline.
test('clipSide names the cut edge, and a log scale has no bottom', () => {
  for (const scaleType of [SCALE_TYPE_LINEAR, SCALE_TYPE_SYMLOG]) {
    expect(clipSide(12, 0, 10, scaleType)).toBe(1)
    expect(clipSide(10, 0, 10, scaleType)).toBe(0)
    expect(clipSide(5, 0, 10, scaleType)).toBe(0)
    expect(clipSide(0, 0, 10, scaleType)).toBe(0)
    expect(clipSide(-3, 0, 10, scaleType)).toBe(-1)
  }
  expect(clipSide(200, 1, 100, SCALE_TYPE_LOG)).toBe(1)
  expect(clipSide(0.5, 1, 100, SCALE_TYPE_LOG)).toBe(0)
})

// A depth rebuilt from float32 relDepth lands a few ulps off the quantile it
// equals, on one backend and not the other.
test('a value one float32 rounding past the domain is not cut', () => {
  const max = 37
  const rebuilt = Math.fround(max / 775) * 775
  expect(rebuilt).not.toBe(max)
  expect(clipSide(rebuilt, 0, max, SCALE_TYPE_LINEAR)).toBe(0)
  expect(clipSide(max * 1.001, 0, max, SCALE_TYPE_LINEAR)).toBe(1)
})

test('the strip is 2 px of #c62828', () => {
  expect(CLIP_STRIP_PX).toBe(2)
  expect(
    [0, 8, 16, 24].map(shift => (CLIP_STRIP_COLOR >>> shift) & 0xff),
  ).toEqual([0xc6, 0x28, 0x28, 0xff])
})

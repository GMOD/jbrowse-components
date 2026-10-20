import { rampMidNorm, scaleTypeCode } from '../scoreScale.ts'
import { rampMidT } from '../shaders/colorRampLut.js.generated.ts'
import {
  RAMP_LINE_BANDS,
  rampAsThreshold,
  thresholdBandOf,
} from './markRamp.ts'

import type { MarkRamp } from './types.ts'

// A gray ramp, so a color names its LUT entry: entry i is gray level i.
const lut = Uint8Array.from({ length: 256 * 4 }, (_, i) =>
  i % 4 === 3 ? 255 : Math.floor(i / 4),
)
const level = (abgr: number) => abgr & 0xff

const RAMPS: [string, MarkRamp][] = [
  ['linear', { domain: [0, 100], scale: 'linear', lut }],
  ['log', { domain: [1, 1000], scale: 'log', lut }],
  ['middle off-center', { domain: [0, 100], scale: 'linear', lut, mid: 20 }],
]

test.each(RAMPS)(
  '%s: each value strokes in the LUT entry at its band middle',
  (_, ramp) => {
    const [min, max] = ramp.domain
    const t = rampAsThreshold(ramp, min, max)
    expect(t.cuts).toHaveLength(RAMP_LINE_BANDS - 1)
    expect(t.colors).toHaveLength(RAMP_LINE_BANDS)
    const mid = rampMidNorm(min, max, scaleTypeCode(ramp.scale), ramp.mid)
    expect(Array.from(t.colors, level)).toEqual(
      Array.from({ length: RAMP_LINE_BANDS }, (_, k) =>
        Math.round(rampMidT((k + 0.5) / RAMP_LINE_BANDS, mid) * 255),
      ),
    )
    for (const [k, cut] of t.cuts.entries()) {
      expect(thresholdBandOf(Math.fround(cut), t.cuts)).toBe(k + 1)
    }
  },
)

test('only the bands the values reach are kept', () => {
  const t = rampAsThreshold({ domain: [0, 100], scale: 'linear', lut }, 40, 60)
  // 40 and 60 fall in bands 12 and 19
  expect(t.colors).toHaveLength(8)
  expect(t.cuts).toHaveLength(7)
})

test('a domain with no range is the step the normalizer takes', () => {
  const t = rampAsThreshold({ domain: [5, 5], scale: 'linear', lut }, 5, 6)
  expect(level(t.colors[thresholdBandOf(5, t.cuts)]!)).toBe(0)
  expect(level(t.colors[thresholdBandOf(6, t.cuts)]!)).toBe(255)
})

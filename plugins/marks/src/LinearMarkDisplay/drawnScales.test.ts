import { drawnScales } from './drawnScales.ts'

import type { StoredLayer } from './markList.ts'

// Section 0 holds one outlier among twenty values; section 1 holds the rest.
function layer(scale: 'linear' | 'log', quantile?: number): StoredLayer {
  const values = [
    ...Array.from({ length: 19 }, (_, i) => i + 1),
    1000,
    0,
    ...Array.from({ length: 20 }, (_, i) => i + 1),
  ]
  const count = values.length
  return {
    count,
    skipped: 0,
    x: new Uint32Array(count),
    x2: new Uint32Array(count),
    yMin: Number.NaN,
    yMax: Number.NaN,
    row: Uint32Array.from(values.map((_, i) => (i < 21 ? 0 : 1))),
    colorValue: Float32Array.from(values),
    scale: {
      kind: 'ramp',
      field: 'score',
      scale,
      domain: [1, 1000],
      pinned: [false, false],
      extent: [1, 1000],
      ...(quantile === undefined ? {} : { quantile }),
      lut: new Uint8Array(256 * 4),
    },
  } as unknown as StoredLayer
}

function extentOf(drawn: StoredLayer) {
  return drawn.scale?.kind === 'ramp' ? drawn.scale.extent : undefined
}

const bothSections = Uint8Array.of(1, 1)

test('a clipped ramp re-measured over the drawn instances clips them alike', () => {
  const [lo, hi] = extentOf(drawnScales(layer('linear', 0.9), bothSections))!
  expect(hi).toBeLessThan(1000)
  expect(lo).toBeGreaterThanOrEqual(0)
})

test('a log ramp re-measured over the drawn instances reads the positive ones', () => {
  expect(extentOf(drawnScales(layer('log'), bothSections))).toEqual([1, 1000])
})

test('an unclipped linear ramp keeps the drawn extremes', () => {
  expect(extentOf(drawnScales(layer('linear'), Uint8Array.of(0, 1)))).toEqual([
    1, 20,
  ])
})

import { payloadServesZoom } from './regionCommit.ts'

test('a payload with no zoom range answers at every zoom', () => {
  expect(payloadServesZoom({ layers: [] }, 1)).toBe(true)
  expect(payloadServesZoom({ zoomRange: undefined }, 1e9)).toBe(true)
  expect(payloadServesZoom('empty', 12)).toBe(true)
})

test('a payload with a zoom range answers inside it, half open at the top', () => {
  const payload = { zoomRange: { minBpPerPx: 10, maxBpPerPx: 40 } }
  expect(payloadServesZoom(payload, 9.99)).toBe(false)
  expect(payloadServesZoom(payload, 10)).toBe(true)
  expect(payloadServesZoom(payload, 39.99)).toBe(true)
  expect(payloadServesZoom(payload, 40)).toBe(false)
  expect(
    payloadServesZoom(
      { zoomRange: { minBpPerPx: 10, maxBpPerPx: Infinity } },
      1e12,
    ),
  ).toBe(true)
})

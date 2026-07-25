import { connectorLineAlpha } from './connectorLineAlpha.ts'

test('a sparse field keeps the full fixed alpha', () => {
  // fewer lines than pixels: nothing stacks, so nothing needs fading
  expect(connectorLineAlpha(50, 1500)).toBe(0.4)
  expect(connectorLineAlpha(1, 1500)).toBe(0.4)
})

test('alpha falls as the lines stack deeper', () => {
  const sparse = connectorLineAlpha(1000, 1500)
  const dense = connectorLineAlpha(13000, 1500)
  const denser = connectorLineAlpha(50000, 1500)
  expect(dense).toBeLessThan(sparse)
  expect(denser).toBeLessThan(dense)
})

test('composite over the stack depth stays roughly constant', () => {
  const composite = (count: number, span: number) =>
    1 - (1 - connectorLineAlpha(count, span)) ** (count / span)
  // the whole point: an HPRC-scale column count lands at the same readable
  // density as a merely busy one, instead of saturating
  expect(composite(13000, 1500)).toBeCloseTo(0.55, 2)
  expect(composite(50000, 1500)).toBeCloseTo(0.55, 2)
})

test('a zero-width span does not produce a transparent or NaN alpha', () => {
  // every line collapsed to one x (a single-column matrix mid-resize)
  expect(connectorLineAlpha(10, 0)).toBeGreaterThan(0)
  expect(connectorLineAlpha(10, 0)).toBeLessThanOrEqual(0.4)
})

test('no lines falls back to the fixed alpha', () => {
  expect(connectorLineAlpha(0, 1500)).toBe(0.4)
})

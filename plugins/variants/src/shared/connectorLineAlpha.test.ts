import { connectorLineAlpha } from './connectorLineAlpha.ts'

// the width the ink budget was calibrated at (the matrix connector field)
const W = 0.5

test('a sparse field keeps the full fixed alpha', () => {
  // well under the ink budget: nothing stacks, so nothing needs fading
  expect(connectorLineAlpha(50, 1500, W)).toBe(0.4)
  expect(connectorLineAlpha(1, 1500, W)).toBe(0.4)
})

test('alpha falls as the lines pack denser', () => {
  const busy = connectorLineAlpha(1000, 1500, W)
  const dense = connectorLineAlpha(13000, 1500, W)
  const denser = connectorLineAlpha(50000, 1500, W)
  expect(busy).toBeLessThan(0.4)
  expect(dense).toBeLessThan(busy)
  expect(denser).toBeLessThan(dense)
})

test('total ink is held constant once past the clamp', () => {
  const ink = (count: number, span: number) =>
    connectorLineAlpha(count, span, W) * (count / span)
  // the whole point: quadrupling the column count does not quadruple the
  // field's darkness
  expect(ink(13000, 1500)).toBeCloseTo(ink(50000, 1500), 6)
})

test('the same density gives the same alpha at any scale', () => {
  expect(connectorLineAlpha(13000, 1500, W)).toBeCloseTo(
    connectorLineAlpha(26000, 3000, W),
    6,
  )
})

test('a thicker stroke spends its ink budget on fewer lines', () => {
  // LD draws 1px lines, the matrix 0.5px; equal density has to mean equal
  // darkness, or the same field reads twice as heavy in one display
  expect(connectorLineAlpha(13000, 1500, 2 * W)).toBeCloseTo(
    connectorLineAlpha(26000, 1500, W),
    6,
  )
})

test('a zero-width span does not produce a transparent or NaN alpha', () => {
  // every line collapsed to one x (a single-column matrix mid-resize)
  expect(connectorLineAlpha(10, 0, W)).toBeGreaterThan(0)
  expect(connectorLineAlpha(10, 0, W)).toBeLessThanOrEqual(0.4)
})

test('no lines falls back to the fixed alpha', () => {
  expect(connectorLineAlpha(0, 1500, W)).toBe(0.4)
})

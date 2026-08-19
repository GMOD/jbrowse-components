import { compareDrawOrder, drawTier } from './syntenyDrawOrder.ts'

import type { DrawOrderKey } from './syntenyDrawOrder.ts'

function key(id: string, px: number, rest: Partial<DrawOrderKey> = {}) {
  return {
    id,
    px,
    tier: drawTier(px),
    refName: 'chr1',
    start: 0,
    mateRefName: 'chr1',
    mateStart: 0,
    ...rest,
  }
}

function order(...keys: DrawOrderKey[]) {
  return [...keys].sort(compareDrawOrder).map(k => k.id)
}

test('a small ribbon paints after a large one, so it is what the hover hits', () => {
  // The pick engine walks instance order backwards, so last is topmost.
  expect(order(key('small', 20), key('large', 900))).toEqual(['large', 'small'])
})

test('sub-pixel ribbons stay at the bottom, under every pickable one', () => {
  const sorted = order(key('big', 900), key('noise', 0.2), key('mid', 5))
  expect(sorted).toEqual(['noise', 'big', 'mid'])
})

test('the sub-pixel tier keeps its own small→large order', () => {
  expect(order(key('b', 0.9), key('a', 0.1))).toEqual(['a', 'b'])
})

test('the tier boundary is 1px', () => {
  expect(drawTier(0.999)).toBe(0)
  expect(drawTier(1)).toBe(1)
})

test('equal-size ribbons break ties on position, not on arrival order', () => {
  const later = key('x', 100, { start: 50 })
  const earlier = key('y', 100, { start: 10 })
  expect(order(later, earlier)).toEqual(['y', 'x'])
  expect(order(earlier, later)).toEqual(['y', 'x'])
})

test('a total order: identical keys but distinct ids still sort deterministically', () => {
  expect(order(key('b', 100), key('a', 100))).toEqual(['a', 'b'])
})

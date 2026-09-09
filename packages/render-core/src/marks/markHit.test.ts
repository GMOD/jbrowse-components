import { inkAtPoint, inkOnRect, nearestInk } from './markHit.ts'

test('a cursor inside a rect is on the ink, at distance 0', () => {
  expect(inkOnRect(15, 25, 10, 20, 10, 10)).toEqual({
    x: 15,
    y: 25,
    distSq: 0,
  })
})

test('a cursor outside a rect measures to the nearest edge, corners included', () => {
  expect(inkOnRect(25, 25, 10, 20, 10, 10)).toEqual({
    x: 20,
    y: 25,
    distSq: 25,
  })
  expect(inkOnRect(23, 34, 10, 20, 10, 10)).toEqual({
    x: 20,
    y: 30,
    distSq: 25,
  })
})

test('a point mark has no extent to clamp into', () => {
  expect(inkAtPoint(10, 10, 13, 14)).toEqual({ x: 13, y: 14, distSq: 25 })
})

const RECTS = [
  { left: 0, top: 0, width: 20, height: 20 },
  { left: 10, top: 0, width: 20, height: 20 },
]

const at = (xPx: number, yPx: number) => (i: number) => {
  const r = RECTS[i]!
  return inkOnRect(xPx, yPx, r.left, r.top, r.width, r.height)
}

test('the nearest candidate wins, and none does past the bound', () => {
  expect(nearestInk([0, 1], Infinity, at(25, 10))?.index).toBe(1)
  expect(nearestInk([0, 1], Infinity, at(5, 10))?.index).toBe(0)
  expect(nearestInk([0, 1], 4, at(40, 10))).toBeUndefined()
})

// The rule the shapes' callers lean on: multi-row hands its row buckets back to
// front, so the mark on top is the one that answers.
test('on a tie the FIRST candidate wins, so a back-to-front walk answers with the top mark', () => {
  expect(nearestInk([0, 1], Infinity, at(15, 10))?.index).toBe(0)
  expect(nearestInk([1, 0], Infinity, at(15, 10))?.index).toBe(1)
})

test('an instance with no ink is skipped rather than measured', () => {
  expect(
    nearestInk([0, 1], Infinity, i => (i === 0 ? undefined : at(15, 10)(i)))
      ?.index,
  ).toBe(1)
})

import { MAX_ATTACHED_LANES, assignAttachedLanes } from './attachedLanes.ts'

test('disjoint domains share one lane', () => {
  expect(
    assignAttachedLanes([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ]),
  ).toEqual({ lanes: [0, 0], laneCount: 1 })
})

test('a domain nested in another takes the next lane', () => {
  expect(
    assignAttachedLanes([
      { start: 5, end: 8 },
      { start: 0, end: 20 },
    ]),
  ).toEqual({ lanes: [1, 0], laneCount: 2 })
})

test('lanes past the cap share the last one', () => {
  const spans = Array.from({ length: MAX_ATTACHED_LANES + 2 }, () => ({
    start: 0,
    end: 10,
  }))
  const { lanes, laneCount } = assignAttachedLanes(spans)
  expect(laneCount).toBe(MAX_ATTACHED_LANES)
  expect(Math.max(...lanes)).toBe(MAX_ATTACHED_LANES - 1)
})

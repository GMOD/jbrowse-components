import { MAX_DOMAIN_LANES, assignDomainLanes } from './domainLanes.ts'

test('disjoint domains share one lane', () => {
  expect(
    assignDomainLanes([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ]),
  ).toEqual({ lanes: [0, 0], laneCount: 1 })
})

test('a domain nested in another takes the next lane', () => {
  expect(
    assignDomainLanes([
      { start: 5, end: 8 },
      { start: 0, end: 20 },
    ]),
  ).toEqual({ lanes: [1, 0], laneCount: 2 })
})

test('lanes past the cap share the last one', () => {
  const spans = Array.from({ length: MAX_DOMAIN_LANES + 2 }, () => ({
    start: 0,
    end: 10,
  }))
  const { lanes, laneCount } = assignDomainLanes(spans)
  expect(laneCount).toBe(MAX_DOMAIN_LANES)
  expect(Math.max(...lanes)).toBe(MAX_DOMAIN_LANES - 1)
})

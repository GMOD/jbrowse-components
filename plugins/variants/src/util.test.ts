import { pointToSegmentDist } from './util.ts'

test('distance to a point lying on the segment is 0', () => {
  // midpoint of segment (0,0)->(10,0)
  expect(pointToSegmentDist(5, 0, 0, 0, 10, 0)).toBe(0)
})

test('perpendicular distance to the interior of a segment', () => {
  // point straight above the middle of a horizontal segment
  expect(pointToSegmentDist(5, 3, 0, 0, 10, 0)).toBeCloseTo(3)
})

test('clamps past an endpoint (distance to nearest endpoint, not the line)', () => {
  // point is left of x1; nearest point is the (0,0) endpoint, not a
  // perpendicular foot on the infinite line
  expect(pointToSegmentDist(-4, 3, 0, 0, 10, 0)).toBeCloseTo(5)
})

test('degenerate zero-length segment falls back to point distance', () => {
  expect(pointToSegmentDist(3, 4, 0, 0, 0, 0)).toBeCloseTo(5)
})

test('distance to a diagonal segment', () => {
  // segment (0,0)->(10,10); point (10,0) has perpendicular distance
  // 10/sqrt(2) to the y=x line, and the foot (5,5) lies within the segment
  expect(pointToSegmentDist(10, 0, 0, 0, 10, 10)).toBeCloseTo(10 / Math.SQRT2)
})

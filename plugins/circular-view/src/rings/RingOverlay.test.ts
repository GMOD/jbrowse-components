import { middleLineArcPath } from './RingOverlay.tsx'

function arcRadius(d: string) {
  return Number(/A ([\d.]+) /.exec(d)?.[1])
}

const arc = { radians: 1, turn: 0.2, radiusPx: 100 }

test('an upright line runs on an arc inside its radius, since it rises outward', () => {
  expect(arcRadius(middleLineArcPath(arc, false, 10))).toBeCloseTo(97.2, 6)
})

test('a flipped line runs on an arc outside its radius, since it rises inward', () => {
  expect(arcRadius(middleLineArcPath(arc, true, 10))).toBeCloseTo(102.8, 6)
})

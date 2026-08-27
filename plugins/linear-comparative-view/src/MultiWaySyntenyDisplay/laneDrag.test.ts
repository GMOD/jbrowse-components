import { dropRowAt, moveLaneTo } from './laneDrag.ts'

import type { Lane } from './laneStack.ts'

const lanes = [
  { bandStart: 0, bandEnd: 50 },
  { bandStart: 50, bandEnd: 100 },
  { bandStart: 100, bandEnd: 150 },
] as Lane[]

test('a y lands on the band that holds it, and nowhere past the stack', () => {
  expect(dropRowAt(lanes, 10)).toBe(0)
  expect(dropRowAt(lanes, 50)).toBe(1)
  expect(dropRowAt(lanes, 149)).toBe(2)
  expect(dropRowAt(lanes, 150)).toBeUndefined()
  expect(dropRowAt(lanes, -1)).toBeUndefined()
})

test('a lane moves to the row dropped on, and a drop on the anchor puts it first', () => {
  expect(moveLaneTo(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
  expect(moveLaneTo(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
  expect(moveLaneTo(['a', 'b', 'c'], 'c', -1)).toEqual(['c', 'a', 'b'])
  expect(moveLaneTo(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c'])
  expect(moveLaneTo(['a', 'b'], 'nobody', 0)).toEqual(['a', 'b'])
})

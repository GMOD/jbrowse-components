import {
  DRAG_SLOP_PX,
  dropRowAt,
  laneOrderAfterDrop,
  pastDragSlop,
  sameLaneOrder,
  sortAfterDrop,
} from './laneDrag.ts'

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

const stack = ['anchor', 'a', 'b', 'c']
const drop = (name: string, row: number | undefined, order = stack) =>
  laneOrderAfterDrop(order, name, row, 'anchor')

test('a drop that leaves the lanes where they are writes nothing', () => {
  expect(drop('b', 2)).toBeUndefined()
  expect(drop('a', 1)).toBeUndefined()
  expect(drop('b', undefined)).toBeUndefined()
  expect(drop('nobody', 2)).toBeUndefined()
})

test('a drop on another row writes the moved order', () => {
  expect(drop('a', 3)).toEqual(['anchor', 'b', 'c', 'a'])
  expect(drop('c', 1)).toEqual(['anchor', 'c', 'a', 'b'])
})

test("a lane dropped on the anchor's band lands beside it on its own side", () => {
  expect(drop('c', 0)).toEqual(['anchor', 'c', 'a', 'b'])
  expect(drop('a', 0)).toBeUndefined()
  const middle = ['a', 'b', 'anchor', 'c']
  expect(drop('a', 2, middle)).toEqual(['b', 'a', 'anchor', 'c'])
  expect(drop('c', 2, middle)).toBeUndefined()
})

test('a drag of the anchor moves it between the lanes', () => {
  expect(drop('anchor', 1)).toEqual(['a', 'anchor', 'b', 'c'])
  expect(drop('anchor', 2, ['a', 'anchor', 'b'])).toEqual(['a', 'b', 'anchor'])
})

test('the sort a drop writes names the anchor only where it moved down', () => {
  const keyOf = (name: string) => name
  expect(sortAfterDrop([], ['anchor', 'b', 'a'], 'anchor', keyOf)).toEqual([
    'b',
    'a',
  ])
  expect(sortAfterDrop([], ['b', 'anchor', 'a'], 'anchor', keyOf)).toEqual([
    'b',
    'anchor',
    'a',
  ])
  expect(
    sortAfterDrop(['b', 'anchor'], ['anchor', 'b'], 'anchor', keyOf),
  ).toEqual(['anchor', 'b'])
})

test('two orders are the same only elementwise', () => {
  expect(sameLaneOrder(['a', 'b'], ['a', 'b'])).toBe(true)
  expect(sameLaneOrder(['a', 'b'], ['b', 'a'])).toBe(false)
  expect(sameLaneOrder(['a', 'b'], ['a', 'b', 'c'])).toBe(false)
  expect(sameLaneOrder([], [])).toBe(true)
})

test('a press arms the drag only once it has travelled', () => {
  expect(pastDragSlop(10, 10)).toBe(false)
  expect(pastDragSlop(10, 10 + DRAG_SLOP_PX - 1)).toBe(false)
  expect(pastDragSlop(10, 10 + DRAG_SLOP_PX)).toBe(true)
  expect(pastDragSlop(10, 10 - DRAG_SLOP_PX)).toBe(true)
})

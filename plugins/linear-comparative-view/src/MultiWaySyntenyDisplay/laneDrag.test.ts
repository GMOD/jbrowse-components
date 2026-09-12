import {
  DRAG_SLOP_PX,
  dropMarkAt,
  dropRowAt,
  laneOrderAfterDrop,
  moveLaneTo,
  pastDragSlop,
  sameLaneOrder,
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

test('a lane moves to the row dropped on, and a drop on the anchor puts it first', () => {
  expect(moveLaneTo(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
  expect(moveLaneTo(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
  expect(moveLaneTo(['a', 'b', 'c'], 'c', -1)).toEqual(['c', 'a', 'b'])
  expect(moveLaneTo(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c'])
  expect(moveLaneTo(['a', 'b'], 'nobody', 0)).toEqual(['a', 'b'])
})

// A plain click on a label is a press and a release on the lane's own row, and
// the drop it makes moves nothing. Writing the order anyway pinned every lane,
// stopped the densest-first sort, dirtied the session and rebuilt every cell
test('a drop that leaves the lanes where they are writes nothing', () => {
  expect(laneOrderAfterDrop(['a', 'b', 'c'], 'b', 2)).toBeUndefined()
  expect(laneOrderAfterDrop(['a', 'b', 'c'], 'a', 1)).toBeUndefined()
  expect(laneOrderAfterDrop(['a', 'b', 'c'], 'a', 0)).toBeUndefined()
  expect(laneOrderAfterDrop(['a', 'b', 'c'], 'b', undefined)).toBeUndefined()
  expect(laneOrderAfterDrop(['a', 'b', 'c'], 'nobody', 2)).toBeUndefined()
})

test('a drop on another row writes the moved order', () => {
  expect(laneOrderAfterDrop(['a', 'b', 'c'], 'a', 3)).toEqual(['b', 'c', 'a'])
  expect(laneOrderAfterDrop(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
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

// The bar marks where the lane will land. Always drawn on the top edge, it
// told a downward drag the lane would go above the lane it lands below
test('the drop bar marks the edge the moved lane lands on', () => {
  const stack = ['anchor', 'a', 'b', 'c'].map(assemblyName => ({
    assemblyName,
  })) as Lane[]
  expect(dropMarkAt(stack, 'a', 3)).toEqual({ lane: stack[3], edge: 'bottom' })
  expect(dropMarkAt(stack, 'a', 2)).toEqual({ lane: stack[2], edge: 'bottom' })
  expect(laneOrderAfterDrop(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'a', 'c'])
  expect(dropMarkAt(stack, 'c', 1)).toEqual({ lane: stack[1], edge: 'top' })
  expect(dropMarkAt(stack, 'c', 0)).toEqual({ lane: stack[1], edge: 'top' })
})

test('a drop that moves nothing, or lands nowhere, marks nothing', () => {
  const stack = ['anchor', 'a', 'b'].map(assemblyName => ({
    assemblyName,
  })) as Lane[]
  expect(dropMarkAt(stack, 'b', 2)).toBeUndefined()
  expect(dropMarkAt(stack, 'a', 0)).toBeUndefined()
  expect(dropMarkAt(stack, 'a', undefined)).toBeUndefined()
})

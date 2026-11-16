import { groupChipTops } from './groupLabelStyle.ts'

const stack = (n: number, height: number) =>
  Array.from({ length: n }, (_, i) => ({ top: i * height, height }))

const stackOf = (heights: number[]) => {
  let top = 0
  return heights.map(height => {
    const section = { top, height }
    top += height
    return section
  })
}

test('every section at least a chip tall gets its chip at its top', () => {
  expect(groupChipTops(stack(3, 100), 300)).toEqual([0, 100, 200])
})

// 40 lanes in 250 px are 6 px each: a chip per lane would stack 16 px chips
// over each other, so a lane gets one only a chip's height below the last
test('sections shorter than a chip label every few, from the topmost', () => {
  const tops = groupChipTops(stack(40, 6), 250)
  expect(tops.slice(0, 7)).toEqual([
    0,
    undefined,
    undefined,
    18,
    undefined,
    undefined,
    36,
  ])
  const drawn = tops.filter(t => t !== undefined)
  expect(drawn).toHaveLength(14)
  for (let i = 1; i < drawn.length; i++) {
    expect(drawn[i]! - drawn[i - 1]!).toBeGreaterThanOrEqual(16)
  }
})

// A facet with few rows beside facets with many: one short section must not
// take the chips off the tall ones, and a 0 px one must not take its
// neighbour's
test('a short or empty section leaves the tall sections their chips', () => {
  expect(groupChipTops(stackOf([200, 5, 200, 200]), 700)).toEqual([
    0,
    undefined,
    205,
    405,
  ])
  expect(groupChipTops(stackOf([200, 0, 200, 0, 0, 30]), 700)).toEqual([
    0,
    undefined,
    200,
    undefined,
    undefined,
    400,
  ])
})

test('the topmost keeps its chip however short the stack', () => {
  expect(groupChipTops(stack(2, 5), 250)).toEqual([0, undefined])
  expect(groupChipTops(stack(3, 0), 250)).toEqual([0, undefined, undefined])
})

test('counts from the topmost section on screen', () => {
  const scrolled = stack(10, 8).map(s => ({ ...s, top: s.top - 20 }))
  expect(groupChipTops(scrolled, 250)).toEqual([
    undefined,
    undefined,
    -4,
    undefined,
    12,
    undefined,
    28,
    undefined,
    44,
    undefined,
  ])
})

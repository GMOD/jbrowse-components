import { groupChipTops } from './groupLabelStyle.ts'

const stack = (n: number, height: number) =>
  Array.from({ length: n }, (_, i) => ({ top: i * height, height }))

test('every section at least a chip tall gets its chip at its top', () => {
  expect(groupChipTops(stack(3, 100), 300)).toEqual([0, 100, 200])
})

// 40 lanes in 250 px are 6 px each: a chip per lane would stack 16 px chips
// over each other, so every third lane carries one, spanning the three
// sections it stands for, the topmost first
test('sections shorter than a chip label every nth, from the topmost', () => {
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
  expect(drawn).toHaveLength(13)
  for (let i = 1; i < drawn.length; i++) {
    expect(drawn[i]! - drawn[i - 1]!).toBeGreaterThanOrEqual(16)
  }
})

test('a last run too short for a chip falls under the chip above', () => {
  expect(groupChipTops(stack(4, 6), 250)).toEqual([
    0,
    undefined,
    undefined,
    undefined,
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

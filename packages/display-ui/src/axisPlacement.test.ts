import {
  axisGutterLeft,
  axisGutterWidth,
  leftAxisGutterWidth,
  numbersGrowRight,
  rightAxisStackInsets,
} from './axisPlacement.ts'
import { AXIS_GUTTER_WIDTH_PX } from './yScaleTicks.ts'

import type { AxisSide } from './valueScale.ts'

const ticks = { items: [], yTop: 0, yBottom: 40 }

function axis(side: AxisSide, bandTops: number[], height = 40) {
  return { side, bandTops, height, ticks }
}

test('a right-side axis on the rows of an earlier one stands left of its gutter', () => {
  expect(
    rightAxisStackInsets([axis('right', [0, 60]), axis('right', [0, 60])]),
  ).toEqual([0, AXIS_GUTTER_WIDTH_PX])
})

test('a third axis on the same rows stands left of both', () => {
  expect(
    rightAxisStackInsets([
      axis('right', [0]),
      axis('right', [10]),
      axis('right', [20]),
    ]),
  ).toEqual([0, AXIS_GUTTER_WIDTH_PX, 2 * AXIS_GUTTER_WIDTH_PX])
})

test('right-side axes on different rows share the edge', () => {
  expect(
    rightAxisStackInsets([axis('right', [0]), axis('right', [40])]),
  ).toEqual([0, 0])
})

test('left-side and captioned axes take no room on the right', () => {
  expect(
    rightAxisStackInsets([
      axis('left', [0]),
      axis('right', [0], 20),
      axis('right', [0]),
    ]),
  ).toEqual([0, 0, 0])
})

test('every axis grows its numbers right on screen, and an exported left-side axis grows them left', () => {
  for (const side of ['left', 'right'] as const) {
    expect(numbersGrowRight({ side })).toBe(true)
  }
  expect(numbersGrowRight({ side: 'left' }, true)).toBe(false)
  expect(numbersGrowRight({ side: 'right' }, true)).toBe(true)
})

const wideTicks = {
  items: [
    { value: 0, y: 40 },
    { value: 1_000_000, y: 0, label: '1,000,000' },
  ],
  yTop: 0,
  yBottom: 40,
}

function captioned(side: AxisSide) {
  return { ...axis(side, [0]), ticks: wideTicks, caption: 'coverage' }
}

test('an exported left-side axis stands its spine on the plot edge however wide its gutter', () => {
  const contentLeft = 30
  const wide = captioned('left')
  expect(axisGutterWidth(wide)).toBeGreaterThan(AXIS_GUTTER_WIDTH_PX)
  for (const a of [axis('left', [0]), wide]) {
    expect(axisGutterLeft(a, 800, 4, contentLeft) + axisGutterWidth(a)).toBe(
      contentLeft,
    )
  }
})

test('the left gutter an export holds is the widest drawn left-side axis', () => {
  expect(leftAxisGutterWidth([axis('left', [0]), captioned('left')])).toBe(
    axisGutterWidth(captioned('left')),
  )
  expect(leftAxisGutterWidth([axis('left', [0])])).toBe(AXIS_GUTTER_WIDTH_PX)
  expect(leftAxisGutterWidth([captioned('right'), axis('left', [0], 20)])).toBe(
    0,
  )
})

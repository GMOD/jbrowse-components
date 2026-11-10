import { rightAxisStackInsets } from './axisPlacement.ts'
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

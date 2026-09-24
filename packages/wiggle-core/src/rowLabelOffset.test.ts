import { AXIS_GUTTER_WIDTH_PX } from '@jbrowse/display-ui/yScaleTicks'

import { rowLabelOffset } from './rowLabelOffset.ts'

import type { YAxis } from '@jbrowse/display-ui'

function axis(height: number, left?: number): YAxis {
  return {
    domain: [0, 1],
    scaleType: 'linear',
    height,
    left,
    ticks: { items: [], yTop: 5, yBottom: height - 5 },
  }
}

test('with no axis drawn the labels start at the offset', () => {
  expect(rowLabelOffset([], 30)).toBe(30)
  expect(rowLabelOffset([axis(20)], 30)).toBe(30)
})

test('past an axis each row repeats, whichever reaches further', () => {
  expect(rowLabelOffset([axis(100)], 0)).toBe(AXIS_GUTTER_WIDTH_PX + 4)
  expect(rowLabelOffset([axis(100, 80)], 30)).toBe(
    80 + AXIS_GUTTER_WIDTH_PX + 4,
  )
  expect(rowLabelOffset([axis(100)], 500)).toBe(500)
})

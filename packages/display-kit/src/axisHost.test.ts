import { types } from '@jbrowse/mobx-state-tree'

import { captionedAxes } from './axisHost.ts'

import type { YAxis } from '@jbrowse/display-ui'

function host(axis: Partial<YAxis>) {
  const scale: YAxis = {
    domain: [0, 1],
    scaleType: 'linear',
    height: 20,
    ticks: { yTop: 0, yBottom: 20, items: [] },
    ...axis,
  }
  return types
    .model('AxisHostStub', { height: 100, canvasWidthPx: 500 })
    .views(() => ({
      get axes() {
        return [scale]
      },
    }))
    .create()
}

test('a band too short for an axis is captioned unless its axis is hidden', () => {
  expect(captionedAxes(host({}))).toHaveLength(1)
  expect(captionedAxes(host({ showAxis: false }))).toEqual([])
})

test('a band tall enough for an axis takes no caption', () => {
  expect(captionedAxes(host({ height: 80 }))).toEqual([])
})

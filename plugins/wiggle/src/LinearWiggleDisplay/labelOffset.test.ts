import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

function scoredSource(name: string) {
  return {
    name,
    featurePositions: new Uint32Array([0, 1000]),
    featureScores: new Float32Array([30]),
    featureMinScores: new Float32Array([30]),
    featureMaxScores: new Float32Array([30]),
    numFeatures: 1,
    hasSummaryScores: false,
  }
}

const AXIS_OFF = { encoding: { y: { axis: { show: false } } } }

function offsetBeforeAndAfterData(displayConfig: Record<string, unknown>) {
  const { display, view } = createTestEnvironment({
    displayConfig,
  }).createDisplay()
  const before = { offset: display.prefersOffset, axes: display.axes.length }
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  display.setRpcData(
    0,
    { sources: [scoredSource('a')] },
    view.displayedRegions[0],
  )
  const after = { offset: display.prefersOffset, axes: display.axes.length }
  return { before, after }
}

it('offsets a plot with a shown axis before its axis exists', () => {
  expect(offsetBeforeAndAfterData({})).toEqual({
    before: { offset: true, axes: 0 },
    after: { offset: true, axes: 1 },
  })
})

it('overlaps a plot whose axis is hidden, before and after data', () => {
  const { before, after } = offsetBeforeAndAfterData(AXIS_OFF)
  expect(before.offset).toBe(false)
  expect(after).toEqual({ offset: false, axes: 1 })
})

it('overlaps a density plot', () => {
  const { before, after } = offsetBeforeAndAfterData({ mark: 'rect' })
  expect(before.offset).toBe(false)
  expect(after.offset).toBe(false)
})

it('offsets rows whatever the mark or axis, before one source has landed', () => {
  for (const config of [{}, AXIS_OFF, { mark: 'rect' }]) {
    const { before, after } = offsetBeforeAndAfterData({
      ...config,
      rows: 'source',
    })
    expect(before.offset).toBe(true)
    expect(after.offset).toBe(true)
  }
})

it('follows encoding.y.axis.show when it changes', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.prefersOffset).toBe(true)
  setConf(display, ['encoding', 'y', 'axis', 'show'], false)
  expect(display.prefersOffset).toBe(false)
})

it('offsets an overlay whose rows are narrowed, as the narrowing chip sits at its top-left', () => {
  for (const config of [AXIS_OFF, { mark: 'rect' }]) {
    const { before, after } = offsetBeforeAndAfterData({
      ...config,
      rows: { field: '', kept: ['a'] },
    })
    expect(before.offset).toBe(true)
    expect(after.offset).toBe(true)
  }
})

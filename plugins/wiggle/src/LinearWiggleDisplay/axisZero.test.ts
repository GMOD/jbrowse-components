import { createTestEnvironment } from './testEnv.ts'

import type { WiggleDataResult } from '@jbrowse/wiggle-core'

// Two features across the window, scored 30 and 60: values well off 0, so
// whether the axis reaches down to it shows in the domain.
function makeData(): WiggleDataResult {
  return {
    sources: [
      {
        name: 'default',
        featurePositions: new Uint32Array([0, 500, 500, 1000]),
        featureScores: new Float32Array([30, 60]),
        featureMinScores: new Float32Array([30, 60]),
        featureMaxScores: new Float32Array([30, 60]),
        numFeatures: 2,
        hasSummaryScores: false,
      },
    ],
  }
}

function makeDisplay(displayConfig: Record<string, unknown> = {}) {
  const { createDisplay } = createTestEnvironment({ displayConfig })
  const { display, view } = createDisplay()
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  display.setRpcData(0, makeData(), view.displayedRegions[0])
  return display
}

test('the axis reaches 0 by default, and spans the values with zero off', () => {
  expect(makeDisplay().domain).toEqual([0, 60])
  expect(makeDisplay({ scales: { y: { zero: false } } }).domain).toEqual([
    30, 60,
  ])
})

test('the score menu toggle writes the slot', () => {
  const display = makeDisplay()
  display.setScaleZero(false)
  expect(display.scaleZero).toBe(false)
  expect(display.domain).toEqual([30, 60])
})

// A density row maps score to color: there is no axis for 0 to be the
// bottom of, so the ramp spends its color on the values whatever the slot
// says.
test('a density plot spans its values whatever zero says', () => {
  const display = makeDisplay()
  display.setRenderingType('density')
  expect(display.scaleZero).toBe(true)
  expect(display.domain).toEqual([30, 60])
})

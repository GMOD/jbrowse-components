import { createTestEnvironment } from './testEnv.ts'

import type { WiggleDataResult } from '@jbrowse/wiggle-core'

// One feature spanning the visible window, scored 30, so the autoscaled domain
// is wide enough for a rule at 15 to sit inside it.
function makeData(): WiggleDataResult {
  const featurePositions = new Uint32Array([0, 1000])
  const featureScores = new Float32Array([30])
  return {
    sources: [
      {
        name: 'default',
        featurePositions,
        featureScores,
        featureMinScores: new Float32Array([30]),
        featureMaxScores: new Float32Array([30]),
        numFeatures: 1,
        hasSummaryScores: false,
        posFeaturePositions: featurePositions,
        posFeatureScores: featureScores,
        posNumFeatures: 1,
        negFeaturePositions: new Uint32Array(0),
        negFeatureScores: new Float32Array(0),
        negNumFeatures: 0,
      },
    ],
  }
}

function makeDisplay() {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  display.configuration.setSlot('scoreRules', [{ value: 15, label: '1 copy' }])
  display.setRpcData(0, makeData())
  return display
}

it('places a configured rule on the score axis', () => {
  const display = makeDisplay()
  expect(display.domain).toBeDefined()
  expect(display.scoreRuleMarks).toEqual([
    { value: 15, label: '1 copy', y: expect.any(Number) },
  ])
})

it('stops drawing rules in density mode', () => {
  const display = makeDisplay()
  expect(display.scoreRuleMarks).toHaveLength(1)

  // density spends color rather than height on the score, so there is no axis
  // for a rule to sit on — the same reason showCrossHatches goes false here,
  // and a dashed line with a "1 copy" caption over a color ramp reads as a
  // threshold in a picture that has none
  display.setRenderingType('density')
  expect(display.isDensityMode).toBe(true)
  expect(display.domain).toBeDefined()
  expect(display.scoreRuleMarks).toEqual([])
})

import { createTestEnvironment } from './testEnv.ts'

import type { WiggleDataResult } from '@jbrowse/wiggle-core'

// One feature spanning the visible window, scored 30, which autoscales to a
// [0,30] domain with tick levels every 10 — so a rule can be placed both on a
// tick and between two.
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
  display.configuration.setSlot('scoreRules', [
    { value: 20, label: '2 copies' },
    { value: 15, label: '1.5 copies' },
  ])
  display.setRpcData(0, makeData())
  return display
}

// Pinned against the ticks rather than a number this test computed itself: the
// rules are read beside the axis, so what matters is that the model handed
// scoreRuleMarks the same box the ticks were built in. A rule ON a tick level
// has to land on that tick — 20 and not 15, because 15 is the midpoint of a
// [0,30] domain and lands at the same y under any box centered on the plot.
it('places a configured rule on the axis its ticks were built in', () => {
  const display = makeDisplay()
  const ticks = display.ticks!
  expect(display.domain).toEqual([0, 30])

  // toBeCloseTo, not toEqual: a tick's y comes off the d3 scale and a rule's
  // off makeScoreNormalizer, so the two agree to about 1e-14 rather than to the
  // bit. The placement bug this is here for — handing scoreRuleMarks a box the
  // ticks were not built in — moves a mark by 1.7px.
  const at = (value: number) => ticks.items.find(t => t.value === value)!.y
  const marks = display.scoreRuleMarks
  expect(marks.map(({ value, label }) => ({ value, label }))).toEqual([
    { value: 20, label: '2 copies' },
    { value: 15, label: '1.5 copies' },
  ])
  expect(marks[0]!.y).toBeCloseTo(at(20), 6)
  expect(marks[1]!.y).toBeCloseTo((at(10) + at(20)) / 2, 6)
})

it('drops a rule the visible domain does not reach', () => {
  const display = makeDisplay()
  display.configuration.setSlot('scoreRules', [{ value: 500 }])
  expect(display.scoreRuleMarks).toEqual([])
})

it('stops drawing rules in density mode', () => {
  const display = makeDisplay()
  expect(display.scoreRuleMarks).toHaveLength(2)

  // density spends color rather than height on the score, so there is no axis
  // for a rule to sit on — the same reason showCrossHatches goes false here,
  // and a dashed line with a "2 copies" caption over a color ramp reads as a
  // threshold in a picture that has none
  display.setRenderingType('density')
  expect(display.isDensityMode).toBe(true)
  expect(display.domain).toBeDefined()
  expect(display.scoreRuleMarks).toEqual([])
})

import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

import type { WiggleDataResult, YAxis } from '@jbrowse/wiggle-core'

function ruleMarksOf(display: { axes: YAxis[] }) {
  return display.axes[0]?.ruleMarks ?? []
}

function source(name: string, score: number) {
  return {
    name,
    featurePositions: new Uint32Array([0, 1000]),
    featureScores: new Float32Array([score]),
    featureMinScores: new Float32Array([score]),
    featureMaxScores: new Float32Array([score]),
    numFeatures: 1,
    hasSummaryScores: false,
  }
}

// One feature spanning the visible window, scored 30, which autoscales to a
// [0,30] domain with tick levels every 10 — so a rule can be placed both on a
// tick and between two.
function makeData(): WiggleDataResult {
  return { sources: [source('default', 30)] }
}

const TWO_RULES = [
  { value: 20, label: '2 copies' },
  { value: 15, label: '1.5 copies' },
]

function makeDisplay(
  rules: unknown[] = TWO_RULES,
  displayConfig: Record<string, unknown> = {},
  data = makeData(),
) {
  const { createDisplay } = createTestEnvironment({
    displayConfig: { ...displayConfig, scales: { y: { rules } } },
  })
  const { display, view } = createDisplay()
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  display.setRpcData(0, data, view.displayedRegions[0])
  return display
}

// Pinned against the ticks rather than a number this test computed itself: the
// rules are read beside the axis, so what matters is that they are placed in
// the box the ticks were built in. A rule ON a tick level has to land on that
// tick — 20 and not 15, because 15 is the midpoint of a [0,30] domain and lands
// at the same y under any box centered on the plot.
it('places a configured rule on the axis its ticks were built in', () => {
  const display = makeDisplay()
  const ticks = display.axes[0]!.ticks
  expect(display.domain).toEqual([0, 30])

  // toBeCloseTo, not toEqual: a tick's y comes off the d3 scale and a rule's
  // off makeScoreNormalizer, so the two agree to about 1e-14 rather than to the
  // bit.
  const at = (value: number) => ticks.items.find(t => t.value === value)!.y
  const marks = ruleMarksOf(display)
  expect(marks.map(({ value, label }) => ({ value, label }))).toEqual([
    { value: 20, label: '2 copies' },
    { value: 15, label: '1.5 copies' },
  ])
  expect(marks[0]!.y).toBeCloseTo(at(20), 6)
  expect(marks[1]!.y).toBeCloseTo((at(10) + at(20)) / 2, 6)
})

it('takes a bare number as the rule at that value', () => {
  expect(ruleMarksOf(makeDisplay([20])).map(r => r.value)).toEqual([20])
})

// The rule is the reason the axis goes that high. Autoscale follows the visible
// data, so without this a copy-number rule vanishes over a homozygous deletion —
// the one window where "2 copies would be up there" is the most informative mark
// on screen, and nothing in the UI would say it had been configured.
it('lifts the axis to a rule the visible data never reaches', () => {
  const display = makeDisplay([{ value: 90, label: '6 copies' }])
  expect(display.domain).toEqual([0, 90])
  expect(ruleMarksOf(display)).toHaveLength(1)
})

// An explicit bound is the config saying where the axis stops, so it still wins
// and the rule drops as before.
it('leaves an explicitly bounded axis alone', () => {
  const display = makeDisplay([90])
  display.setMaxScore(40)
  expect(display.domain?.[1]).toBe(40)
  expect(ruleMarksOf(display)).toEqual([])
})

it('a rule written after load redraws and rescales', () => {
  const display = makeDisplay([])
  expect(ruleMarksOf(display)).toEqual([])
  setConf(display, ['scales', 'y', 'rules'], [90])
  expect(display.domain).toEqual([0, 90])
  expect(ruleMarksOf(display)).toHaveLength(1)
})

it('stops drawing rules in density mode', () => {
  const display = makeDisplay()
  expect(ruleMarksOf(display)).toHaveLength(2)

  // density spends color rather than height on the score, so there is no axis
  // for a rule to sit on — the same reason showCrossHatches goes false here,
  // and a dashed line with a "2 copies" caption over a color ramp reads as a
  // threshold in a picture that has none
  display.setRenderingType('density')
  expect(display.isDensityMode).toBe(true)
  expect(display.domain).toBeDefined()
  expect(ruleMarksOf(display)).toEqual([])
})

// Density spends the domain on its color ramp instead of on height, so lifting
// the axis to a rule it does not draw stretches the ramp over a range nothing
// on screen reaches and washes the plot out — the same trap
// effectiveSummaryScoreMode exists for.
it('does not lift the axis for a rule density will not draw', () => {
  const display = makeDisplay([90])
  expect(display.domain).toEqual([0, 90])

  display.setRenderingType('density')
  expect(ruleMarksOf(display)).toEqual([])
  expect(display.domain).toEqual([0, 30])
})

// A row per source shares the one scale, so each row is ruled in its own band:
// the rule sits in the row's tick box, which the chrome repeats down the rows.
it('rules every row of a faceted track, in the row its ticks were built in', () => {
  const display = makeDisplay(
    [15],
    { facet: 'source' },
    { sources: [source('a', 30), source('b', 10)] },
  )
  const [axis] = display.axes
  expect(axis!.bandTops).toHaveLength(2)
  expect(display.domain).toEqual([0, 30])
  const { yTop, yBottom } = axis!.ticks
  expect(yBottom).toBeLessThanOrEqual(axis!.height)
  expect(ruleMarksOf(display)[0]!.y).toBeCloseTo((yTop + yBottom) / 2, 6)
})

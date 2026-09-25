import { markPlotProblems, markPlotSettingsWritten } from './markPlot.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { MarkPlot } from './markPlot.ts'

const PLOT: MarkPlot = {
  marks: [
    { mark: 'bar', encoding: { y: 'score', color: { field: 'strand' } } },
    {
      mark: 'bar',
      encoding: { y: 'count' },
      transform: [
        { type: 'bin', step: 'auto' },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
      minBpPerPx: 100,
    },
  ],
  facet: { field: 'strand' },
}

function displayOn(config: Record<string, unknown> = {}) {
  return createTestEnvironment(config).createDisplay().display
}

// `stripDefault` is what keeps the box readable: a slot at its default is
// absent from the snapshot, so a `bar` mark does not name itself and the
// box opens on what the author wrote rather than on forty default slots — an
// aggregate's default op strips to `{}`, while `step: "auto"` is not a default
// and stays.
it('opens on what a config declared, with the defaults left off', () => {
  const display = displayOn(PLOT as Record<string, unknown>)
  expect(display.markPlot).toEqual({
    marks: [
      { encoding: { y: 'score', color: { field: 'strand' } } },
      {
        encoding: { y: 'count' },
        transform: [
          { type: 'bin', step: 'auto' },
          { type: 'aggregate', ops: [{}] },
        ],
        minBpPerPx: 100,
      },
    ],
    facet: { field: 'strand' },
  })
})

// The property the box exists for: applying what it shows is a round trip, so
// a setting the editor never displayed cannot be dropped by using it.
it('applying the plot it shows changes nothing and reports nothing unapplied', () => {
  const display = displayOn(PLOT as Record<string, unknown>)
  const before = display.markPlot
  const report = display.applyDisplaySettings(
    markPlotSettingsWritten(before, before),
  )
  expect(report).toMatchObject({ unapplied: [], failed: [] })
  expect(display.markPlot).toEqual(before)
})

it('writes a plot the box lifted, and the display draws by it', () => {
  const display = displayOn()
  const next: MarkPlot = {
    marks: [{ mark: 'point', encoding: { y: 'score' } }],
  }
  display.applyDisplaySettings(markPlotSettingsWritten(next, display.markPlot))
  expect(display.markTypes).toEqual(['point'])
  expect(display.configProblems).toEqual([])
})

it('a null clears the setting rather than writing an empty one', () => {
  const display = displayOn({ facet: { field: 'strand' } })
  expect(display.markPlot.facet).toBeDefined()
  display.applyDisplaySettings({ facet: null })
  expect(display.markPlot.facet).toBeUndefined()
})

// The box and the corner notice read one function over one lift, so they
// cannot disagree about what a plot says.
it('says through the corner notice exactly what the box would say', () => {
  const display = displayOn({ marks: [{ mark: 'bar' }], rows: 'source' })
  expect(markPlotProblems(display.liftMarkPlot(display.markPlot))).toEqual(
    display.configProblems,
  )
  expect(display.configProblems.map(p => p.rule)).toContain(
    'mark-without-value',
  )
})

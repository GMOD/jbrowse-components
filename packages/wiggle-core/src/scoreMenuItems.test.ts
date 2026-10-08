import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { ScoreScaleMixin } from './ScoreScaleMixin.ts'
import { makeScoreAxisMenuItem } from './scoreMenuItems.ts'
import { scalesSchema, valueScaleSchema } from './valueScaleConfigSchema.ts'

import type { ValueScale } from '@jbrowse/display-ui'

const testConfigSchema = ConfigurationSchema('TestScoreDisplay', {
  scales: scalesSchema(valueScaleSchema({ domainQuantile: 0.99 })),
})

function makeDisplay(defaultScoreDomain?: [number, number]) {
  return types
    .compose(
      'TestScoreDisplay',
      ScoreScaleMixin(),
      types.model({ id: 'd1', configuration: testConfigSchema }),
    )
    .views(() => ({
      get defaultScoreDomain(): [number | undefined, number | undefined] {
        return defaultScoreDomain ?? [undefined, undefined]
      },
    }))
    .create({ configuration: {} })
}

const label = (display: ReturnType<typeof makeDisplay>, opts = {}) =>
  makeScoreAxisMenuItem(display, opts).label

describe('the Y axis row', () => {
  it('names nothing while the axis follows the data on a linear scale', () => {
    expect(label(makeDisplay())).toBe('Y axis...')
  })

  it('names a pinned end, auto for the other, and a non-linear scale', () => {
    const display = makeDisplay()
    display.setMinScore(190)
    expect(label(display)).toBe('Y axis (190 – auto)...')
    display.setScaleType('log')
    expect(label(display)).toBe('Y axis (190 – auto, log)...')
    display.setMinScore(undefined)
    expect(label(display)).toBe('Y axis (log)...')
  })

  it('takes the label it is given', () => {
    expect(label(makeDisplay(), { label: 'Coverage axis' })).toBe(
      'Coverage axis...',
    )
  })

  // A display whose `defaultScoreDomain` pins an end (GC content's [0, 1])
  // resolves `minScoreBound`/`maxScoreBound` to real numbers with both bounds
  // unset, so a row asking the resolved bounds would caption a fresh track
  // with a pair nobody pinned.
  it('captions nothing off a default domain, and only what is really set', () => {
    const display = makeDisplay([0, 1])
    expect([display.minScoreBound, display.maxScoreBound]).toEqual([0, 1])
    expect(label(display)).toBe('Y axis...')
    display.setMaxScore(0.75)
    expect(label(display)).toBe('Y axis (auto – 0.75)...')
    display.setMaxScore(undefined)
    expect(display.maxScoreBound).toBe(1)
    expect(label(display)).toBe('Y axis...')
  })
})

test('Clip outliers re-ticks at the quantile its untick wrote over, not the default', () => {
  const display = makeDisplay()
  display.setDomainQuantile(0.95)
  display.setDomainQuantile(1)
  expect(display.clipQuantile).toBe(0.95)
  display.setDomainQuantile(display.clipQuantile)
  expect(display.domainQuantile).toBe(0.95)
})

// The reference lines are a member of the scale, offered where a scale the
// display draws rules a band for them to cross.
describe('scoreRulesDrawn', () => {
  const ruled = (bandTops?: number[]) =>
    types
      .compose(
        'TestRuledDisplay',
        ScoreScaleMixin(),
        types.model({ configuration: testConfigSchema }),
      )
      .views(() => ({
        get valueScales(): ValueScale[] {
          return [
            { domain: [0, 10], scaleType: 'linear', height: 100, bandTops },
          ]
        },
      }))
      .create({ configuration: {} })

  it('is false where the one scale is mapped to color', () => {
    expect(ruled([]).scoreRulesDrawn).toBe(false)
  })

  it('is false where the display draws no scale', () => {
    expect(makeDisplay().scoreRulesDrawn).toBe(false)
  })

  it('is true over a band, and the writer takes the config forms', () => {
    const display = ruled()
    expect(display.scoreRulesDrawn).toBe(true)
    display.setScoreRules([7.3, { value: 5, label: 'suggestive' }])
    expect(display.scoreRules).toEqual([
      { value: 7.3 },
      { value: 5, label: 'suggestive' },
    ])
    display.setScoreRules([])
    expect(display.scoreRules).toEqual([])
  })
})

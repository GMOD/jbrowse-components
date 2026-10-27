import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { ScoreScaleMixin } from './ScoreScaleMixin.ts'
import { makeScoreAxisMenuItem } from './scoreMenuItems.ts'
import { yEncodingSchema } from './yEncodingConfigSchema.ts'
import { yFieldChannelSchema } from './yFieldChannelConfigSchema.ts'

import type { YScalePaths } from './yScalePaths.ts'
import type { ValueScale } from '@jbrowse/display-ui'

const Y = ['encoding', 'y'] as const
const PATHS = {
  members: {
    type: [...Y, 'scale', 'type'],
    zero: [...Y, 'scale', 'zero'],
    domainMin: [...Y, 'scale', 'domainMin'],
    domainMax: [...Y, 'scale', 'domainMax'],
    fence: [...Y, 'scale', 'fenceQuantile'],
    constant: [...Y, 'scale', 'constant'],
    group: [...Y, 'scale', 'group'],
    title: [...Y, 'axis', 'title'],
    grid: [...Y, 'axis', 'grid'],
    rules: [...Y, 'rules'],
  },
  reset: [
    [...Y, 'scale'],
    [...Y, 'axis'],
    [...Y, 'rules'],
  ],
} as const satisfies YScalePaths

const testConfigSchema = ConfigurationSchema('TestScoreDisplay', {
  encoding: yEncodingSchema(yFieldChannelSchema({ fenceQuantile: 0.99 })),
})

function makeDisplay(defaultScoreDomain?: [number, number]) {
  return types
    .compose(
      'TestScoreDisplay',
      ScoreScaleMixin(PATHS),
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

  // the drawer shows the range and scale; the row names no setting
  it('names no setting, whatever is pinned', () => {
    const display = makeDisplay()
    display.setDomainMin(190)
    display.setScaleType('log')
    expect(label(display)).toBe('Y axis...')
  })

  it('takes the label it is given', () => {
    expect(label(makeDisplay(), { label: 'Coverage axis' })).toBe(
      'Coverage axis...',
    )
  })
})

test('Clip outliers re-ticks at the quantile its untick wrote over, not the default', () => {
  const display = makeDisplay()
  display.setFenceQuantile(0.95)
  display.setFenceQuantile(1)
  expect(display.clipFenceQuantile).toBe(0.95)
  display.setFenceQuantile(display.clipFenceQuantile)
  expect(display.fenceQuantile).toBe(0.95)
})

// The reference lines are a member of the scale, offered where a scale the
// display draws rules a band for them to cross.
describe('scoreRulesDrawn', () => {
  const ruled = (bandTops?: number[]) =>
    types
      .compose(
        'TestRuledDisplay',
        ScoreScaleMixin(PATHS),
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

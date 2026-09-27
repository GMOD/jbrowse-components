import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { types } from '@jbrowse/mobx-state-tree'

import { ScoreScaleMixin } from './ScoreScaleMixin.ts'
import {
  makeAxisZeroItem,
  makeClipOutliersItem,
  makeScoreSubMenu,
} from './scoreMenuItems.ts'
import { scalesSchema, valueScaleSchema } from './valueScaleConfigSchema.ts'

import type { ScoreScaleModel } from './scoreMenuItems.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ValueScale } from '@jbrowse/display-ui'

// A minimal ScoreScaleModel. `getSession` is only reached from an onClick, and
// nothing here clicks, so the node-ness the interface asks for never gets used.
// `hasManualScoreBounds` is derived rather than overridable so the double cannot
// claim a manual bound the pinned pair does not hold — which is the state the
// real mixin never produces and the state this file used to test against.
function makeSelf(over: Partial<ScoreScaleModel> = {}) {
  const self = {
    scaleType: 'linear',
    scaleZero: true,
    domainQuantile: 1,
    clipQuantile: 0.99,
    manualMinScore: undefined,
    manualMaxScore: undefined,
    minScoreBound: undefined,
    maxScoreBound: undefined,
    autoscaledDomain: undefined,
    setScaleType: () => {},
    setScaleZero: () => {},
    setDomainQuantile: () => {},
    setMinScore: () => {},
    setMaxScore: () => {},
    ...over,
  }
  return {
    ...self,
    hasManualScoreBounds:
      self.manualMinScore !== undefined || self.manualMaxScore !== undefined,
  } as unknown as ScoreScaleModel
}

function labels(item: MenuItem) {
  const sub = 'subMenu' in item ? resolveSubMenu(item) : []
  return sub.map(i => ('label' in i ? i.label : ''))
}

describe('makeScoreSubMenu', () => {
  it('offers the scale type, Clip outliers and the range', () => {
    expect(labels(makeScoreSubMenu(makeSelf()))).toEqual([
      'Scale type',
      'Clip outliers',
      'Set min/max score...',
    ])
  })

  it('still captions itself with the pinned pair', () => {
    expect(
      labels(
        makeScoreSubMenu(
          makeSelf({
            manualMinScore: 2,
            minScoreBound: 2,
          }),
        ),
      ),
    ).toEqual([
      'Scale type',
      'Clip outliers',
      'Set min/max score (2 – auto)...',
    ])
  })

  // A density plot rules no band and its domain ignores `zero`, so the row
  // comes and goes with the axis, as the reference lines do.
  it('offers Start axis at 0 where the scale rules a band', () => {
    const withAxis = {
      ...makeSelf(),
      scoreRulesDrawn: true,
      scoreRules: [],
      setScoreRules: () => {},
    }
    expect(labels(makeScoreSubMenu(withAxis))).toEqual([
      'Scale type',
      'Clip outliers',
      'Start axis at 0',
      'Set min/max score...',
      'Reference lines...',
    ])
  })

  it('Start axis at 0 writes the opposite of the slot it shows', () => {
    const written: boolean[] = []
    const item = makeAxisZeroItem({
      scaleZero: true,
      setScaleZero: zero => written.push(zero),
    })
    expect(item.checked).toBe(true)
    item.onClick()
    expect(written).toEqual([false])
  })

  it('names the percentile Clip outliers clips at, the one in force first', () => {
    const helpOf = (over: Partial<ScoreScaleModel>) => {
      const item = makeClipOutliersItem(makeSelf(over))
      return 'helpText' in item ? item.helpText : undefined
    }
    expect(helpOf({ domainQuantile: 0.95 })).toContain('95th percentile')
    expect(helpOf({ domainQuantile: 1, clipQuantile: 0.99 })).toContain(
      '99th percentile',
    )
  })
})

// The above drives a plain object; this drives the real mixin, because the bug
// this pins was invisible to a hand-written double. A display whose
// `defaultScoreDomain` pins an end (GC content's [0,1]) resolves
// `minScoreBound`/`maxScoreBound` to real numbers with both bounds still unset,
// so a menu asking the resolved bounds "is a manual bound in force?" answers yes
// on a freshly opened track — and captions the row with a pair nobody pinned.
const testConfigSchema = ConfigurationSchema('TestScoreDisplay', {
  scales: scalesSchema(
    valueScaleSchema({
      domainQuantile: 0.99,
    }),
  ),
})

function makePinnedDomainDisplay() {
  return types
    .compose(
      'TestScoreDisplay',
      ScoreScaleMixin(),
      types.model({ configuration: testConfigSchema }),
    )
    .views(() => ({
      get defaultScoreDomain(): [number | undefined, number | undefined] {
        return [0, 1]
      },
    }))
    .create({ configuration: {} })
}

describe('makeScoreSubMenu against a pinned defaultScoreDomain', () => {
  it('captions nothing while neither bound is set', () => {
    const display = makePinnedDomainDisplay()
    expect([display.minScoreBound, display.maxScoreBound]).toEqual([0, 1])
    expect(labels(makeScoreSubMenu(display))).toEqual([
      'Scale type',
      'Clip outliers',
      'Set min/max score...',
    ])
  })

  it('captions once a bound is really set, and clearing takes it away', () => {
    const display = makePinnedDomainDisplay()
    display.setMaxScore(0.75)
    expect(labels(makeScoreSubMenu(display))).toEqual([
      'Scale type',
      'Clip outliers',
      'Set min/max score (auto – 0.75)...',
    ])

    display.setMinScore(undefined)
    display.setMaxScore(undefined)
    expect(display.maxScoreBound).toBe(1)
    expect(labels(makeScoreSubMenu(display))).toEqual([
      'Scale type',
      'Clip outliers',
      'Set min/max score...',
    ])
  })
})

// The reference lines are a member of the scale, so the one menu that writes
// the scale offers them, and only where a scale it draws rules a band for them
// to cross.
describe('the reference lines row', () => {
  const ruledSchema = ConfigurationSchema('TestRuledDisplay', {
    scales: scalesSchema(valueScaleSchema()),
  })
  const ruled = (bandTops?: number[]) =>
    types
      .compose(
        'TestRuledDisplay',
        ScoreScaleMixin(),
        types.model({ configuration: ruledSchema }),
      )
      .views(() => ({
        get valueScales(): ValueScale[] {
          return [
            { domain: [0, 10], scaleType: 'linear', height: 100, bandTops },
          ]
        },
      }))
      .create({ configuration: {} })

  it('is absent where the one scale is mapped to colour', () => {
    expect(labels(makeScoreSubMenu(ruled([])))).not.toContain(
      'Reference lines...',
    )
  })

  it('is absent where the display draws no scale', () => {
    expect(labels(makeScoreSubMenu(makePinnedDomainDisplay()))).not.toContain(
      'Reference lines...',
    )
  })

  it('counts the lines it holds, and the writer takes the config forms', () => {
    const display = ruled()
    expect(labels(makeScoreSubMenu(display))).toContain('Reference lines...')
    display.setScoreRules([7.3, { value: 5, label: 'suggestive' }])
    expect(display.scoreRules).toEqual([
      { value: 7.3 },
      { value: 5, label: 'suggestive' },
    ])
    expect(labels(makeScoreSubMenu(display))).toContain(
      'Reference lines (2)...',
    )
    display.setScoreRules([])
    expect(display.scoreRules).toEqual([])
  })
})

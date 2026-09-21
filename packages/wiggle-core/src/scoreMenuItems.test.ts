import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { types } from '@jbrowse/mobx-state-tree'

import { ScoreScaleMixin } from './ScoreScaleMixin.ts'
import { makePinCurrentRangeItem, makeScoreSubMenu } from './scoreMenuItems.ts'
import { scalesSchema, valueScaleSchema } from './valueScaleConfigSchema.ts'

import type { AutoscaleModel, ScoreScaleModel } from './scoreMenuItems.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// A minimal ScoreScaleModel. `getSession` is only reached from an onClick, and
// nothing here clicks, so the node-ness the interface asks for never gets used.
// `hasManualScoreBounds` is derived rather than overridable so the double cannot
// claim a manual bound the pinned pair does not hold — which is the state the
// real mixin never produces and the state this file used to test against.
function makeSelf(over: Partial<ScoreScaleModel & AutoscaleModel> = {}) {
  const self = {
    scaleType: 'linear',
    scaleTypeChoices: ['linear', 'log', 'symlog'],
    autoscaleType: 'local' as string | undefined,
    manualMinScore: undefined,
    manualMaxScore: undefined,
    minScoreBound: undefined,
    maxScoreBound: undefined,
    setScaleType: () => {},
    setAutoscale: () => {},
    setMinScore: () => {},
    setMaxScore: () => {},
    ...over,
  }
  return {
    ...self,
    hasManualScoreBounds:
      self.manualMinScore !== undefined || self.manualMaxScore !== undefined,
  } as unknown as ScoreScaleModel & AutoscaleModel
}

function labels(item: MenuItem) {
  const sub = 'subMenu' in item ? resolveSubMenu(item) : []
  return sub.map(i => ('label' in i ? i.label : ''))
}

// The radios are no longer opted out of by the caller: each one derives from
// what the display's own `scales.y` declares.
describe('makeScoreSubMenu derives its radios from the scale', () => {
  it('offers scale type and autoscale where the scale declares both', () => {
    expect(labels(makeScoreSubMenu(makeSelf()))).toEqual([
      'Scale type',
      'Autoscale type',
      'Set min/max score...',
    ])
  })

  it('names exactly the scale types the display admits', () => {
    const item = makeScoreSubMenu(makeSelf({ scaleTypeChoices: ['linear'] }))
    expect(labels(item)).toEqual(['Autoscale type', 'Set min/max score...'])
    expect(
      labels(
        makeScoreSubMenu(makeSelf({ scaleTypeChoices: ['linear', 'log'] })),
      ),
    ).toEqual(['Scale type', 'Autoscale type', 'Set min/max score...'])
  })

  it('drops the autoscale radios where the scale declares no mode', () => {
    // manhattan's case: its domain is plain min/max plus the manual bounds, so
    // an Autoscale-type radio wrote a slot and changed nothing drawn
    expect(
      labels(
        makeScoreSubMenu(
          makeSelf({ scaleTypeChoices: ['linear'], autoscaleType: undefined }),
        ),
      ),
    ).toEqual(['Set min/max score...'])
  })

  it('offers the pin row while the drawn domain is known, and not before', () => {
    const self = makeSelf({
      scaleTypeChoices: ['linear'],
      autoscaleType: undefined,
    })
    expect(labels(makeScoreSubMenu(self))).toEqual(['Set min/max score...'])
    expect(labels(makeScoreSubMenu(self, { domain: [-3, 47] }))).toEqual([
      'Set min/max score...',
      'Pin current min/max',
    ])
  })

  it('the pin writes the drawn domain, not the resolved bounds', () => {
    const writes: (number | undefined)[] = []
    const self = makeSelf({
      setMinScore: n => writes.push(n),
      setMaxScore: n => writes.push(n),
    })
    makePinCurrentRangeItem(self, [-3, 47]).onClick()
    expect(writes).toEqual([-3, 47])
  })

  it('still offers the clear item when a manual bound is in force', () => {
    expect(
      labels(
        makeScoreSubMenu(
          makeSelf({
            manualMinScore: 2,
            minScoreBound: 2,
            scaleTypeChoices: ['linear'],
            autoscaleType: undefined,
          }),
        ),
      ),
    ).toEqual(['Set min/max score (2 – auto)...', 'Clear manual min/max'])
  })
})

// The above drives a plain object; this drives the real mixin, because the bug
// this pins was invisible to a hand-written double. A display whose
// `defaultScoreDomain` pins an end (GC content's [0,1]) resolves
// `minScoreBound`/`maxScoreBound` to real numbers with both bounds still unset,
// so a menu asking the resolved bounds "is a manual bound in force?" answers yes
// on a freshly opened track — and the Clear row it offers writes the nothing
// that was already there.
const testConfigSchema = ConfigurationSchema('TestScoreDisplay', {
  scales: scalesSchema(
    valueScaleSchema({
      types: ['linear', 'log', 'symlog'],
      autoscale: {
        modes: ['local', 'localsd', 'localpercentile'],
        default: 'localpercentile',
      },
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
  it('offers no clear row while neither bound is set', () => {
    const display = makePinnedDomainDisplay()
    expect([display.minScoreBound, display.maxScoreBound]).toEqual([0, 1])
    expect(labels(makeScoreSubMenu(display))).toEqual([
      'Scale type',
      'Autoscale type',
      'Set min/max score...',
    ])
  })

  it('offers it once a bound is really set, and clearing takes it away', () => {
    const display = makePinnedDomainDisplay()
    display.setMaxScore(0.75)
    expect(labels(makeScoreSubMenu(display))).toEqual([
      'Scale type',
      'Autoscale type',
      'Set min/max score (auto – 0.75)...',
      'Clear manual min/max',
    ])

    display.setMinScore(undefined)
    display.setMaxScore(undefined)
    expect(display.maxScoreBound).toBe(1)
    expect(labels(makeScoreSubMenu(display))).toEqual([
      'Scale type',
      'Autoscale type',
      'Set min/max score...',
    ])
  })
})

// The reference lines are a member of the scale, so the one menu that writes
// the scale offers them, and only where the display's scale declares `rules`.
describe('the reference lines row', () => {
  const ruledSchema = ConfigurationSchema('TestRuledDisplay', {
    scales: scalesSchema(
      valueScaleSchema({ types: ['linear'], rules: { color: 'red' } }),
    ),
  })
  const ruled = () =>
    types
      .compose(
        'TestRuledDisplay',
        ScoreScaleMixin(),
        types.model({ configuration: ruledSchema }),
      )
      .create({ configuration: {} })

  it('is absent where the scale declares no rules', () => {
    expect(labels(makeScoreSubMenu(makePinnedDomainDisplay()))).not.toContain(
      'Reference lines...',
    )
  })

  it('counts the lines it holds, and the writer takes the config forms', () => {
    const display = ruled()
    expect(labels(makeScoreSubMenu(display))).toContain('Reference lines...')
    display.setScoreRules([7.3, { value: 5, label: 'suggestive' }])
    expect(display.scoreRules).toEqual([
      { value: 7.3, color: 'red' },
      { value: 5, color: 'red', label: 'suggestive' },
    ])
    expect(labels(makeScoreSubMenu(display))).toContain(
      'Reference lines (2)...',
    )
    display.setScoreRules([])
    expect(display.scoreRules).toEqual([])
  })
})

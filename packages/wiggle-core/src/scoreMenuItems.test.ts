import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { types } from '@jbrowse/mobx-state-tree'

import { ScoreScaleMixin } from './ScoreScaleMixin.ts'
import { scoreAxisConfigSchemaFields } from './scoreAxisConfigSchemaFields.ts'
import { makeScoreSubMenu } from './scoreMenuItems.ts'

import type { ScoreScaleModel } from './scoreMenuItems.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// A minimal ScoreScaleModel. `getSession` is only reached from an onClick, and
// nothing here clicks, so the node-ness the interface asks for never gets used.
// `hasManualScoreBounds` is derived rather than overridable so the double cannot
// claim a manual bound the raw slots do not hold — which is the state the real
// mixin never produces and the state this file used to test against.
function makeSelf(over: Partial<ScoreScaleModel> = {}) {
  const self = {
    scaleType: 'linear',
    autoscaleType: 'local',
    minScore: Number.MIN_VALUE,
    maxScore: Number.MAX_VALUE,
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
      self.minScore !== Number.MIN_VALUE || self.maxScore !== Number.MAX_VALUE,
  } as unknown as ScoreScaleModel
}

function labels(item: MenuItem) {
  const sub = 'subMenu' in item ? resolveSubMenu(item) : []
  return sub.map(i => ('label' in i ? i.label : ''))
}

describe('makeScoreSubMenu capability opt-outs', () => {
  it('offers scale type and autoscale by default', () => {
    // the wiggle-family default: a display that wires both gets both, so the
    // opt-outs below can never silently strip a menu from a display that wants
    // it
    expect(labels(makeScoreSubMenu(makeSelf()))).toEqual([
      'Scale type',
      'Autoscale type',
      'Set min/max score...',
    ])
  })

  it('drops the autoscale radios when the display does not consult them', () => {
    // manhattan's case: its domain is plain min/max plus the manual bounds, so
    // an Autoscale-type radio wrote the config slot and changed nothing drawn
    expect(
      labels(
        makeScoreSubMenu(makeSelf(), { scaleType: false, autoscale: false }),
      ),
    ).toEqual(['Set min/max score...'])
  })

  it('still offers the clear item when a manual bound is in force', () => {
    expect(
      labels(
        makeScoreSubMenu(makeSelf({ minScore: 2, minScoreBound: 2 }), {
          scaleType: false,
          autoscale: false,
        }),
      ),
    ).toEqual(['Set min/max score (2 – auto)...', 'Clear manual min/max'])
  })
})

// The above drives a plain object; this drives the real mixin, because the bug
// this pins was invisible to a hand-written double. A display whose
// `defaultScoreDomain` pins an end (GC content's [0,1]) resolves
// `minScoreBound`/`maxScoreBound` to real numbers with both config slots still
// at their sentinels, so a menu asking the resolved bounds "is a manual bound in
// force?" answers yes on a freshly opened track — and the Clear row it offers
// writes the sentinels that were already there.
const testConfigSchema = ConfigurationSchema(
  'TestScoreDisplay',
  scoreAxisConfigSchemaFields,
)

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
  it('offers no clear row while both slots sit at their sentinel', () => {
    const display = makePinnedDomainDisplay()
    expect([display.minScoreBound, display.maxScoreBound]).toEqual([0, 1])
    expect(labels(makeScoreSubMenu(display))).toEqual([
      'Scale type',
      'Autoscale type',
      'Set min/max score...',
    ])
  })

  it('offers it once a slot is really set, and clearing takes it away', () => {
    const display = makePinnedDomainDisplay()
    display.setMaxScore(0.75)
    expect(labels(makeScoreSubMenu(display))).toEqual([
      'Scale type',
      'Autoscale type',
      'Set min/max score (0 – 0.75)...',
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

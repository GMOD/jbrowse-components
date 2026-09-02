import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { makeScoreSubMenu } from './scoreMenuItems.ts'

import type { ScoreScaleModel } from './scoreMenuItems.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// A minimal ScoreScaleModel. `getSession` is only reached from an onClick, and
// nothing here clicks, so the node-ness the interface asks for never gets used.
function makeSelf(over: Partial<ScoreScaleModel> = {}) {
  return {
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
        makeScoreSubMenu(makeSelf({ minScoreBound: 2 }), {
          scaleType: false,
          autoscale: false,
        }),
      ),
    ).toEqual(['Set min/max score (2 – auto)...', 'Clear manual min/max'])
  })
})

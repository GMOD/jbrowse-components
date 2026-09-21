import { axisPlotBox } from '@jbrowse/wiggle-core'

import { manhattanFixture } from './manhattanFixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { YAxis } from '@jbrowse/wiggle-core'

function ruleMarksOf(display: { axes: YAxis[] }) {
  return display.axes[0]?.ruleMarks ?? []
}

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50_000 }

// The placement arithmetic lives in wiggle-core's scoreRules.test.ts, which this
// display shares. What is GWAS's own is that a threshold is a rule like any
// other: the same slot, the same widening, and a scan read against two of them
// names two.
function makeResult(score: number): ManhattanRpcResult {
  return {
    ...manhattanFixture({ x: [100], y: [score], flatbush: false }),
    yMin: 0,
    indexFound: true,
  }
}

describe('a threshold on a Manhattan plot', () => {
  it('defaults to none, so no rule is drawn', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.scoreRules).toEqual([])
    expect(ruleMarksOf(display)).toEqual([])
  })

  it('draws nothing before the data gives it a domain', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setScoreRules([7.3])
    expect(display.scoreRules).toEqual([{ value: 7.3 }])
    expect(ruleMarksOf(display)).toEqual([])
  })

  it('places a bare threshold, and paints the one its author colours', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, makeResult(10), ctgA)
    display.setScoreRules([5, { value: 7.3, color: 'red', label: 'p = 5e-8' }])

    const box = axisPlotBox(display.height)
    expect(display.domain).toEqual([0, 10])
    expect(ruleMarksOf(display)).toEqual([
      { value: 5, y: (box.yTop + box.yBottom) / 2 },
      {
        value: 7.3,
        color: 'red',
        label: 'p = 5e-8',
        y: expect.any(Number) as number,
      },
    ])
  })

  // The window the threshold is FOR: nothing here clears it. An axis that only
  // follows the data drops the line exactly there, leaving a plot of small
  // peaks with nothing to read them against and no hint one was asked for.
  it('widens the axis to a threshold the loaded scores never reach', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, makeResult(3), ctgA)
    display.setScoreRules([7.3])

    expect(display.domain?.[1]).toBeGreaterThanOrEqual(7.3)
    expect(ruleMarksOf(display)).toHaveLength(1)
  })

  // The widening is on the raw range, before the configured bounds, so an axis
  // the user pinned still excludes a line outside it.
  it('an explicit domainMax below the threshold still wins', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, makeResult(3), ctgA)
    display.setScoreRules([7.3])
    display.setMaxScore(4)

    expect(display.domain?.[1]).toBe(4)
    expect(ruleMarksOf(display)).toEqual([])
  })
})

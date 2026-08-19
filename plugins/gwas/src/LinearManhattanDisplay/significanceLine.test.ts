import { getConf, setConf } from '@jbrowse/core/configuration'
import { axisPlotBox } from '@jbrowse/wiggle-core'

import { createTestEnvironment } from './testEnv.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'

// The placement arithmetic lives in wiggle-core's scoreRules.test.ts, which this
// display now shares. What is GWAS's own is the wiring: the slot reaches the
// rule, and the threshold draws in the significance red rather than the grey a
// configured wiggle rule defaults to.
function makeResult(score: number): ManhattanRpcResult {
  return {
    positions: new Uint32Array([100]),
    ends: new Uint32Array([101]),
    glyphs: new Uint8Array([0]),
    scores: new Float32Array([score]),
    colors: new Uint32Array([0xff_00_00_ff]),
    numFeatures: 1,
    scoreMin: 0,
    scoreMax: score,
    flatbushData: undefined,
    indexFound: true,
  }
}

describe('significanceLine config slot', () => {
  it('defaults to unset, so no rule is drawn', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(getConf(display, 'significanceLine')).toBeUndefined()
    expect(display.scoreRuleMarks).toEqual([])
  })

  it('draws nothing before the data gives it a domain', () => {
    const { display } = createTestEnvironment().createDisplay()
    setConf(display, 'significanceLine', 7.3)
    expect(display.significanceLine).toBe(7.3)
    expect(display.scoreRuleMarks).toEqual([])
  })

  it('places the threshold in the significance red once there is a domain', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, makeResult(10))
    setConf(display, 'significanceLine', 5)

    const box = axisPlotBox(display.height)
    expect(display.domain).toEqual([0, 10])
    expect(display.scoreRuleMarks).toEqual([
      {
        value: 5,
        // red, not the grey a wiggle rule defaults to: this one is a
        // significance threshold, not a level the reader chose
        color: 'rgb(200,60,60)',
        y: (box.yTop + box.yBottom) / 2,
      },
    ])
  })

  it('drops a threshold the loaded scores never reach', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, makeResult(10))
    setConf(display, 'significanceLine', 40)
    expect(display.scoreRuleMarks).toEqual([])
  })
})

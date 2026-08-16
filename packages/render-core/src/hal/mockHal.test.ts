import { MockHal } from './mockHal.ts'

import type { PipelineDescriptor } from './types.ts'

function pass(id: string) {
  return { id } as PipelineDescriptor
}

describe('MockHal draw validation', () => {
  it('records a draw against a registered pass', () => {
    const hal = new MockHal([pass('rect'), pass('line')])
    hal.drawPass('rect', 0)

    expect(hal.callsOf('drawPass')[0]!.args).toEqual(['rect', 0, undefined])
  })

  it('throws on a pass the display never registered', () => {
    // The failure this exists for is silent twice over: both real HALs drop the
    // draw with no pipeline for the id, so the GPU backends paint nothing while
    // Canvas2D keeps painting correctly — and the mock used to record the call
    // anyway, so the unit test asserting `callsOf('drawPass')` went green over
    // it. A typo'd or renamed id has no legitimate use, so there is nothing to
    // preserve by staying quiet here.
    const hal = new MockHal([pass('rect')])

    expect(() => {
      hal.drawPass('rect-outline', 0)
    }).toThrow(/'rect-outline' is not a registered pass/)
  })

  it('names what the HAL does hold, since the fix is spelling one of them', () => {
    const hal = new MockHal([pass('fill'), pass('line')])

    expect(() => {
      hal.drawPass('fil', 0)
    }).toThrow(/'fill', 'line'/)
  })

  it('checks the borrowed buffer id as well as the pass being drawn', () => {
    // `drawPass(a, key, b)` runs pass a's pipeline over pass b's buffer — canvas
    // draws chevron over line's, continuation over rect's — so b is a pass id
    // too and a typo in it is just as silent.
    const hal = new MockHal([pass('chevron'), pass('line')])

    expect(() => {
      hal.drawPass('chevron', 0, 'lines')
    }).toThrow(/bufferPassId 'lines' is not a registered pass/)
    expect(() => {
      hal.drawPass('chevron', 0, 'line')
    }).not.toThrow()
  })
})

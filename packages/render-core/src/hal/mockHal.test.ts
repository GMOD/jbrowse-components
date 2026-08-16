import { MockHal } from './mockHal.ts'

import type { PipelineDescriptor } from './types.ts'

function pass(id: string) {
  return { id } as PipelineDescriptor
}

describe('MockHal effective clip per draw', () => {
  it('carries the scissor in force at each draw', () => {
    const hal = new MockHal([pass('a'), pass('b')])
    hal.beginFrame(0, 0, 0, 0)
    hal.setScissor(0, 0, 400, 100)
    hal.drawPass('a', 0)
    hal.setScissor(400, 0, 400, 100)
    hal.drawPass('a', 1)
    hal.drawPass('b', 1)
    hal.endFrame()

    expect(hal.draws().map(d => [d.passId, d.regionKey, d.scissor])).toEqual([
      ['a', 0, { x: 0, y: 0, w: 400, h: 100 }],
      ['a', 1, { x: 400, y: 0, w: 400, h: 100 }],
      // no setScissor between the two, so `b` inherits — which is the whole
      // reason this is state rather than an argument
      ['b', 1, { x: 400, y: 0, w: 400, h: 100 }],
    ])
  })

  it('a cleared scissor leaves later draws unclipped', () => {
    // The WebGPU bug this exists for: `clearScissor` dropped the stored rect
    // without re-issuing a full-canvas one, so a draw after it stayed clipped to
    // the previous block. `null` here is the contract — the full canvas.
    const hal = new MockHal([pass('a'), pass('overlay')])
    hal.beginFrame(0, 0, 0, 0)
    hal.setScissor(400, 0, 400, 100)
    hal.drawPass('a', 0)
    hal.clearScissor()
    hal.drawPass('overlay', 0)
    hal.endFrame()

    expect(hal.draws().map(d => d.scissor)).toEqual([
      { x: 400, y: 0, w: 400, h: 100 },
      null,
    ])
  })

  it('a new frame starts unclipped', () => {
    const hal = new MockHal([pass('a')])
    hal.beginFrame(0, 0, 0, 0)
    hal.setScissor(400, 0, 400, 100)
    hal.drawPass('a', 0)
    hal.endFrame()
    // no clearScissor before the next frame — both real HALs reset anyway
    hal.beginFrame(0, 0, 0, 0)
    hal.drawPass('a', 0)
    hal.endFrame()

    expect(hal.draws().map(d => d.scissor)).toEqual([
      { x: 400, y: 0, w: 400, h: 100 },
      null,
    ])
  })

  it('tracks the viewport on the same terms', () => {
    const hal = new MockHal([pass('a')])
    hal.beginFrame(0, 0, 0, 0)
    hal.setViewport(10, 0, 200, 50)
    hal.drawPass('a', 0)
    hal.clearViewport()
    hal.drawPass('a', 0)
    hal.endFrame()

    expect(hal.draws().map(d => d.viewport)).toEqual([
      { x: 10, y: 0, w: 200, h: 50 },
      null,
    ])
  })
})

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

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

// The uniform half of the same problem the clip log solves: a draw's values are
// state, so nothing in `calls` says which write a given draw read. It matters
// more here than for the clip, because the two real HALs implement the pairing
// differently — WebGPU binds the most recent ring slot, WebGL2 has one UBO — so
// a renderer that batches its writes is right on one backend and wrong on the
// other, with no error either way.
describe('MockHal uniforms per draw', () => {
  const u = (v: number) => Float32Array.from([v]).buffer

  it('pairs each draw with the write in force when it was issued', () => {
    const hal = new MockHal([pass('a'), pass('b')])
    hal.beginFrame(0, 0, 0, 0)
    hal.writeUniforms(u(10))
    hal.drawPass('a', 0)
    hal.writeUniforms(u(20))
    hal.drawPass('b', 0)
    hal.endFrame()

    expect(hal.draws().map(d => hal.uniformsOf(d)?.[0])).toEqual([10, 20])
  })

  it('two draws after one write share it, which is the legal batching', () => {
    // A renderer writing once per block and drawing several passes into it is
    // the common shape, and it is fine on both HALs.
    const hal = new MockHal([pass('a'), pass('b')])
    hal.beginFrame(0, 0, 0, 0)
    hal.writeUniforms(u(7))
    hal.drawPass('a', 0)
    hal.drawPass('b', 0)
    hal.endFrame()

    expect(hal.draws().map(d => d.uniformWrite)).toEqual([0, 0])
    expect(hal.draws().map(d => hal.uniformsOf(d)?.[0])).toEqual([7, 7])
  })

  it('catches the batched-writes shape that only breaks on WebGPU', () => {
    // Both writes land, then both draws. On WebGL2 this is still wrong, but on
    // WebGPU it is wrong *silently and differently*: every draw binds the last
    // slot, so the pass that meant to read 10 reads 20. The log is what makes
    // the mispairing visible in a unit test.
    const hal = new MockHal([pass('a'), pass('b')])
    hal.beginFrame(0, 0, 0, 0)
    hal.writeUniforms(u(10))
    hal.writeUniforms(u(20))
    hal.drawPass('a', 0)
    hal.drawPass('b', 0)
    hal.endFrame()

    expect(hal.draws().map(d => hal.uniformsOf(d)?.[0])).toEqual([20, 20])
  })

  it('reports a draw that precedes every write rather than inventing one', () => {
    // WebGPU clamps this to ring slot 0 and WebGL2 leaves the last frame's UBO
    // bound, so there is no shared answer to report — null says so.
    const hal = new MockHal([pass('a')])
    hal.beginFrame(0, 0, 0, 0)
    hal.drawPass('a', 0)
    hal.endFrame()

    expect(hal.draws()[0]!.uniformWrite).toBe(-1)
    expect(hal.uniformsOf(hal.draws()[0]!)).toBeNull()
  })
})

describe('MockHal mid-frame buffer replacement', () => {
  it('records the upload that replaced a buffer the open frame had drawn from', () => {
    // Alignments' shape: one region, one overlay pass, re-uploaded per section
    // inside the block loop. On WebGPU the release is deferred past the submit
    // so this paints; the point of the log is that a renderer test can say which
    // of the two shapes its renderer has.
    const hal = new MockHal([pass('overlay')])
    hal.beginFrame(0, 0, 0, 0)
    hal.uploadBuffer(0, 'overlay', new Float32Array([1]), 1)
    hal.drawPass('overlay', 0)
    hal.uploadBuffer(0, 'overlay', new Float32Array([2]), 1)
    hal.drawPass('overlay', 0)
    hal.endFrame()

    expect(hal.replacedWhileDrawn()).toEqual(['0:overlay'])
  })

  it('leaves a mid-frame delete of an undrawn pass out of it', () => {
    // Synteny's shape: `ensureUploaded` deletes a pass mid-frame that nothing in
    // the open frame referenced, which was never the hazard.
    const hal = new MockHal([pass('a'), pass('b')])
    hal.beginFrame(0, 0, 0, 0)
    hal.uploadBuffer(0, 'a', new Float32Array([1]), 1)
    hal.drawPass('a', 0)
    hal.deleteBuffer(0, 'b')
    hal.endFrame()

    expect(hal.replacedWhileDrawn()).toEqual([])
  })

  it('counts a deleteRegion and a prune over a drawn region, and only the open frame', () => {
    const hal = new MockHal([pass('a')])
    hal.uploadBuffer(0, 'a', new Float32Array([1]), 1)
    hal.uploadBuffer(1, 'a', new Float32Array([1]), 1)
    hal.beginFrame(0, 0, 0, 0)
    hal.drawPass('a', 0)
    hal.drawPass('a', 1)
    hal.deleteRegion(0)
    hal.pruneRegions([0])
    hal.endFrame()
    // after endFrame the frame is closed, so the same calls are unremarkable
    hal.uploadBuffer(2, 'a', new Float32Array([1]), 1)
    hal.deleteRegion(2)

    expect(hal.replacedWhileDrawn()).toEqual(['0:a', '1:a'])
  })

  it('draws through a bufferPassId name the buffer it actually reads', () => {
    // `drawPass(a, key, b)` runs pass a's pipeline over pass b's buffer, so it
    // is b that a later upload would be pulling out from under it.
    const hal = new MockHal([pass('chevron'), pass('line')])
    hal.beginFrame(0, 0, 0, 0)
    hal.uploadBuffer(0, 'line', new Float32Array([1]), 1)
    hal.drawPass('chevron', 0, 'line')
    hal.uploadBuffer(0, 'line', new Float32Array([2]), 1)
    hal.endFrame()

    expect(hal.replacedWhileDrawn()).toEqual(['0:line'])
  })
})

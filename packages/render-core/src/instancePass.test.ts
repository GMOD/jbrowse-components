import { MockHal } from './hal/mockHal.ts'
import { uploadPass } from './instancePass.ts'

import type { PipelineDescriptor } from './hal/types.ts'
import type { InstancePass } from './instancePass.ts'

// Only `id` and `instanceStride` are read. A real descriptor carries a compiled
// shader, so the fixture states the two fields that matter rather than twenty
// that say nothing — same shape as the fixture in hal/passIds.test.ts.
function pass<T>(
  id: string,
  instanceStride: number,
  pack: (data: T) => ArrayBuffer | ArrayBufferView,
): InstancePass<T> {
  return { id, instanceStride, pack } as unknown as InstancePass<T>
}

function halFor(...ids: string[]) {
  return new MockHal(ids.map(id => ({ id }) as PipelineDescriptor))
}

describe('uploadPass', () => {
  it('takes the instance count from the buffer, not from the payload', () => {
    // The whole point of the helper: the HAL multiplies count by stride to find
    // the last instance, so a count sourced anywhere but the bytes is a second
    // expression free to disagree — and disagreeing high reads off the end for
    // undefined pixels and no throw. Here the payload says 9 and the bytes say
    // 3; the bytes win.
    const hal = halFor('rect')
    uploadPass(
      hal,
      0,
      pass('rect', 16, () => new ArrayBuffer(48)),
      { misleadingCount: 9 },
    )

    expect(hal.callsOf('uploadBuffer')[0]!.args).toEqual([0, 'rect', 48, 3])
  })

  it('measures a view by the view, not by the buffer under it', () => {
    // A packer that over-allocates and right-sizes with `subarray` is the shape
    // the docs steer callers away from, but it is legal and it must not be
    // counted against the whole allocation — 4 instances of capacity, 2 packed.
    const hal = halFor('gap')
    const scratch = new Uint8Array(64)
    uploadPass(
      hal,
      7,
      pass('gap', 16, () => scratch.subarray(0, 32)),
      null,
    )

    expect(hal.callsOf('uploadBuffer')[0]!.args).toEqual([7, 'gap', 32, 2])
  })

  it('passes an empty pack through, because that IS the release', () => {
    // Every HAL deletes the pass's prior buffer before it looks at the count, so
    // skipping the call on an empty pack would leave the previous frame's
    // instances on screen. Guarding it is the mistake the doc comment warns
    // about; this pins the un-guarded behavior.
    const hal = halFor('mismatch')
    uploadPass(
      hal,
      2,
      pass('mismatch', 8, () => new ArrayBuffer(24)),
      null,
    )
    expect(hal.getBufferCount(2, 'mismatch')).toBe(3)

    uploadPass(
      hal,
      2,
      pass('mismatch', 8, () => new ArrayBuffer(0)),
      null,
    )

    expect(hal.callsOf('uploadBuffer')).toHaveLength(2)
    expect(hal.callsOf('uploadBuffer')[1]!.args).toEqual([2, 'mismatch', 0, 0])
    expect(hal.getBufferCount(2, 'mismatch')).toBe(0)
  })

  it('throws on a byte length that is not whole instances', () => {
    // Reachable when a buffer packed somewhere that cannot import the .slang —
    // a worker package with its own codegen target — was built against a stride
    // that has since drifted. Loud beats a fractional count reaching the HAL.
    const hal = halFor('read')

    expect(() => {
      uploadPass(
        hal,
        0,
        pass('read', 16, () => new ArrayBuffer(40)),
        null,
      )
    }).toThrow(/pass read: 40 bytes is not a whole number of 16-byte instances/)
    expect(hal.callsOf('uploadBuffer')).toHaveLength(0)
  })
})

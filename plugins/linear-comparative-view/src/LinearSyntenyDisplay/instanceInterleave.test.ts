import { interleaveInstances, patchInstanceColors } from './instanceInterleave.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

// Distinct, deterministic values in every lane so a mis-targeted patch (wrong
// stride/offset, or clobbering a neighbour lane) shows up as a byte diff.
function makeData(colors: Uint32Array): SyntenyInstanceData {
  const n = colors.length
  const seq = (base: number) =>
    Float32Array.from({ length: n }, (_, i) => base + i)
  return {
    bp1Hi: seq(1000),
    bp1Lo: seq(0.1),
    bp2Hi: seq(2000),
    bp2Lo: seq(0.2),
    bp3Hi: seq(3000),
    bp3Lo: seq(0.3),
    bp4Hi: seq(4000),
    bp4Lo: seq(0.4),
    colors,
    kinds: Uint8Array.from({ length: n }, (_, i) => i % 7),
    instanceFeatureIdx: Uint32Array.from({ length: n }, (_, i) => i),
    alignmentLengths: seq(500),
    instanceCount: n,
  }
}

describe('patchInstanceColors', () => {
  // The recolor fast path in GpuSyntenyRenderer.getInterleaved reuses a packed
  // buffer and rewrites only the color lane. That is correct iff it lands
  // byte-identical to a full re-interleave carrying the new colors over the
  // same geometry — this asserts exactly that.
  test('equals a full re-interleave with the new colors', () => {
    const data = makeData(Uint32Array.from([0x11111111, 0x22222222, 0x33333333]))
    const newColors = Uint32Array.from([0xaabbccdd, 0x01020304, 0xfffefdfc])

    const patched = interleaveInstances(data)
    patchInstanceColors(patched, newColors)

    const fullReinterleave = interleaveInstances(makeData(newColors))
    expect(new Uint8Array(patched)).toEqual(new Uint8Array(fullReinterleave))
  })
})

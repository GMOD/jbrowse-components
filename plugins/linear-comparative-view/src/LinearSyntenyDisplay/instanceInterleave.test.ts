import { interleaveInstances, patchInstanceColors } from './instanceInterleave.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

// Distinct, deterministic values in every lane so a mis-targeted patch (wrong
// stride/offset, or clobbering a neighbour lane) shows up as a byte diff.
function makeData(colors: Uint32Array): SyntenyInstanceData {
  const n = colors.length
  const seq = (base: number) =>
    Float32Array.from({ length: n }, (_, i) => base + i)
  return {
    bp1: seq(1000),
    bp2: seq(2000),
    bp3: seq(3000),
    bp4: seq(4000),
    base0: 0,
    base1: 0,
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

import {
  KIND_BASE,
  KIND_CIGAR_I,
  KIND_MARKER,
} from '../LinearSyntenyRPC/syntenyColors.ts'
import {
  interleaveInstances,
  packClickedOutlineInstances,
  patchInstanceColors,
} from './instanceInterleave.ts'
import { INSTANCE_STRIDE_BYTES } from './shaders/syntenyFillStraight.iface.generated.ts'

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
    const data = makeData(
      Uint32Array.from([0x11111111, 0x22222222, 0x33333333]),
    )
    const newColors = Uint32Array.from([0xaabbccdd, 0x01020304, 0xfffefdfc])

    const patched = interleaveInstances(data)
    patchInstanceColors(patched, newColors)

    const fullReinterleave = interleaveInstances(makeData(newColors))
    expect(new Uint8Array(patched)).toEqual(new Uint8Array(fullReinterleave))
  })
})

describe('packClickedOutlineInstances', () => {
  // One feature spread over a base instance, a CIGAR tile and a marker tick,
  // plus a second feature — the four cases isClickedSilhouette distinguishes.
  function makeKindData(): SyntenyInstanceData {
    const kinds = Uint8Array.from([
      KIND_BASE,
      KIND_CIGAR_I,
      KIND_MARKER,
      KIND_BASE,
    ])
    const featureIdx = Uint32Array.from([0, 0, 0, 1])
    const n = kinds.length
    const seq = (base: number) =>
      Float32Array.from({ length: n }, (_, i) => base + i)
    return {
      bp1: seq(1000),
      bp2: seq(2000),
      bp3: seq(3000),
      bp4: seq(4000),
      base0: 0,
      base1: 0,
      colors: Uint32Array.from({ length: n }, (_, i) => 0x11111111 * (i + 1)),
      kinds,
      instanceFeatureIdx: featureIdx,
      alignmentLengths: seq(500),
      instanceCount: n,
    }
  }

  function recordAt(buf: ArrayBuffer, i: number) {
    return new Uint8Array(
      buf.slice(i * INSTANCE_STRIDE_BYTES, (i + 1) * INSTANCE_STRIDE_BYTES),
    )
  }

  // The whole point of the dedicated buffer: the edge pass must be handed the
  // clicked feature's BASE instance only, not the region. A CIGAR tile would
  // outline every indel and a marker tick is an interior line, so both are the
  // shader's own exclusions (isClickedSilhouette), and a different feature's
  // base is simply not the selection.
  test('keeps only the clicked feature base instance', () => {
    const data = makeKindData()
    const interleaved = interleaveInstances(data)

    // clickedFeatureId is 1-based: featureIdx 0 -> 1.
    const { buf, count } = packClickedOutlineInstances(data, 1, interleaved)

    expect(count).toBe(1)
    // Byte-identical to instance 0's record in the source buffer — the outline
    // and the fill must draw the same polygon from the same numbers.
    expect(recordAt(buf, 0)).toEqual(recordAt(interleaved, 0))
  })

  test('picks the second feature when it is the one clicked', () => {
    const data = makeKindData()
    const interleaved = interleaveInstances(data)

    const { buf, count } = packClickedOutlineInstances(data, 2, interleaved)

    expect(count).toBe(1)
    expect(recordAt(buf, 0)).toEqual(recordAt(interleaved, 3))
  })

  // A clicked feature whose instances all live in another region. The caller
  // skips the draw on count 0 rather than issuing an empty one.
  test('packs nothing when the clicked feature is not in the region', () => {
    const data = makeKindData()

    const { buf, count } = packClickedOutlineInstances(
      data,
      99,
      interleaveInstances(data),
    )

    expect(count).toBe(0)
    expect(buf.byteLength).toBe(0)
  })
})

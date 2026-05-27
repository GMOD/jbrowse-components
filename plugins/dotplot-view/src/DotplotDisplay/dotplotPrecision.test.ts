import { buildLineSegments } from './dotplotGeometry.ts'

import type { DotplotRpcData } from './types.ts'

function makeRpcData(
  p11: number,
  p12: number,
  p21: number,
  p22: number,
  padH = 0,
  padV = 0,
): DotplotRpcData {
  return {
    p11: new Float64Array([p11]),
    p12: new Float64Array([p12]),
    p21: new Float64Array([p21]),
    p22: new Float64Array([p22]),
    padHs: new Float32Array([padH]),
    padVs: new Float32Array([padV]),
    strands: new Int8Array([1]),
    starts: new Uint32Array([0]),
    ends: new Uint32Array([100]),
    identities: new Float32Array([-1]),
    meanScores: new Float32Array([-1]),
    mappingQuals: new Float32Array([-1]),
    refNames: ['chr1'],
    parsedCigars: [[]],
  }
}

describe('buildLineSegments cumBp precision', () => {
  test('feature at Gbp scale round-trips precisely (Float64)', () => {
    // Float32(8e8) alone loses ~64 bp of precision; Float64 preserves it.
    const data = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    const segs = buildLineSegments(data, () => 0xff0000ff, false, 0, 1, 1)
    expect(segs.instanceCount).toBe(1)
    expect(segs.x1[0]).toBe(1_000)
    expect(segs.x2[0]).toBe(1_100)
    expect(segs.y1[0]).toBe(8e8)
    expect(segs.y2[0]).toBe(8e8 + 100)
  })

  test('geometry is zoom-invariant: same cumBp at different bpPerPx', () => {
    const a = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    const b = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    const segA = buildLineSegments(a, () => 0, false, 0, 1, 1)
    const segB = buildLineSegments(b, () => 0, false, 0, 10, 1)
    expect(segA.y1[0]).toBe(segB.y1[0])
  })

  test('padding is stored separately from cumBp', () => {
    const data = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100, 50, 200)
    const segs = buildLineSegments(data, () => 0, false, 0, 1, 1)
    expect(segs.padHs[0]).toBe(50)
    expect(segs.padVs[0]).toBe(200)
    expect(segs.x1[0]).toBe(1_000)
    expect(segs.y1[0]).toBe(8e8)
  })

  test('minAlignmentLength filters short features', () => {
    const data = makeRpcData(0, 100, 0, 100)
    const segs = buildLineSegments(data, () => 0, false, 200, 1, 1)
    expect(segs.instanceCount).toBe(0)
  })
})

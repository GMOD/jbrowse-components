import { buildLineSegments } from './drawDotplotWebGL.ts'
import type { DotplotRpcData } from './types.ts'

function splitHiLo(cumBp: number): [number, number] {
  const iv = Math.floor(cumBp)
  const lo = iv - Math.floor(iv / 4096) * 4096
  return [iv - lo, lo + (cumBp - iv)]
}

function makeRpcData(
  p11CumBp: number,
  p12CumBp: number,
  p21CumBp: number,
  p22CumBp: number,
  padH = 0,
  padV = 0,
): DotplotRpcData {
  const [p11Hi, p11Lo] = splitHiLo(p11CumBp)
  const [p12Hi, p12Lo] = splitHiLo(p12CumBp)
  const [p21Hi, p21Lo] = splitHiLo(p21CumBp)
  const [p22Hi, p22Lo] = splitHiLo(p22CumBp)
  return {
    p11Hi: new Float32Array([p11Hi]),
    p11Lo: new Float32Array([p11Lo]),
    p12Hi: new Float32Array([p12Hi]),
    p12Lo: new Float32Array([p12Lo]),
    p21Hi: new Float32Array([p21Hi]),
    p21Lo: new Float32Array([p21Lo]),
    p22Hi: new Float32Array([p22Hi]),
    p22Lo: new Float32Array([p22Lo]),
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

describe('buildLineSegments hi/lo precision', () => {
  test('simple feature: cumBp hi/lo round-trips from p11 and p12', () => {
    // Feature at 800 Mbp — Float32(8e8) alone has ~64px ULP at bpPerPx=1.
    const data = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    const segs = buildLineSegments(data, () => 0xff0000ff, false, 0, 1, 1)
    expect(segs.count).toBe(1)
    expect(segs.x1Hi[0]! + segs.x1Lo[0]!).toBe(1_000)
    expect(segs.x2Hi[0]! + segs.x2Lo[0]!).toBe(1_100)
    expect(segs.y1Hi[0]! + segs.y1Lo[0]!).toBe(8e8)
    expect(segs.y2Hi[0]! + segs.y2Lo[0]!).toBe(8e8 + 100)
  })

  test('geometry is zoom-invariant: same cumBp at different bpPerPx', () => {
    // Feature fetched at bpPerPx=1: cumBp=(1000, 1100) for H
    const a = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    // Feature fetched at bpPerPx=10 but SAME genomic position: cumBp is identical
    const b = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    const segA = buildLineSegments(a, () => 0, false, 0, 1, 1)
    const segB = buildLineSegments(b, () => 0, false, 0, 10, 1)
    expect(segA.y1Hi[0]! + segA.y1Lo[0]!).toBe(segB.y1Hi[0]! + segB.y1Lo[0]!)
  })

  test('padding is stored separately from cumBp', () => {
    const data = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100, 50, 200)
    const segs = buildLineSegments(data, () => 0, false, 0, 1, 1)
    expect(segs.padHs[0]).toBe(50)
    expect(segs.padVs[0]).toBe(200)
    // cumBp should be unaffected by padding
    expect(segs.x1Hi[0]! + segs.x1Lo[0]!).toBe(1_000)
    expect(segs.y1Hi[0]! + segs.y1Lo[0]!).toBe(8e8)
  })

  test('minAlignmentLength filters short features', () => {
    const data = makeRpcData(0, 100, 0, 100)
    const segs = buildLineSegments(data, () => 0, false, 200, 1, 1)
    expect(segs.count).toBe(0)
  })
})

import { buildLineSegments } from './dotplotGeometry.ts'
import { fakeDotplotRpcData } from './testUtils.ts'

function makeRpcData(p11: number, p12: number, p21: number, p22: number) {
  return fakeDotplotRpcData({
    p11: new Float64Array([p11]),
    p12: new Float64Array([p12]),
    p21: new Float64Array([p21]),
    p22: new Float64Array([p22]),
  })
}

describe('buildLineSegments cumBp precision', () => {
  test('feature at Gbp scale round-trips precisely (Float64)', () => {
    // Float32(8e8) alone loses ~64 bp of precision; Float64 preserves it.
    const data = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    const segs = buildLineSegments(data, false, 0, 0, 1, 1, 0, 0)
    expect(segs.instanceCount).toBe(1)
    expect(segs.x1[0]).toBe(1_000)
    expect(segs.x2[0]).toBe(1_100)
    expect(segs.y1[0]).toBe(8e8)
    expect(segs.y2[0]).toBe(8e8 + 100)
  })

  test('geometry is zoom-invariant: same cumBp at different bpPerPx', () => {
    const a = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    const b = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    const segA = buildLineSegments(a, false, 0, 0, 1, 1, 0, 0)
    const segB = buildLineSegments(b, false, 0, 0, 10, 1, 0, 0)
    expect(segA.y1[0]).toBe(segB.y1[0])
  })

  test('minAlignmentLength filters short features', () => {
    const data = makeRpcData(0, 100, 0, 100)
    const segs = buildLineSegments(data, false, 200, 0, 1, 1, 0, 0)
    expect(segs.instanceCount).toBe(0)
  })

  test('carries the per-axis base through to the geometry', () => {
    const data = makeRpcData(1_000, 1_100, 8e8, 8e8 + 100)
    const segs = buildLineSegments(data, false, 0, 0, 1, 1, 5e8, 7e8)
    expect(segs.baseH).toBe(5e8)
    expect(segs.baseV).toBe(7e8)
  })

  test('CIGAR sub-segments trace toward (x2,y2) in a reversed region', () => {
    // A reversed query region (e.g. after auto-diagonalize) flips the vertical
    // endpoints so y1 > y2. The CIGAR walk must derive its vertical direction
    // from the endpoints, not from strand, or the detailed segments splay away
    // from y2. Ref span 250 (100M 50D 100M), query span 200, V decreasing.
    const M = (len: number) => (len << 4) | 0 // CIGAR_M
    const D = (len: number) => (len << 4) | 2 // CIGAR_D
    const data = fakeDotplotRpcData({
      p11: new Float64Array([1_000]),
      p12: new Float64Array([1_250]),
      p21: new Float64Array([5_000]),
      p22: new Float64Array([4_800]),
      alignmentLengths: new Uint32Array([250]),
      cigarData: new Uint32Array([M(100), D(50), M(100)]),
      cigarOffsets: new Uint32Array([0, 3]),
    })
    const segs = buildLineSegments(data, true, 0, 0, 1, 1, 0, 0)
    const last = segs.instanceCount - 1
    // final sub-segment lands exactly on the feature's (x2,y2) endpoint
    expect(segs.x2[last]).toBeCloseTo(1_250)
    expect(segs.y2[last]).toBeCloseTo(4_800)
    // vertical walk is monotonically downward (reversed), never above the start
    for (let i = 0; i < segs.instanceCount; i++) {
      expect(segs.y1[i]!).toBeLessThanOrEqual(5_000)
      expect(segs.y2[i]!).toBeLessThanOrEqual(5_000)
    }
  })

  // The buffers are allocated for the worst case — a segment per feature plus
  // one per shipped CIGAR op — and `subarray` would pin that whole allocation
  // for as long as the display holds the geometry. At whole-genome zoom the
  // worker ships CIGARs within 8x zoom headroom that the geometry builder is
  // then too zoomed out to walk, so the unused slack dwarfs the data.
  test('a mostly-unused geometry allocation is not retained', () => {
    const M = (len: number) => (len << 4) | 0 // CIGAR_M
    const cigarData = new Uint32Array(Array.from({ length: 64 }, () => M(1)))
    const data = {
      ...makeRpcData(0, 64, 0, 64),
      cigarData,
      cigarOffsets: new Uint32Array([0, cigarData.length]),
    }
    // at bpPerPx 1000 the 64bp feature is 0.064px, far under
    // MIN_CIGAR_PX_WIDTH, so all 64 ops collapse into one segment
    const segs = buildLineSegments(data, true, 0, 0, 1_000, 1_000, 0, 0)
    expect(segs.instanceCount).toBe(1)
    expect(segs.x1[0]).toBe(0)
    expect(segs.x2[0]).toBe(64)
    expect(segs.x1.buffer.byteLength).toBe(Float64Array.BYTES_PER_ELEMENT)
    expect(segs.instanceFeatureIdx.buffer.byteLength).toBe(
      Uint32Array.BYTES_PER_ELEMENT,
    )
  })

  test('window-relative Float32 upload is sub-pixel vs absolute Float64', () => {
    // Reproduces the GPU upload + shader reconstruction at genome scale:
    //   stored  = Float32(cumBp - base)
    //   screenX = stored*bpPerPxInv + panPx, panPx = (base - viewBp)*bpPerPxInv
    // and compares against the exact absolute reconstruction in float64.
    const base = 8e8 // fetch-time viewport-start cumBp, past Float32 exact-int
    const cumBp = base + 12_345.678 // an on-screen coord ~12 kbp from base
    const bpPerPx = 2 // moderate zoom
    const inv = 1 / bpPerPx
    // View panned 400px past the fetch base.
    const viewBp = base - 400 * bpPerPx

    const stored = Math.fround(cumBp - base)
    const panPx = (base - viewBp) * inv
    const screenX = Math.fround(stored * inv + panPx)
    const exact = (cumBp - viewBp) * inv

    expect(Math.abs(screenX - exact)).toBeLessThan(0.01)
  })
})

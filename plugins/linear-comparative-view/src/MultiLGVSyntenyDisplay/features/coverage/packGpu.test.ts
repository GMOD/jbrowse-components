import { packCoverageForGpu } from './packGpu.ts'

describe('packCoverageForGpu', () => {
  test('returns empty for zero maxDepth', () => {
    const depths = new Float32Array([1, 2, 3])
    const result = packCoverageForGpu(depths, 0, 0, 0)
    expect(result.binCount).toBe(0)
    expect(result.buffer.byteLength).toBe(0)
  })

  test('returns empty for empty depths', () => {
    const result = packCoverageForGpu(new Float32Array(0), 0, 10, 0)
    expect(result.binCount).toBe(0)
  })

  test('packs non-zero bins into 12-byte records', () => {
    const depths = new Float32Array([0, 5, 10, 0])
    const result = packCoverageForGpu(depths, 100, 10, 1000)
    expect(result.binCount).toBeGreaterThan(0)
    expect(result.buffer.byteLength).toBe(result.binCount * 12)
  })

  test('positions are absolute genomic coords (uint32)', () => {
    const depths = new Float32Array([5])
    const result = packCoverageForGpu(depths, 1500, 5, 1000)
    expect(result.binCount).toBe(1)
    const u32 = new Uint32Array(result.buffer)
    expect(u32[0]).toBe(1500)
  })

  test('positions exact at 3 Gbp (uint32 storage)', () => {
    const depths = new Float32Array([5])
    // 3_000_000_017 is past float32's 24-bit mantissa precision floor
    const startPos = 3_000_000_017
    const result = packCoverageForGpu(depths, startPos, 5, 1000)
    expect(result.binCount).toBe(1)
    const u32 = new Uint32Array(result.buffer)
    expect(u32[0]).toBe(startPos)
  })
})

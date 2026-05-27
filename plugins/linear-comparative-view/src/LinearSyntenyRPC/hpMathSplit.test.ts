import { writeHiLo } from './hpMathSplit.ts'

function split(cumBp: number) {
  const hi = new Float32Array(1)
  const lo = new Float32Array(1)
  writeHiLo(cumBp, hi, lo, 0)
  return { hi: hi[0]!, lo: lo[0]! }
}

describe('writeHiLo', () => {
  it('round-trips zero', () => {
    const { hi, lo } = split(0)
    expect(hi).toBe(0)
    expect(lo).toBe(0)
  })

  it('round-trips exact multiples of 4096', () => {
    for (const v of [4096, 8192, 4096 * 100, 4096 * 100000]) {
      const { hi, lo } = split(v)
      expect(hi + lo).toBe(v)
      // multiples of 4096: lo is 0 (the integer part fits in hi)
      expect(lo).toBe(0)
    }
  })

  it('round-trips fractional values', () => {
    for (const v of [0.5, 1.25, 4095.75, 4097.5]) {
      const { hi, lo } = split(v)
      expect(hi + lo).toBeCloseTo(v, 6)
    }
  })

  it('handles large cumulative-bp without precision loss', () => {
    // 800 Mbp — the cross-chromosome scenario that motivated hp-math
    const { hi, lo } = split(8e8)
    expect(hi + lo).toBe(8e8)
    // hi is a multiple of 4096
    expect(hi % 4096).toBe(0)
    // lo is strictly < 4096
    expect(lo).toBeGreaterThanOrEqual(0)
    expect(lo).toBeLessThan(4096)
  })

  it('handles 3 Gbp upper bound', () => {
    // 3 Gbp — close to the 4 Gbp uint32 ceiling enforced in the worker
    const v = 3_000_000_000
    const { hi, lo } = split(v)
    expect(hi + lo).toBe(v)
    expect(hi % 4096).toBe(0)
    expect(lo).toBeGreaterThanOrEqual(0)
    expect(lo).toBeLessThan(4096)
  })

  it('writes at the correct index without disturbing neighbors', () => {
    const hi = new Float32Array(3)
    const lo = new Float32Array(3)
    writeHiLo(1000, hi, lo, 1)
    expect(hi[0]).toBe(0)
    expect(lo[0]).toBe(0)
    expect(hi[1]! + lo[1]!).toBe(1000)
    expect(hi[2]).toBe(0)
    expect(lo[2]).toBe(0)
  })

  it('lo stays in [0, 4096) for arbitrary inputs', () => {
    for (const v of [1, 4095, 4096, 4097, 1_000_001, 999_999_999]) {
      const { lo } = split(v)
      expect(lo).toBeGreaterThanOrEqual(0)
      expect(lo).toBeLessThan(4096)
    }
  })
})

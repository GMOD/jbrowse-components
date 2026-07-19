import { buildRecombination } from './getLDMatrixFromPlink.ts'

import type { LDSnp } from './getLDMatrix.ts'

const snps: LDSnp[] = [
  { refName: '1', start: 100, end: 101 },
  { refName: '1', start: 200, end: 201 },
  { refName: '1', start: 300, end: 301 },
]

describe('buildRecombination (pre-computed PLINK path)', () => {
  it('emits 1 - r² at adjacent-pair midpoints', () => {
    // both adjacent pairs present: r² 0.8 and 0.5
    const r2 = new Float32Array([0.8, 0.5])
    const present = new Uint8Array([1, 1])
    const { values, positions } = buildRecombination(snps, r2, present)
    expect(Array.from(values)).toEqual([
      expect.closeTo(0.2),
      expect.closeTo(0.5),
    ])
    expect(positions).toEqual([150, 250])
  })

  it('marks an absent adjacent pair NaN, not a spurious spike', () => {
    // a thresholded file omits the first adjacent pair; without the fix it would
    // read as 1 - 0 = 1 (max recombination). It must be NaN (unmeasured) instead.
    const r2 = new Float32Array([0, 0.5])
    const present = new Uint8Array([0, 1])
    const { values, positions } = buildRecombination(snps, r2, present)
    expect(Number.isNaN(values[0]!)).toBe(true)
    expect(values[1]).toBeCloseTo(0.5)
    // positions stay full-length so index-based (uniform) x still aligns
    expect(positions).toEqual([150, 250])
  })
})

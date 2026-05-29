import { calculateLDStats } from './calculateLDStats.ts'

describe('calculateLDStats', () => {
  it('returns perfect LD (r2=1) for identical genotypes', () => {
    const geno1 = new Int8Array([0, 1, 2, 0, 1, 2])
    const geno2 = new Int8Array([0, 1, 2, 0, 1, 2])
    expect(calculateLDStats(geno1, geno2).r2).toBeCloseTo(1)
  })

  it('returns zero LD for independent genotypes', () => {
    const geno1 = new Int8Array([0, 0, 2, 2, 0, 0, 2, 2])
    const geno2 = new Int8Array([0, 2, 0, 2, 0, 2, 0, 2])
    expect(calculateLDStats(geno1, geno2).r2).toBeCloseTo(0, 1)
  })

  it('returns zero LD for monomorphic site', () => {
    const geno1 = new Int8Array([0, 0, 0, 0, 0, 0])
    const geno2 = new Int8Array([0, 1, 2, 0, 1, 2])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBe(0)
    expect(stats.dprime).toBe(0)
  })

  it('excludes missing genotypes', () => {
    const geno1 = new Int8Array([0, 1, 2, -1, -1, -1])
    const geno2 = new Int8Array([0, 1, 2, 0, 1, 2])
    expect(calculateLDStats(geno1, geno2).r2).toBeCloseTo(1)
  })

  it('returns zero with fewer than 2 valid samples', () => {
    const geno1 = new Int8Array([-1, -1, 0])
    const geno2 = new Int8Array([-1, -1, 1])
    const stats = calculateLDStats(geno1, geno2)
    expect(stats.r2).toBe(0)
    expect(stats.dprime).toBe(0)
  })

  it('squares to 1 under perfect anti-correlation', () => {
    const geno1 = new Int8Array([0, 0, 2, 2, 0, 2])
    const geno2 = new Int8Array([2, 2, 0, 0, 2, 0])
    expect(calculateLDStats(geno1, geno2).r2).toBeCloseTo(1)
  })

  it('returns r (signed) rather than r² when signedLD is set', () => {
    const geno1 = new Int8Array([0, 0, 2, 2, 0, 2])
    const geno2 = new Int8Array([2, 2, 0, 0, 2, 0])
    expect(calculateLDStats(geno1, geno2, true).r2).toBeCloseTo(-1)
  })
})

import { parsePlinkLDHeader, parsePlinkLDLine } from './parsePlinkLD.ts'

describe('parsePlinkLDHeader', () => {
  it('parses a standard PLINK --r2 header', () => {
    const h = parsePlinkLDHeader('CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2')
    expect(h.chrAIdx).toBe(0)
    expect(h.bpAIdx).toBe(1)
    expect(h.snpAIdx).toBe(2)
    expect(h.r2Idx).toBe(6)
  })

  it('accepts alias column names', () => {
    const h = parsePlinkLDHeader('CHR1 POS1 ID1 CHR2 POS2 ID2 RSQ DP')
    expect(h.bpAIdx).toBe(1)
    expect(h.r2Idx).toBe(6)
    expect(h.dprimeIdx).toBe(7)
  })

  it('throws when required position columns are missing', () => {
    expect(() => parsePlinkLDHeader('SNP_A SNP_B R2')).toThrow()
  })

  it('throws when neither R2 nor DP is present', () => {
    expect(() =>
      parsePlinkLDHeader('CHR_A BP_A SNP_A CHR_B BP_B SNP_B'),
    ).toThrow()
  })
})

describe('parsePlinkLDLine', () => {
  const header = parsePlinkLDHeader('CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2')

  it('parses a record', () => {
    const r = parsePlinkLDLine('1 100 rs1 1 200 rs2 0.85', header)
    expect(r).toEqual({
      chrA: '1',
      bpA: 100,
      snpA: 'rs1',
      chrB: '1',
      bpB: 200,
      snpB: 'rs2',
      r2: 0.85,
      dprime: undefined,
      mafA: undefined,
      mafB: undefined,
    })
  })

  it('synthesizes chr:bp ids when SNP columns are absent', () => {
    const noSnpHeader = parsePlinkLDHeader('CHR_A BP_A CHR_B BP_B R2')
    const r = parsePlinkLDLine('1 100 1 200 0.5', noSnpHeader)
    expect(r?.snpA).toBe('1:100')
    expect(r?.snpB).toBe('1:200')
  })

  it('returns null on malformed positions', () => {
    expect(parsePlinkLDLine('1 . rs1 1 . rs2 0.85', header)).toBeNull()
  })

  // Undefined, not 0. A file with no R2 column at all — plink's `--r2 dprime`
  // writes one, and `parsePlinkLDHeader` accepts it because it requires only
  // ONE of R2/DP — read back as every pair in perfect linkage equilibrium,
  // which is a plausible-looking matrix and a plausible-looking Manhattan plot
  // with nothing anywhere saying the column was missing. `resolveMetric` and
  // `buildLdToIndex` both branch on the absence.
  it('reports a missing or unparsable r2 as absent, never as zero', () => {
    expect(
      parsePlinkLDLine('1 100 rs1 1 200 rs2 nan', header)?.r2,
    ).toBeUndefined()
    expect(parsePlinkLDLine('1 100 rs1 1 200 rs2', header)?.r2).toBeUndefined()
    expect(parsePlinkLDLine('1 100 rs1 1 200 rs2 0', header)?.r2).toBe(0)
  })
})

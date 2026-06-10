import {
  DEFAULT_PLINK_LD_HEADER,
  parsePlinkLDLine,
  resolvePlinkLDHeader,
} from './index.ts'

describe('resolvePlinkLDHeader', () => {
  it('parses a real header and reports it as consumable', () => {
    const { header, isHeaderLine } = resolvePlinkLDHeader(
      'CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2',
    )
    expect(isHeaderLine).toBe(true)
    expect(header.r2Idx).toBe(6)
  })

  it('falls back to default columns for an empty header (tabix, no # line)', () => {
    const { header, isHeaderLine } = resolvePlinkLDHeader('')
    expect(isHeaderLine).toBe(false)
    expect(header).toEqual(DEFAULT_PLINK_LD_HEADER)
  })

  it('treats a bare data row as data, not a header (LocusZoom style)', () => {
    const dataLine = '16\t53809247\t16:53809247_G/A\t16\t53798622\tx\t0.83'
    const { header, isHeaderLine } = resolvePlinkLDHeader(dataLine)
    expect(isHeaderLine).toBe(false)
    const record = parsePlinkLDLine(dataLine, header)
    expect(record).toMatchObject({ chrA: '16', bpA: 53809247, bpB: 53798622 })
    expect(record!.r2).toBeCloseTo(0.83)
  })
})

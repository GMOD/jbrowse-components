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

  it('parses a plink2 .vcor header, whose every column is spelled differently', () => {
    const { header, isHeaderLine } = resolvePlinkLDHeader(
      '#CHROM_A\tPOS_A\tID_A\tCHROM_B\tPOS_B\tID_B\tPHASED_R2\tABS_DPRIME',
    )
    expect(isHeaderLine).toBe(true)
    const record = parsePlinkLDLine(
      '2L\t20524058\t2L_20524058\t2L\t20574058\t2L_20574058\t0.913\t0.987',
      header,
    )
    expect(record).toMatchObject({
      chrA: '2L',
      bpA: 20524058,
      snpB: '2L_20574058',
    })
    expect(record!.r2).toBeCloseTo(0.913)
    expect(record!.dprime).toBeCloseTo(0.987)
  })

  it("reads plink2's signed DPRIME as the magnitude the display draws", () => {
    const { header } = resolvePlinkLDHeader(
      '#CHROM_A\tPOS_A\tID_A\tNONMAJ_FREQ_A\tCHROM_B\tPOS_B\tID_B\tNONMAJ_FREQ_B\tPHASED_R2\tDPRIME',
    )
    const record = parsePlinkLDLine(
      '2\t135000000\ta\t0.45\t2\t135010000\tb\t0.5\t0.068\t-0.289',
      header,
    )
    expect(record!.dprime).toBeCloseTo(0.289)
    expect(record!.mafA).toBeCloseTo(0.45)
  })

  it('reads an --r2-unphased table too', () => {
    const { header } = resolvePlinkLDHeader(
      '#CHROM_A\tPOS_A\tID_A\tCHROM_B\tPOS_B\tID_B\tUNPHASED_R2',
    )
    const record = parsePlinkLDLine(
      '2\t135000000\ta\t2\t135010000\tb\t0.388',
      header,
    )
    expect(record!.r2).toBeCloseTo(0.388)
  })
})

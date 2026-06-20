import {
  getGeneticCode,
  ncbiGeneticCodes,
  parseTranslTable,
} from './geneticCodes.ts'
import { codonTable } from './seqUtils.ts'

describe('getGeneticCode', () => {
  it('table 1 matches the existing standard codonTable export', () => {
    // single source of truth guard: if either drifts, this fails
    expect(getGeneticCode(1).codonTable).toEqual(codonTable)
  })

  it('defaults to the standard code', () => {
    expect(getGeneticCode().id).toBe(1)
    expect(getGeneticCode(1).name).toBe('Standard')
  })

  it('standard code: ATG=M, TGA=stop, ATA=I', () => {
    const { codonTable: t } = getGeneticCode(1)
    expect(t.ATG).toBe('M')
    expect(t.TGA).toBe('*')
    expect(t.ATA).toBe('I')
  })

  it('vertebrate mitochondrial (2): TGA=W, ATA=M, AGA/AGG=stop', () => {
    const { codonTable: t } = getGeneticCode(2)
    expect(t.TGA).toBe('W')
    expect(t.ATA).toBe('M')
    expect(t.AGA).toBe('*')
    expect(t.AGG).toBe('*')
  })

  it('bacterial (11): standard residues but alternative start codons', () => {
    const code = getGeneticCode(11)
    expect(code.codonTable.TGA).toBe('*')
    // GTG/TTG are valid initiators in bacteria
    expect(code.starts).toEqual(expect.arrayContaining(['ATG', 'GTG', 'TTG']))
  })

  it('is case-insensitive (soft-masked sequence)', () => {
    expect(getGeneticCode(2).codonTable.tga).toBe('W')
  })

  it('falls back to the standard code for an unknown id', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getGeneticCode(999).codonTable.TGA).toBe('*')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('every NCBI table has 64-codon strings', () => {
    for (const t of ncbiGeneticCodes) {
      expect(t.ncbieaa).toHaveLength(64)
      expect(t.sncbieaa).toHaveLength(64)
      expect(
        Object.keys(getGeneticCode(t.id).codonTable).length,
      ).toBeGreaterThan(0)
    }
  })
})

describe('parseTranslTable', () => {
  it('parses a string value from the GFF adapter', () => {
    expect(parseTranslTable('2')).toBe(2)
  })
  it('parses the first element of a repeated attribute', () => {
    expect(parseTranslTable(['11'])).toBe(11)
  })
  it('returns undefined for missing or invalid values', () => {
    expect(parseTranslTable(undefined)).toBeUndefined()
    expect(parseTranslTable('')).toBeUndefined()
    expect(parseTranslTable('abc')).toBeUndefined()
    expect(parseTranslTable('0')).toBeUndefined()
  })
})

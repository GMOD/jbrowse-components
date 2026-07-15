import {
  getGeneticCode,
  ncbiGeneticCodes,
  parseTranslTable,
  relativizeTranslExcept,
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

describe('relativizeTranslExcept', () => {
  it('shifts forward-strand positions to feature-relative coords', () => {
    // absolute 1-based pos 107..109 -> 0-based half-open 106..109 -> minus the
    // feature start (100) -> 6..9
    expect(
      relativizeTranslExcept({
        raw: '(pos:107..109,aa:Sec)',
        featureStart: 100,
        featureLength: 30,
        strand: 1,
      }),
    ).toEqual([{ start: 6, end: 9, aa: 'U' }])
  })

  it('reverses minus-strand positions against the feature length', () => {
    // relative 6..9 reversed over length 30 -> 21..24
    expect(
      relativizeTranslExcept({
        raw: '(pos:107..109,aa:TERM)',
        featureStart: 100,
        featureLength: 30,
        strand: -1,
      }),
    ).toEqual([{ start: 21, end: 24, aa: '*' }])
  })

  it('strips NCBI complement() wrapper around minus-strand positions', () => {
    // genomic 1-based 107..109 inside complement() -> 0-based 106..109 -> minus
    // feature start (100) -> 6..9 -> reversed over length 30 -> 21..24
    expect(
      relativizeTranslExcept({
        raw: '(pos:complement(107..109),aa:Sec)',
        featureStart: 100,
        featureLength: 30,
        strand: -1,
      }),
    ).toEqual([{ start: 21, end: 24, aa: 'U' }])
  })

  it('strips an NCBI contig-accession prefix', () => {
    expect(
      relativizeTranslExcept({
        raw: '(pos:NC_000003.11:107..109,aa:Sec)',
        featureStart: 100,
        featureLength: 30,
        strand: 1,
      }),
    ).toEqual([{ start: 6, end: 9, aa: 'U' }])
  })

  it('strips both complement() wrapper and accession prefix together', () => {
    expect(
      relativizeTranslExcept({
        raw: '(pos:complement(NC_000003.11:107..109),aa:Sec)',
        featureStart: 100,
        featureLength: 30,
        strand: -1,
      }),
    ).toEqual([{ start: 21, end: 24, aa: 'U' }])
  })

  it('takes the first range of a join() split codon', () => {
    // a codon split across an intron: only the first base/range is needed since
    // every base of a codon maps to the same codon index after stitching
    expect(
      relativizeTranslExcept({
        raw: '(pos:join(107..108,140),aa:Sec)',
        featureStart: 100,
        featureLength: 60,
        strand: 1,
      }),
    ).toEqual([{ start: 6, end: 8, aa: 'U' }])
  })

  it('does not mistake accession digits for coordinates', () => {
    // NC_000003.11 contains the digits 000003/11 which must not be read as a pos
    expect(
      relativizeTranslExcept({
        raw: '(pos:NC_000003.11:107..109,aa:Sec)',
        featureStart: 100,
        featureLength: 30,
        strand: 1,
      }),
    ).toEqual([{ start: 6, end: 9, aa: 'U' }])
  })

  it('maps a standard 3-letter residue name to its 1-letter code', () => {
    // NCBI spells a substituted residue with its 3-letter name, e.g. the CUG
    // initiator of PTEN-L (NM_001304717) is `aa:Leu`. A 3-letter code must
    // collapse to a single character or it lengthens the protein string and
    // frame-shifts every downstream residue index.
    expect(
      relativizeTranslExcept({
        raw: '(pos:107..109,aa:Leu)',
        featureStart: 100,
        featureLength: 30,
        strand: 1,
      }),
    ).toEqual([{ start: 6, end: 9, aa: 'L' }])
  })

  it('passes an already-1-letter code through unchanged', () => {
    expect(
      relativizeTranslExcept({
        raw: '(pos:107..109,aa:W)',
        featureStart: 100,
        featureLength: 30,
        strand: 1,
      }),
    ).toEqual([{ start: 6, end: 9, aa: 'W' }])
  })

  it('maps the IUPAC ambiguity codes to single letters', () => {
    // Asx/Glx/Xle/Xaa are multi-character names that must collapse to B/Z/J/X
    const at = (aa: string) =>
      relativizeTranslExcept({
        raw: `(pos:107..109,aa:${aa})`,
        featureStart: 100,
        featureLength: 30,
        strand: 1,
      })[0]!.aa
    expect(at('Asx')).toBe('B')
    expect(at('Glx')).toBe('Z')
    expect(at('Xle')).toBe('J')
    expect(at('Xaa')).toBe('X')
  })

  it('degrades an unknown multi-character code to X (never frame-shifts)', () => {
    expect(
      relativizeTranslExcept({
        raw: '(pos:107..109,aa:Zzz)',
        featureStart: 100,
        featureLength: 30,
        strand: 1,
      }),
    ).toEqual([{ start: 6, end: 9, aa: 'X' }])
  })
})

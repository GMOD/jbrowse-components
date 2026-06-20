import {
  convertCodingSequenceToPeptides,
  translExceptProteinPositions,
} from './convertCodingSequenceToPeptides.ts'
import { getGeneticCode } from './geneticCodes.ts'

const codonTable = getGeneticCode(1).codonTable

// ATG AAA TGA TTT -> M K * F under the standard code; the TGA at position 6 is a
// stop that a transl_except can override (e.g. selenocysteine readthrough).
const sequence = 'ATGAAATGATTT'
const cds = [{ start: 0, end: sequence.length, phase: 0 }]

describe('translExceptProteinPositions', () => {
  it('maps a genomic position to its protein index (phase 0)', () => {
    const translExcept = [{ start: 6, end: 9, aa: 'U' }]
    expect([...translExceptProteinPositions({ cds, translExcept })]).toEqual([
      2,
    ])
  })

  it('shifts positions by the leading "&" when phase > 0', () => {
    // phase 1 drops the first base; the protein string is prefixed with '&', so
    // the codon at stitched position 1 (TGA-equivalent) lands one index later
    const phased = [{ start: 0, end: sequence.length, phase: 1 }]
    const translExcept = [{ start: 7, end: 10, aa: 'U' }]
    // stitched pos 7, phase 1 -> codonIdx floor((7-1)/3)=2, +1 for '&' = 3
    expect([
      ...translExceptProteinPositions({ cds: phased, translExcept }),
    ]).toEqual([3])
  })

  it('drops positions outside the CDS', () => {
    const translExcept = [{ start: 999, end: 1002, aa: 'U' }]
    expect(translExceptProteinPositions({ cds, translExcept }).size).toBe(0)
  })
})

describe('convertCodingSequenceToPeptides transl_except', () => {
  it('translates normally without overrides', () => {
    expect(convertCodingSequenceToPeptides({ cds, sequence, codonTable })).toBe(
      'MK*F',
    )
  })

  it('overrides the codon at the transl_except position', () => {
    const translExcept = [{ start: 6, end: 9, aa: 'U' }]
    const protein = convertCodingSequenceToPeptides({
      cds,
      sequence,
      codonTable,
      translExcept,
    })
    expect(protein).toBe('MKUF')
    // the highlighted index points at exactly the overridden residue
    const idx = [...translExceptProteinPositions({ cds, translExcept })][0]!
    expect(protein[idx]).toBe('U')
  })
})

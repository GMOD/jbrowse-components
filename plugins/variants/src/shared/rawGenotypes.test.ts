import { classifyGenotypeDosage } from './parseGenotypeDosage.ts'
import { encodeGenotypeFromRaw } from './rawGenotypes.ts'

function makeRaw(alleles: (number | null)[]): Int8Array {
  return new Int8Array(alleles.map(a => (a === null ? -1 : a)))
}

describe('encodeGenotypeFromRaw consistency with classifyGenotypeDosage', () => {
  describe('diploid', () => {
    // Each entry: [gt string, raw allele pair, expected dosage]
    test.each([
      ['0/0', [0, 0], 0],
      ['0|0', [0, 0], 0],
      ['0/1', [0, 1], 1],
      ['1/0', [1, 0], 1],
      ['1/1', [1, 1], 2],
      ['1|2', [1, 2], 2],
      ['./.', [null, null], -1],
      ['./1', [null, 1], 1], // was returning 2 before the fix
      ['0/.', [0, null], 0],
      ['1/.', [1, null], 1], // one called non-ref + one uncalled → het, not hom-alt
    ] as [string, (number | null)[], number][])(
      '%s → %i',
      (gt, alleles, expected) => {
        expect(encodeGenotypeFromRaw(makeRaw(alleles), 0, 2)).toBe(expected)
        expect(classifyGenotypeDosage(gt)).toBe(expected)
      },
    )
  })

  describe('triploid (polyploid coverage)', () => {
    // These cases exercised different code paths pre-fix:
    // old: nonRef===total-uncalled; new: nonRef===total
    test.each([
      ['0/0/0', [0, 0, 0], 0],
      ['1/1/1', [1, 1, 1], 2],
      ['0/1/0', [0, 1, 0], 1],
      ['./1/1', [null, 1, 1], 1], // was 2 before fix (nonRef=2, total-uncalled=2)
      ['1/1/.', [1, 1, null], 1], // was 2 before fix
      ['././.', [null, null, null], -1],
    ] as [string, (number | null)[], number][])(
      '%s → %i',
      (gt, alleles, expected) => {
        expect(encodeGenotypeFromRaw(makeRaw(alleles), 0, 3)).toBe(expected)
        expect(classifyGenotypeDosage(gt)).toBe(expected)
      },
    )
  })
})

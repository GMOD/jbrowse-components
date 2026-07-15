import { classifyGenotypeDosage } from './parseGenotypeDosage.ts'

describe('classifyGenotypeDosage', () => {
  test.each([
    ['0/0', 0],
    ['0|0', 0],
    ['0|0|0', 0],
    ['0', 0],
    ['0/1', 1],
    ['0|1', 1],
    ['1|0', 1],
    ['1|2', 2],
    ['1/1', 2],
    ['1|1|1', 2],
    ['1', 2],
    ['./.', -1],
    ['.', -1],
    ['.|.', -1],
    ['.|.|.', -1],
    ['', -1],
    // mixed called/uncalled: matches legacy split-based logic. A single
    // called ref allele alongside an uncalled allele counts as ref (0)
    // because nonRef === 0; a called non-ref allele flips it to het (1).
    ['./1', 1],
    ['0/.', 0],
    // multi-character allele indices
    ['0/10', 1],
    ['10|10', 2],
    ['10|0', 1],
    ['0/100/0', 1],
  ])('classify %p -> %i', (input, expected) => {
    expect(classifyGenotypeDosage(input)).toBe(expected)
  })

  test('matches the legacy split-based logic for typical genotypes', () => {
    const SPLITTER = /[|/]/
    const reference = (val: string) => {
      const alleles = val.split(SPLITTER)
      let nonRef = 0
      let uncalled = 0
      for (const a of alleles) {
        if (a === '.') {
          uncalled++
        } else if (a !== '0') {
          nonRef++
        }
      }
      if (uncalled === alleles.length) {
        return -1
      }
      if (nonRef === 0) {
        return 0
      }
      if (nonRef === alleles.length) {
        return 2
      }
      return 1
    }
    const samples = [
      '0/0',
      '0|1',
      '1/1',
      './.',
      '0/.',
      '1|2',
      '0|0|0',
      '1|0|1',
      './1',
    ]
    for (const s of samples) {
      expect(classifyGenotypeDosage(s)).toBe(reference(s))
    }
  })
})

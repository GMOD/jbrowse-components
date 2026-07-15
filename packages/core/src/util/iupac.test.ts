import { isPalindromic, iupacToRegex, reverseComplementIupac } from './iupac.ts'

test('iupacToRegex expands ambiguity codes', () => {
  expect(iupacToRegex('NGG')).toBe('[ACGT]GG')
  expect(iupacToRegex('TTTV')).toBe('TTT[ACG]')
})

test('reverseComplementIupac reverse-complements a motif', () => {
  // revcomp(NGG) = CCN
  expect(reverseComplementIupac('NGG')).toBe('CCN')
  // revcomp(TTTV) = B AAA (V->B, reversed)
  expect(reverseComplementIupac('TTTV')).toBe('BAAA')
})

test('isPalindromic recognizes restriction sites that read the same on both strands', () => {
  expect(isPalindromic('GAATTC')).toBe(true)
  expect(isPalindromic('GCGGCCGC')).toBe(true)
  // ambiguity codes still resolve: revcomp(GGTNACC) = GGTNACC
  expect(isPalindromic('GGTNACC')).toBe(true)
  expect(isPalindromic('NGG')).toBe(false)
  expect(isPalindromic('GGTCTC')).toBe(false)
})

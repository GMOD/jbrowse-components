import {
  getMismatches,
  cigarToMismatches,
  parseCigar,
  mdToMismatches,
} from './MismatchParser'

test('cigar to mismatches', () => {
  expect(
    cigarToMismatches(
      parseCigar('56M1D45M'),
      'AAAAAAAAAAAAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT',
    ),
  ).toEqual([{ start: 56, type: 'deletion', base: '*', length: 1 }])
})

test('md to mismatches', () => {
  const cigarMismatches = cigarToMismatches(
    parseCigar('56M1D45M'),
    'AAAAAAAAAAAAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT',
  )
  expect(
    mdToMismatches(
      '10A80',
      parseCigar('56M1D45M'),
      cigarMismatches,
      'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT',
    ),
  ).toEqual([
    { start: 10, type: 'mismatch', base: 'C', altbase: 'A', length: 1 },
  ])
})

test('get mismatches', () => {
  expect(
    getMismatches(
      '56M1D45M',
      '10A80',
      'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT',
    ),
  ).toEqual([
    { start: 56, type: 'deletion', base: '*', length: 1 },
    { start: 10, type: 'mismatch', base: 'C', altbase: 'A', length: 1 },
  ])
})

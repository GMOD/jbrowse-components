import { cigarToMismatches, parseCigar } from './MismatchParser'

test('cigar to mismatches', () => {
  expect(
    cigarToMismatches(
      parseCigar('56M1D45M'),
      'AAAAAAAAAAAAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT',
    ),
  ).toEqual([{ start: 56, type: 'deletion', base: '*', length: 1 }])
})

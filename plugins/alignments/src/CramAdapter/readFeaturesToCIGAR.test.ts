import { numericCigarToString } from '@jbrowse/cigar-utils'

import { readFeaturesToNumericCIGAR } from './readFeaturesToNumericCIGAR.ts'

test('cram read features to CIGAR', () => {
  expect(
    // from ctgA_15140_15565_0:0:1_1:0:0_2e8 in volvox-sorted.cram
    numericCigarToString(
      readFeaturesToNumericCIGAR(
        [{ code: 'i', data: 'C', pos: 25, refPos: 15164 }],
        15140,
        100,
      ),
    ),
  ).toMatchSnapshot()
})

test("'b' verbatim bases align as matches (one M column per base)", () => {
  // Documents 'b' semantics: data is a decoded base string ("ACGT" = 4 match
  // columns), then a 2bp deletion, then 6 trailing matches to fill readLength.
  expect(
    numericCigarToString(
      readFeaturesToNumericCIGAR(
        [
          { code: 'b', data: 'ACGT', pos: 1, refPos: 1 },
          { code: 'D', data: 2, pos: 5, refPos: 5 },
        ],
        1,
        10,
      ),
    ),
  ).toBe('4M2D6M')
})

test('trailing single-base insertions are not dropped when remaining=0', () => {
  // 3M then two 'i' insertions consuming all readLen=5 bases → remaining=0
  // bug: original `if (remaining && insLen)` silently dropped the insertions
  expect(
    numericCigarToString(
      readFeaturesToNumericCIGAR(
        [
          { code: 'i', data: 'A', pos: 3, refPos: 3 },
          { code: 'i', data: 'C', pos: 4, refPos: 3 },
        ],
        0,
        5,
      ),
    ),
  ).toBe('3M2I')
})

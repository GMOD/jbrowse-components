import {
  CIGAR_HAS_SKIP,
  CIGAR_HAS_SV_DELETION,
  CIGAR_HAS_SV_INSERTION,
  cigarStringCategoryBits,
  numericCigarCategoryBits,
} from './cigarCategoryBits.ts'
import { parseCigar2 } from './mismatchParser.ts'

// A short CIGAR takes the branching scan and a long one the branch-free scan,
// so each case runs at both lengths.
const CASES: [string, number][] = [
  ['100M', 0],
  ['50M49D50M', 0],
  ['50M49I50M', 0],
  ['50M50D50M', CIGAR_HAS_SV_DELETION],
  ['50M50I50M', CIGAR_HAS_SV_INSERTION],
  ['50M500N50M', CIGAR_HAS_SKIP],
  ['10M60I10M70D10M', CIGAR_HAS_SV_DELETION | CIGAR_HAS_SV_INSERTION],
]

const long = (cigar: string) => `${'1M1I'.repeat(20)}${cigar}`

describe.each(CASES)('%s', (cigar, bits) => {
  test.each([cigar, long(cigar)])('%s: both scans agree', c => {
    expect(cigarStringCategoryBits(c)).toBe(bits)
    expect(numericCigarCategoryBits(parseCigar2(c))).toBe(bits)
  })
})

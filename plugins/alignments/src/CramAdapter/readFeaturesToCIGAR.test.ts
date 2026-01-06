import { readFeaturesToNumericCIGAR } from './readFeaturesToNumericCIGAR.ts'

// CIGAR operation index to char code mapping (from @gmod/bam)
const NUMERIC_CIGAR_CODES = [
  77, 73, 68, 78, 83, 72, 80, 61, 88, 63, 63, 63, 63, 63, 63, 63,
]

function numericCigarToString(numeric: ArrayLike<number>): string {
  let result = ''
  for (let i = 0, l = numeric.length; i < l; i++) {
    const packed = numeric[i]!
    const length = packed >> 4
    const opCode = NUMERIC_CIGAR_CODES[packed & 0xf]!
    result += length + String.fromCharCode(opCode)
  }
  return result
}

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

import { getModProbabilityBytes } from '@jbrowse/modifications-utils'

import SamRecordFeature from './SamRecordFeature.ts'
import { parseSamLine } from './parseSam.ts'

function feature(tags: string) {
  return new SamRecordFeature(
    parseSamLine(`read1\t0\tctgA\t101\t60\t4M\t*\t0\t0\tACGT\tIIII\t${tags}`),
    'read1',
  )
}

// The ML probabilities a SAM record's `B` array holds, without its subtype
// letter, read through the accessor the render path calls.
test('ML probabilities survive the SAM text round trip', () => {
  const bytes = getModProbabilityBytes(
    feature('MM:Z:C+m?,0;\tML:B:C,251,0,128'),
  )
  expect(Array.from(bytes!)).toEqual([251, 0, 128])
})

test('a single-element ML array is not mistaken for its subtype', () => {
  const bytes = getModProbabilityBytes(feature('MM:Z:C+m?,0;\tML:B:C,200'))
  expect(Array.from(bytes!)).toEqual([200])
})

import { buildReadVsRefFeatures } from '@jbrowse/cigar-utils'

import { formatEndLocation, formatStartLocation } from '../shared/locStrings.ts'
import { splitReadJunctions } from './splitReadJunctions.ts'

// One 150 bp read: its first 100 bases map to chr1, the last 50 to chr5 on the
// plus strand, so the molecule crosses one junction, from chr1 into chr5.
function readSplitAt(primaryStrand: 1 | -1) {
  return buildReadVsRefFeatures({
    uniqueId: 'r',
    name: 'r',
    refName: 'chr1',
    start: 1000,
    end: 1100,
    strand: primaryStrand,
    CIGAR: primaryStrand === 1 ? '100M50S' : '50S100M',
    flags: 0,
    tags: { SA: 'chr5,20001,+,100S50M,60,0;' },
  }).features
}

test('a plus-strand record lists the junction as the read crosses it', () => {
  const [junction] = splitReadJunctions(readSplitAt(1), 1)
  expect(junction!.from).toBe(formatEndLocation('chr1', 1100))
  expect(junction!.to).toBe(formatStartLocation('chr5', 20000))
})

test('a minus-strand record lists the same junction the same way round', () => {
  const [junction] = splitReadJunctions(readSplitAt(-1), -1)
  // read order: the chr1 segment first, left by its low edge since it maps to
  // the minus strand, then into the chr5 segment at its low edge
  expect(junction!.from).toBe(formatStartLocation('chr1', 1000))
  expect(junction!.to).toBe(formatStartLocation('chr5', 20000))
  // and the segments handed to the split-view launcher carry their real
  // mapping strands rather than the record-relative ones
  expect([junction!.f1.strand, junction!.f2.strand]).toEqual([-1, 1])
})

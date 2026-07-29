import { parseSupplementaryAlignment } from './parseSupplementaryAlignment.ts'

// SA positions are 1-based and locstrings are 1-based inclusive, so a 100M
// record starting at 1000 ends at 1099 — the same final base featurizeSA names
// as the 0-based half-open [999, 1099).
test('parses a full SA record with padded locstring and label', () => {
  expect(parseSupplementaryAlignment('chr1,1000,+,100M,60,3')).toEqual({
    locString: 'chr1:980-1119',
    label: 'chr1:1,000-1,099 (+) [100bp] MAPQ:60 NM:3',
  })
})

test('omits MAPQ/NM segments when absent', () => {
  expect(parseSupplementaryAlignment('chr2,50,-,10M')).toEqual({
    locString: 'chr2:48-61',
    label: 'chr2:50-59 (-) [10bp]',
  })
})

// The displayed span is the CIGAR's length on the reference, never one more.
test('label spans exactly the reference length, including indels', () => {
  expect(parseSupplementaryAlignment('chr1,101,+,10M5D10M')?.label).toBe(
    'chr1:101-125 (+) [25bp]',
  )
  expect(parseSupplementaryAlignment('chr1,101,+,5S20M5S')?.label).toBe(
    'chr1:101-120 (+) [20bp]',
  )
})

test('clamps padded start to 1', () => {
  expect(parseSupplementaryAlignment('chr1,5,+,100M,60,0')?.locString).toBe(
    'chr1:1-124',
  )
})

test('returns undefined when a required field is missing', () => {
  expect(parseSupplementaryAlignment('chr1,1000')).toBeUndefined()
})

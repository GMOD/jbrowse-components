import { parseSupplementaryAlignment } from './parseSupplementaryAlignment.ts'

test('parses a full SA record with padded locstring and label', () => {
  expect(parseSupplementaryAlignment('chr1,1000,+,100M,60,3')).toEqual({
    locString: 'chr1:980-1120',
    label: 'chr1:1,000-1,100 (+) [100bp] MAPQ:60 NM:3',
  })
})

test('omits MAPQ/NM segments when absent', () => {
  expect(parseSupplementaryAlignment('chr2,50,-,10M')).toEqual({
    locString: 'chr2:48-62',
    label: 'chr2:50-60 (-) [10bp]',
  })
})

test('clamps padded start to 1', () => {
  expect(parseSupplementaryAlignment('chr1,5,+,100M,60,0')?.locString).toBe(
    'chr1:1-125',
  )
})

test('returns undefined when a required field is missing', () => {
  expect(parseSupplementaryAlignment('chr1,1000')).toBeUndefined()
})

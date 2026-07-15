import { pslToFeatures } from './blatQuery.ts'

// real shape of a UCSC hgBlat output=json response
const response = {
  track: 'blat',
  genome: 'hg38',
  fields: [
    'matches',
    'misMatches',
    'repMatches',
    'nCount',
    'qNumInsert',
    'qBaseInsert',
    'tNumInsert',
    'tBaseInsert',
    'strand',
    'qName',
    'qSize',
    'qStart',
    'qEnd',
    'tName',
    'tSize',
    'tStart',
    'tEnd',
    'blockCount',
    'blockSizes',
    'qStarts',
    'tStarts',
  ],
  blat: [
    [
      133,
      13,
      0,
      0,
      0,
      0,
      0,
      0,
      '+',
      'YourSeq',
      147,
      1,
      147,
      'chr6',
      170805979,
      34345901,
      34346047,
      1,
      '146',
      '1',
      '34345901',
    ],
    [
      140,
      5,
      0,
      0,
      1,
      1,
      2,
      137,
      '-',
      'YourSeq',
      147,
      1,
      147,
      'chr17',
      83257441,
      17301795,
      17302077,
      3,
      '31,101,13',
      '0,32,133',
      '17301795,17301832,17302064',
    ],
  ],
}

test('parses a single-block PSL hit', () => {
  const features = pslToFeatures(response)
  const f = features[0]!
  expect(f.refName).toBe('chr6')
  expect(f.start).toBe(34345901)
  expect(f.end).toBe(34346047)
  expect(f.strand).toBe(1)
  expect(f.subfeatures).toHaveLength(1)
  expect(f.subfeatures![0]).toMatchObject({
    refName: 'chr6',
    start: 34345901,
    end: 34346047,
  })
})

test('parses a multi-block hit with trailing-comma block lists', () => {
  const features = pslToFeatures(response)
  const f = features[1]!
  expect(f.refName).toBe('chr17')
  expect(f.strand).toBe(-1)
  expect(f.subfeatures).toHaveLength(3)
  expect(f.subfeatures!.map(s => [s.start, s.end])).toEqual([
    [17301795, 17301826],
    [17301832, 17301933],
    [17302064, 17302077],
  ])
})

test('computes percent identity into the name', () => {
  const [f] = pslToFeatures(response)
  // 133 matches / (133 + 13) = 91.1%
  expect(f!.name).toBe('YourSeq 91.1%')
  expect(f!.identity).toBe(91.1)
})

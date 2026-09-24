import { SimpleFeature } from '@jbrowse/core/util'

import { impliedUTRs } from './impliedUTRs.ts'

function transcript(
  subs: { type: string; start: number; end: number }[],
  { start = 100, end = 500, strand = 1 } = {},
) {
  return new SimpleFeature({
    uniqueId: 'tx',
    refName: 'chr1',
    type: 'mRNA',
    start,
    end,
    strand,
    subfeatures: subs.map((s, i) => ({
      ...s,
      refName: 'chr1',
      uniqueId: `sub${i}`,
    })),
  })
}

const spans = (tx: SimpleFeature) =>
  impliedUTRs(tx).map(u => [u.start, u.end, u.type, u.source.id()])

test('each exon gives up its overhang past the outer CDS bounds', () => {
  expect(
    spans(
      transcript([
        { type: 'exon', start: 100, end: 160 },
        { type: 'exon', start: 300, end: 400 },
        { type: 'CDS', start: 140, end: 160 },
        { type: 'CDS', start: 300, end: 380 },
      ]),
    ),
  ).toEqual([
    [100, 140, 'five_prime_UTR', 'sub0'],
    [380, 400, 'three_prime_UTR', 'sub1'],
  ])
})

test('with no exons the transcript bounds are the evidence, at the ends only', () => {
  expect(
    spans(
      transcript(
        [
          { type: 'CDS', start: 120, end: 150 },
          { type: 'CDS', start: 170, end: 200 },
        ],
        { start: 80, end: 240 },
      ),
    ),
  ).toEqual([
    [80, 120, 'five_prime_UTR', 'tx'],
    [200, 240, 'three_prime_UTR', 'tx'],
  ])
})

test('the minus strand names the left end three prime', () => {
  expect(
    spans(
      transcript(
        [
          { type: 'exon', start: 100, end: 500 },
          { type: 'CDS', start: 200, end: 400 },
        ],
        { strand: -1 },
      ),
    ).map(u => u[2]),
  ).toEqual(['three_prime_UTR', 'five_prime_UTR'])
})

test('a side a UTR row covers implies nothing, and the other side still fills', () => {
  expect(
    spans(
      transcript([
        { type: 'five_prime_UTR', start: 100, end: 200 },
        { type: 'CDS', start: 200, end: 400 },
        { type: 'exon', start: 100, end: 500 },
      ]),
    ),
  ).toEqual([[400, 500, 'three_prime_UTR', 'sub2']])
})

test('with no exons, the uncovered end fills from the transcript bounds', () => {
  expect(
    spans(
      transcript(
        [
          { type: 'five_prime_UTR', start: 0, end: 50 },
          { type: 'CDS', start: 50, end: 100 },
          { type: 'CDS', start: 400, end: 450 },
        ],
        { start: 0, end: 500 },
      ),
    ),
  ).toEqual([[450, 500, 'three_prime_UTR', 'tx']])
})

test('a transcript naming both UTRs implies none', () => {
  expect(
    spans(
      transcript([
        { type: 'five_prime_UTR', start: 100, end: 200 },
        { type: 'CDS', start: 200, end: 400 },
        { type: 'three_prime_UTR', start: 400, end: 500 },
        { type: 'exon', start: 100, end: 500 },
      ]),
    ),
  ).toEqual([])
})

test('a non-coding transcript implies none', () => {
  expect(spans(transcript([{ type: 'exon', start: 100, end: 500 }]))).toEqual(
    [],
  )
})

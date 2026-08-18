import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { stringifyBedGraph } from './bedGraph.ts'

function feat(data: {
  refName: string
  start: number
  end: number
  score?: number
  source?: string
}) {
  return new SimpleFeature({
    uniqueId: `${data.refName}-${data.start}-${data.source ?? ''}`,
    ...data,
  })
}

test('writes the bare four columns for a single-file track', () => {
  expect(
    stringifyBedGraph({
      features: [
        feat({ refName: 'ctgA', start: 0, end: 100, score: 5 }),
        feat({ refName: 'ctgA', start: 100, end: 200, score: 7 }),
      ],
    }),
  ).toBe('ctgA\t0\t100\t5\nctgA\t100\t200\t7')
})

test('a missing score writes as zero rather than as undefined', () => {
  expect(
    stringifyBedGraph({
      features: [feat({ refName: 'ctgA', start: 0, end: 10 })],
    }),
  ).toBe('ctgA\t0\t10\t0')
})

// BigWigAdapter's `source` slot defaults to '', so a plain quantitative track
// takes the no-track-line path above rather than emitting name=""
test('an empty source is no source', () => {
  expect(
    stringifyBedGraph({
      features: [
        feat({ refName: 'ctgA', start: 0, end: 10, score: 1, source: '' }),
      ],
    }),
  ).toBe('ctgA\t0\t10\t1')
})

// A multi-wiggle's subtracks are read concurrently, so its features arrive
// interleaved. Without the track lines the export was one pile of overlapping
// intervals with nothing saying which file each came from.
test('groups a multi-wiggle export into one track block per source', () => {
  const out = stringifyBedGraph({
    features: [
      feat({ refName: 'ctgA', start: 0, end: 10, score: 1, source: 'a.bw' }),
      feat({ refName: 'ctgA', start: 0, end: 10, score: 2, source: 'b.bw' }),
      feat({ refName: 'ctgA', start: 10, end: 20, score: 3, source: 'a.bw' }),
    ],
  })
  expect(out.split('\n')).toEqual([
    'track type=bedGraph name="a.bw"',
    'ctgA\t0\t10\t1',
    'ctgA\t10\t20\t3',
    'track type=bedGraph name="b.bw"',
    'ctgA\t0\t10\t2',
  ])
})

// the track line delimits its name with double quotes and defines no escape
test('a quote in a source name cannot break out of the track line', () => {
  expect(
    stringifyBedGraph({
      features: [
        feat({
          refName: 'ctgA',
          start: 0,
          end: 10,
          score: 1,
          source: 'a "b" c',
        }),
      ],
    }).split('\n')[0],
  ).toBe(`track type=bedGraph name="a 'b' c"`)
})

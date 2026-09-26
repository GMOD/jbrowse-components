import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { scoreText, stringifyBedGraph } from './bedGraph.ts'

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

test('a float32 score writes as the decimal the file held', () => {
  const f32 = new Float32Array([0.3, 1e-7, 123456.7, 2.5])
  expect([...f32].map(scoreText)).toEqual(['0.3', '1e-7', '123456.7', '2.5'])
  expect(scoreText(0.1)).toBe('0.1')
  expect(scoreText(Math.PI)).toBe(`${Math.PI}`)
  expect(scoreText(Number.NaN)).toBe('NaN')
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
// interleaved by subtrack and by region.
test('writes a multi-wiggle export as one sorted table with a source column', () => {
  const out = stringifyBedGraph({
    features: [
      feat({ refName: 'ctgB', start: 0, end: 10, score: 4, source: 'a' }),
      feat({ refName: 'ctgA', start: 10, end: 20, score: 3, source: 'a' }),
      feat({ refName: 'ctgB', start: 0, end: 10, score: 5, source: 'b' }),
      feat({ refName: 'ctgA', start: 0, end: 10, score: 2, source: 'b' }),
    ],
  })
  expect(out.split('\n')).toEqual([
    '#chrom\tstart\tend\tscore\tsource',
    'ctgB\t0\t10\t4\ta',
    'ctgB\t0\t10\t5\tb',
    'ctgA\t0\t10\t2\tb',
    'ctgA\t10\t20\t3\ta',
  ])
})

test('a tab in a source name cannot shift the columns', () => {
  expect(
    stringifyBedGraph({
      features: [
        feat({ refName: 'ctgA', start: 0, end: 10, score: 1, source: 'a\tb' }),
      ],
    }).split('\n')[1],
  ).toBe('ctgA\t0\t10\t1\ta b')
})

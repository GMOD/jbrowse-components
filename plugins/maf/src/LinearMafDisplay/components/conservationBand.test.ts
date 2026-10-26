import { conservationBarAt, encodeConservation } from './conservationBand.ts'
import { emptyMafCoverage } from './coverageTestFixture.ts'

function bars(scores: number[], binBp: number, start = 100) {
  const b = encodeConservation(
    {
      ...emptyMafCoverage(start),
      identityScores: Float32Array.from(scores),
      coverageStartPos: start,
    },
    binBp,
    0,
  )
  return Array.from({ length: b.count }, (_, i) => [b.x[i], b.x2[i], b.y[i]])
}

test('one base a bar, adjacent equal values merged', () => {
  expect(bars([1, 1, 0.5, 1], 1)).toEqual([
    [100, 102, 1],
    [102, 103, 0.5],
    [103, 104, 1],
  ])
})

test('a window averages every base in it', () => {
  expect(bars([1, 0.5, 1, 0.5, 1, 1, 1, 1], 4)).toEqual([
    [100, 104, 0.75],
    [104, 108, 1],
  ])
})

test('NaN bases are skipped, and a window spans the bases it averaged', () => {
  expect(bars([Number.NaN, 1, 1, Number.NaN], 4)).toEqual([[101, 103, 1]])
})

test('windows sit at absolute multiples of binBp', () => {
  expect(bars([1, 1, 0, 0], 4, 102)).toEqual([
    [102, 104, 1],
    [104, 106, 0],
  ])
})

test('an unclassifiable stretch breaks a run of one value', () => {
  expect(bars([1, Number.NaN, 1], 1)).toEqual([
    [100, 101, 1],
    [102, 103, 1],
  ])
})

// The hover reads the bar the band paints, so a base inside a window answers
// the window's mean rather than its own score.
test('the bar under a base is the window it was averaged into', () => {
  const b = encodeConservation(
    {
      ...emptyMafCoverage(100),
      identityScores: Float32Array.from([1, 0.5, 1, 0.5, 1, 1, 1, 1]),
      coverageStartPos: 100,
    },
    4,
    0,
  )
  expect(conservationBarAt(b, 101)).toEqual({
    start: 100,
    end: 104,
    identity: 0.75,
  })
  expect(conservationBarAt(b, 108)).toBeUndefined()
})

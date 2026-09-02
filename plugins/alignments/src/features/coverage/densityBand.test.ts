import { densityCoverageFields } from './densityBand.ts'

function density(intervals: [start: number, end: number, score: number][]) {
  return {
    starts: Uint32Array.from(intervals.map(i => i[0])),
    ends: Uint32Array.from(intervals.map(i => i[1])),
    scores: Float32Array.from(intervals.map(i => i[2])),
  }
}

// The binning itself is `packDensityRegion`'s, tested beside it in
// alignments-core; this is the coverage band's view of the result
test('the packed region travels as the coverage band\'s own fields', () => {
  const fields = densityCoverageFields(density([[0, 100, 50]]), 10)
  expect(fields.coverageBinSize).toBe(10)
  expect(fields.coverageMaxDepth).toBe(50)
  expect(fields.coveragePackedBuffer.byteLength).toBe(10 * 8)
})

test('a source with nothing in it packs no records', () => {
  const fields = densityCoverageFields(density([]), 10)
  expect(fields.coverageMaxDepth).toBe(0)
  expect(fields.coveragePackedBuffer.byteLength).toBe(0)
})

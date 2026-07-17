import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'

test('rows in `sources` order; color→ordinal; gaps are -1', () => {
  const matrix = buildMultiRowMatrix({
    sources: ['s1', 's2', 's3'],
    regions: [{ start: 0, end: 10 }],
    maxBins: 4, // midpoints at 1.25, 3.75, 6.25, 8.75
    features: [
      { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'red' },
      { regionIndex: 0, row: 's2', start: 0, end: 5, colorKey: 'blue' },
      // s3 has no features
    ],
  })
  // s1 covered everywhere → its color (first seen) is index 0
  expect(matrix[0]).toEqual([0, 0, 0, 0])
  // s2 covered only in the first half (bins 0,1) with a distinct color (index 1)
  expect(matrix[1]).toEqual([1, 1, -1, -1])
  // s3 absent → all gaps
  expect(matrix[2]).toEqual([-1, -1, -1, -1])
})

test('later feature on a row wins the bin (paint order)', () => {
  const [row] = buildMultiRowMatrix({
    sources: ['s1'],
    regions: [{ start: 0, end: 10 }],
    maxBins: 2, // midpoints at 2.5, 7.5
    features: [
      { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'a' }, // a → 0
      { regionIndex: 0, row: 's1', start: 0, end: 5, colorKey: 'b' }, // b → 1, overrides bin 0
    ],
  })
  expect(row).toEqual([1, 0])
})

test('bins split across regions proportional to width', () => {
  const matrix = buildMultiRowMatrix({
    sources: ['s1'],
    regions: [
      { start: 0, end: 10 },
      { start: 100, end: 110 },
    ],
    maxBins: 4, // 2 bins per equal-width region
    features: [{ regionIndex: 1, row: 's1', start: 100, end: 110, colorKey: 'x' }],
  })
  // first region uncovered (-1,-1), second region covered (0,0)
  expect(matrix[0]).toEqual([-1, -1, 0, 0])
})

test('features only cover bins in their own region (same-coord chromosomes)', () => {
  const matrix = buildMultiRowMatrix({
    sources: ['s1', 's2'],
    // two regions with the SAME genomic coords, e.g. chr1:0-10 and chr2:0-10
    regions: [
      { start: 0, end: 10 },
      { start: 0, end: 10 },
    ],
    maxBins: 4, // 2 bins per region
    features: [
      // s1 has a feature only in region 0, s2 only in region 1
      { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'blue' },
      { regionIndex: 1, row: 's2', start: 0, end: 10, colorKey: 'red' },
    ],
  })
  // s1 covers its own region's bins only; region 1's bins are gaps
  expect(matrix[0]).toEqual([0, 0, -1, -1])
  // s2 covers region 1's bins only; region 0's bins are gaps
  expect(matrix[1]).toEqual([-1, -1, 1, 1])
})

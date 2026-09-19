import {
  MAX_CATEGORICAL_VALUES,
  buildMultiRowMatrix,
} from './buildMultiRowMatrix.ts'

import type { MatrixFeature } from './buildMultiRowMatrix.ts'

// Reads the matrix positionally, which asserts its `sources` key order as a
// side effect.
function buildRows(args: Parameters<typeof buildMultiRowMatrix>[0]) {
  return [...buildMultiRowMatrix(args).rows.values()].map(row => [...row])
}

const dist = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]!))

function feature(
  row: string,
  start: number,
  end: number,
  value = '',
  regionIndex = 0,
): MatrixFeature {
  return { regionIndex, row, start, end, value }
}

describe('presence: one channel per bin', () => {
  test('an empty clusterField marks the bins each row covers', () => {
    const matrix = buildRows({
      sources: ['s1', 's2', 's3'],
      regions: [{ start: 0, end: 10 }],
      clusterField: '',
      maxBins: 4, // midpoints at 1.25, 3.75, 6.25, 8.75
      features: [
        feature('s1', 0, 10, 'ignored'),
        feature('s2', 0, 5, 'ignored'),
      ],
    })
    expect(matrix[0]).toEqual([1, 1, 1, 1])
    expect(matrix[1]).toEqual([1, 1, 0, 0])
    expect(matrix[2]).toEqual([0, 0, 0, 0])
  })

  test('a field whose every value is empty falls back to presence', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'state',
      maxBins: 2,
      features: [feature('s1', 0, 5)],
    })
    expect(row).toEqual([1, 0])
  })

  test('a feature between two midpoints covers nothing', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      clusterField: '',
      maxBins: 2, // midpoints at 2.5, 7.5
      features: [feature('s1', 4, 6)],
    })
    expect(row).toEqual([0, 0])
  })

  test('a feature hanging off either end covers the bins it reaches', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      clusterField: '',
      maxBins: 4,
      features: [feature('s1', -100, 7)],
    })
    expect(row).toEqual([1, 1, 1, 0])
  })
})

describe('scalar: the mean over each bin', () => {
  test('numeric values become one channel per bin, uncovered 0', () => {
    const matrix = buildRows({
      sources: ['s1', 's2'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'segmean',
      maxBins: 4,
      features: [feature('s1', 0, 10, '2.5'), feature('s2', 0, 5, '-1')],
    })
    expect(matrix[0]).toEqual([2.5, 2.5, 2.5, 2.5])
    expect(matrix[1]).toEqual([-1, -1, 0, 0])
  })

  test('several features in a bin average rather than last-wins', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'segmean',
      maxBins: 2, // midpoints at 2.5, 7.5
      features: [feature('s1', 0, 10, '1'), feature('s1', 0, 5, '3')],
    })
    expect(row).toEqual([2, 1])
  })

  test('a feature with no value contributes nothing to its bins', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'segmean',
      maxBins: 2,
      features: [feature('s1', 0, 10, ''), feature('s1', 0, 5, '4')],
    })
    expect(row).toEqual([4, 0])
  })

  test('one non-numeric value puts the whole field on the categorical path', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'segmean',
      maxBins: 1,
      features: [feature('s1', 0, 10, '1'), feature('other', 0, 10, 'NA')],
    })
    // Two distinct values plus the gap slot.
    expect(row).toHaveLength(3)
  })
})

describe('categorical: one channel per distinct value', () => {
  test('three values are equidistant', () => {
    const [enh, tss, quies] = buildRows({
      sources: ['enh', 'tss', 'quies'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'state',
      maxBins: 2,
      features: [
        feature('enh', 0, 10, 'Enhancer'),
        feature('tss', 0, 10, 'TSS'),
        feature('quies', 0, 10, 'Quiescent'),
      ],
    })
    expect(dist(enh!, tss!)).toBeCloseTo(dist(enh!, quies!))
    expect(dist(enh!, quies!)).toBeCloseTo(dist(tss!, quies!))
  })

  test('each bin is a one-hot over the values plus a gap slot', () => {
    const [s1, s2] = buildRows({
      sources: ['s1', 's2'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'state',
      maxBins: 4,
      features: [feature('s1', 0, 10, 'A'), feature('s2', 0, 5, 'B')],
    })
    const channels = 3
    expect(s1).toHaveLength(4 * channels)
    for (let bin = 0; bin < 4; bin++) {
      const slice = s1!.slice(bin * channels, (bin + 1) * channels)
      expect(slice.filter(v => v === 1)).toHaveLength(1)
      expect(slice.filter(v => v === 0)).toHaveLength(channels - 1)
    }
    expect(dist(s1!, s2!)).toBeCloseTo(Math.sqrt(2 * 4))
  })

  test('distance counts mismatched bins', () => {
    const [same, oneOff] = buildRows({
      sources: ['same', 'oneOff'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'state',
      maxBins: 4, // midpoints 1.25, 3.75, 6.25, 8.75
      features: [
        feature('same', 0, 10, 'A'),
        feature('oneOff', 0, 10, 'A'),
        feature('oneOff', 8, 10, 'B'),
      ],
    })
    expect(dist(same!, oneOff!)).toBeCloseTo(Math.sqrt(2 * 1))
  })

  test('absent is a category: two absent rows agree', () => {
    const [painted, absentA, absentB] = buildRows({
      sources: ['painted', 'absentA', 'absentB'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'state',
      maxBins: 2,
      features: [feature('painted', 0, 10, 'A'), feature('other', 0, 10, 'B')],
    })
    expect(dist(absentA!, absentB!)).toBe(0)
    expect(dist(painted!, absentA!)).toBeCloseTo(2)
  })

  test('later feature on a row wins the bin (paint order)', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      clusterField: 'state',
      maxBins: 2, // midpoints at 2.5, 7.5
      features: [feature('s1', 0, 10, 'A'), feature('s1', 0, 5, 'B')],
    })
    // Slots are A, B, gap: the first bin took B, the second kept A.
    expect(row).toEqual([0, 1, 0, 1, 0, 0])
  })
})

describe('the width budget', () => {
  test('a wide vocabulary buys its channels out of the bins', () => {
    const build = (numValues: number) =>
      buildRows({
        sources: ['s1'],
        regions: [{ start: 0, end: 1000 }],
        clusterField: 'state',
        maxCells: 100,
        features: Array.from({ length: numValues }, (_, i) =>
          feature(`row${i}`, 0, 1000, `v${i}`),
        ),
      })
    // 4 values + gap = 5 channels, so 20 bins; 9 + gap = 10 channels, 10 bins.
    expect(build(4)[0]).toHaveLength(100)
    expect(build(9)[0]).toHaveLength(100)
  })

  test('a vocabulary past the categorical bound measures coverage, within budget', () => {
    // Under the auto pick `name` reaches here near-unique per feature; a
    // one-hot over it is `channels` wide per bin, and two regions apiece
    // holding at least one bin put a whole-genome view far past `maxCells`.
    const regions = Array.from({ length: 25 }, (_, i) => ({
      start: i * 1000,
      end: i * 1000 + 1000,
    }))
    const numValues = MAX_CATEGORICAL_VALUES + 1
    const rows = buildRows({
      sources: ['s1', 's2'],
      regions,
      clusterField: 'name',
      maxCells: 100,
      features: Array.from({ length: numValues }, (_, i) =>
        feature(i % 2 ? 's1' : 's2', 0, 1000, `v${i}`, i % 25),
      ),
    })
    expect(rows[0]).toHaveLength(100)
    expect(rows[0]).toContain(1)
    expect(new Set(rows[0]).size).toBeLessThanOrEqual(2)
  })

  test('maxBins still caps a narrow encoding', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10_000 }],
      clusterField: '',
      maxBins: 50,
      features: [feature('s1', 0, 10_000)],
    })
    expect(row).toHaveLength(50)
  })
})

describe('regions', () => {
  test('bins split across regions proportional to width', () => {
    const matrix = buildRows({
      sources: ['s1'],
      regions: [
        { start: 0, end: 10 },
        { start: 100, end: 110 },
      ],
      clusterField: '',
      maxBins: 4, // 2 bins per equal-width region
      features: [feature('s1', 100, 110, '', 1)],
    })
    expect(matrix[0]).toEqual([0, 0, 1, 1])
  })

  test('features only cover bins in their own region (same-coord chromosomes)', () => {
    const matrix = buildRows({
      sources: ['s1', 's2'],
      regions: [
        { start: 0, end: 10 },
        { start: 0, end: 10 },
      ],
      clusterField: '',
      maxBins: 4,
      features: [feature('s1', 0, 10), feature('s2', 0, 10, '', 1)],
    })
    expect(matrix[0]).toEqual([1, 1, 0, 0])
    expect(matrix[1]).toEqual([0, 0, 1, 1])
  })
})

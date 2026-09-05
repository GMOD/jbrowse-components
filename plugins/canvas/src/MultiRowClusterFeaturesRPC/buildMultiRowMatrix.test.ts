import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'

import type { MatrixFeature } from './buildMultiRowMatrix.ts'

// Reads the matrix positionally, which asserts its `sources` key order as a
// side effect.
function buildRows(args: Parameters<typeof buildMultiRowMatrix>[0]) {
  return [...buildMultiRowMatrix(args).values()].map(row => [...row])
}

const RED = [255, 0, 0]
const BLUE = [0, 0, 255]
const GAP = [-255, -255, -255]

const dist = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]!))

// Pushes the palette past MAX_CATEGORICAL_COLORS onto the RGB path, on a row
// name no `sources` entry reads, so it contributes no bin to any output row.
const PALETTE_FILLER: MatrixFeature[] = Array.from({ length: 13 }, (_, i) => ({
  regionIndex: 0,
  row: '__not_a_source__',
  start: 0,
  end: 1,
  colorKey: `#${`0${(i + 1).toString(16)}`.repeat(3)}`,
}))

describe('continuous palettes: rgb channels', () => {
  test('rows in `sources` order; bins carry rgb channels; gaps are -255', () => {
    const matrix = buildRows({
      sources: ['s1', 's2', 's3'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 4, // midpoints at 1.25, 3.75, 6.25, 8.75
      features: [
        { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'red' },
        { regionIndex: 0, row: 's2', start: 0, end: 5, colorKey: 'blue' },
        ...PALETTE_FILLER,
      ],
    })
    expect(matrix[0]).toEqual([...RED, ...RED, ...RED, ...RED])
    expect(matrix[1]).toEqual([...BLUE, ...BLUE, ...GAP, ...GAP])
    expect(matrix[2]).toEqual([...GAP, ...GAP, ...GAP, ...GAP])
  })

  test('later feature on a row wins the bin (paint order)', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 2, // midpoints at 2.5, 7.5
      features: [
        { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'red' },
        { regionIndex: 0, row: 's1', start: 0, end: 5, colorKey: 'blue' },
        ...PALETTE_FILLER,
      ],
    })
    expect(row).toEqual([...BLUE, ...RED])
  })

  test('a feature between two midpoints covers nothing', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 2, // midpoints at 2.5, 7.5
      features: [
        { regionIndex: 0, row: 's1', start: 4, end: 6, colorKey: 'red' },
        ...PALETTE_FILLER,
      ],
    })
    expect(row).toEqual([...GAP, ...GAP])
  })

  test('a feature hanging off either end covers the bins it reaches', () => {
    const [row] = buildRows({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 4, // midpoints at 1.25, 3.75, 6.25, 8.75
      features: [
        { regionIndex: 0, row: 's1', start: -100, end: 7, colorKey: 'red' },
        ...PALETTE_FILLER,
      ],
    })
    expect(row).toEqual([...RED, ...RED, ...RED, ...GAP])
  })

  test('bins split across regions proportional to width', () => {
    const matrix = buildRows({
      sources: ['s1'],
      regions: [
        { start: 0, end: 10 },
        { start: 100, end: 110 },
      ],
      maxBins: 4, // 2 bins per equal-width region
      features: [
        { regionIndex: 1, row: 's1', start: 100, end: 110, colorKey: 'red' },
        ...PALETTE_FILLER,
      ],
    })
    expect(matrix[0]).toEqual([...GAP, ...GAP, ...RED, ...RED])
  })

  test('features only cover bins in their own region (same-coord chromosomes)', () => {
    const matrix = buildRows({
      sources: ['s1', 's2'],
      regions: [
        { start: 0, end: 10 },
        { start: 0, end: 10 },
      ],
      maxBins: 4, // 2 bins per region
      features: [
        { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'blue' },
        { regionIndex: 1, row: 's2', start: 0, end: 10, colorKey: 'red' },
        ...PALETTE_FILLER,
      ],
    })
    expect(matrix[0]).toEqual([...BLUE, ...BLUE, ...GAP, ...GAP])
    expect(matrix[1]).toEqual([...GAP, ...GAP, ...RED, ...RED])
  })

  test('similar colors are closer than dissimilar ones regardless of insertion order', () => {
    const [seenFirst, seenMid, seenLast] = buildRows({
      sources: ['seenFirst', 'seenMid', 'seenLast'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 2,
      features: [
        {
          regionIndex: 0,
          row: 'seenFirst',
          start: 0,
          end: 10,
          colorKey: '#00ff00',
        },
        {
          regionIndex: 0,
          row: 'seenMid',
          start: 0,
          end: 10,
          colorKey: '#ff0000',
        },
        {
          regionIndex: 0,
          row: 'seenLast',
          start: 0,
          end: 10,
          colorKey: '#00fa00',
        },
        ...PALETTE_FILLER,
      ],
    })
    expect(dist(seenFirst!, seenLast!)).toBeLessThan(dist(seenFirst!, seenMid!))
    expect(dist(seenFirst!, seenLast!)).toBeLessThan(dist(seenMid!, seenLast!))
  })

  test('a gap sits outside the color cube', () => {
    const [black, white, gray, absent] = buildRows({
      sources: ['black', 'white', 'gray', 'absent'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 2,
      features: [
        {
          regionIndex: 0,
          row: 'black',
          start: 0,
          end: 10,
          colorKey: '#000000',
        },
        {
          regionIndex: 0,
          row: 'white',
          start: 0,
          end: 10,
          colorKey: '#ffffff',
        },
        { regionIndex: 0, row: 'gray', start: 0, end: 10, colorKey: '#808080' },
        ...PALETTE_FILLER,
      ],
    })
    expect(dist(black!, absent!)).toBeGreaterThanOrEqual(dist(black!, white!))
    expect(dist(gray!, absent!)).toBeGreaterThan(dist(gray!, black!))
    expect(dist(gray!, absent!)).toBeGreaterThan(dist(gray!, white!))
  })
})

describe('categorical palettes: one channel per color', () => {
  test('three categories are equidistant, which the rgb encoding is not', () => {
    const [red, blue, purple] = buildRows({
      sources: ['red', 'blue', 'purple'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 2,
      features: [
        { regionIndex: 0, row: 'red', start: 0, end: 10, colorKey: '#ff0000' },
        { regionIndex: 0, row: 'blue', start: 0, end: 10, colorKey: '#0000ff' },
        {
          regionIndex: 0,
          row: 'purple',
          start: 0,
          end: 10,
          colorKey: '#800080',
        },
      ],
    })
    expect(dist(red!, blue!)).toBeCloseTo(dist(red!, purple!))
    expect(dist(red!, purple!)).toBeCloseTo(dist(blue!, purple!))
  })

  test('each bin is a one-hot over the colors plus a gap slot', () => {
    const [s1, s2] = buildRows({
      sources: ['s1', 's2'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 4,
      features: [
        { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'red' },
        { regionIndex: 0, row: 's2', start: 0, end: 5, colorKey: 'blue' },
      ],
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
      maxBins: 4, // midpoints 1.25, 3.75, 6.25, 8.75
      features: [
        { regionIndex: 0, row: 'same', start: 0, end: 10, colorKey: 'red' },
        { regionIndex: 0, row: 'oneOff', start: 0, end: 10, colorKey: 'red' },
        { regionIndex: 0, row: 'oneOff', start: 8, end: 10, colorKey: 'blue' },
      ],
    })
    expect(dist(same!, oneOff!)).toBeCloseTo(Math.sqrt(2 * 1))
  })

  test('absent is a category: two absent rows agree, and absence is no farther than any other mismatch', () => {
    const [painted, absentA, absentB] = buildRows({
      sources: ['painted', 'absentA', 'absentB'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 2,
      features: [
        {
          regionIndex: 0,
          row: 'painted',
          start: 0,
          end: 10,
          colorKey: 'red',
        },
        { regionIndex: 0, row: 'other', start: 0, end: 10, colorKey: 'blue' },
      ],
    })
    expect(dist(absentA!, absentB!)).toBe(0)
    expect(dist(painted!, absentA!)).toBeCloseTo(Math.abs(2))
  })

  test('switches to rgb once the palette outgrows the categorical ceiling', () => {
    const build = (numColors: number) =>
      buildRows({
        sources: ['s1'],
        regions: [{ start: 0, end: 10 }],
        maxBins: 1,
        features: Array.from({ length: numColors }, (_, i) => ({
          regionIndex: 0,
          row: `row${i}`,
          start: 0,
          end: 10,
          colorKey: `#${`0${(i + 1).toString(16)}`.repeat(3)}`,
        })),
      })
    expect(build(12)[0]).toHaveLength(13)
    expect(build(13)[0]).toHaveLength(3)
  })
})

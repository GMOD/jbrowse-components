import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'

import type { MatrixFeature } from './buildMultiRowMatrix.ts'

const RED = [255, 0, 0]
const BLUE = [0, 0, 255]
const GAP = [-255, -255, -255]

const dist = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]!))

// Push the palette past MAX_CATEGORICAL_COLORS so the matrix takes the
// continuous (RGB) path. These sit on a row name no `sources` entry reads, so
// they widen the palette without contributing a bin to any output row — which
// is what lets the geometry tests below keep asserting readable rgb triples.
const PALETTE_FILLER: MatrixFeature[] = Array.from({ length: 13 }, (_, i) => ({
  regionIndex: 0,
  row: '__not_a_source__',
  start: 0,
  end: 1,
  colorKey: `#${`0${(i + 1).toString(16)}`.repeat(3)}`,
}))

describe('continuous palettes: rgb channels', () => {
  test('rows in `sources` order; bins carry rgb channels; gaps are -255', () => {
    const matrix = buildMultiRowMatrix({
      sources: ['s1', 's2', 's3'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 4, // midpoints at 1.25, 3.75, 6.25, 8.75
      features: [
        { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'red' },
        { regionIndex: 0, row: 's2', start: 0, end: 5, colorKey: 'blue' },
        // s3 has no features
        ...PALETTE_FILLER,
      ],
    })
    // s1 covered everywhere
    expect(matrix[0]).toEqual([...RED, ...RED, ...RED, ...RED])
    // s2 covered only in the first half (bins 0,1)
    expect(matrix[1]).toEqual([...BLUE, ...BLUE, ...GAP, ...GAP])
    // s3 absent → all gaps
    expect(matrix[2]).toEqual([...GAP, ...GAP, ...GAP, ...GAP])
  })

  test('later feature on a row wins the bin (paint order)', () => {
    const [row] = buildMultiRowMatrix({
      sources: ['s1'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 2, // midpoints at 2.5, 7.5
      features: [
        { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'red' },
        { regionIndex: 0, row: 's1', start: 0, end: 5, colorKey: 'blue' }, // overrides bin 0
        ...PALETTE_FILLER,
      ],
    })
    expect(row).toEqual([...BLUE, ...RED])
  })

  test('bins split across regions proportional to width', () => {
    const matrix = buildMultiRowMatrix({
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
        ...PALETTE_FILLER,
      ],
    })
    // s1 covers its own region's bins only; region 1's bins are gaps
    expect(matrix[0]).toEqual([...BLUE, ...BLUE, ...GAP, ...GAP])
    // s2 covers region 1's bins only; region 0's bins are gaps
    expect(matrix[1]).toEqual([...GAP, ...GAP, ...RED, ...RED])
  })

  // The regression the channel encoding exists for. Under the old first-seen
  // ordinal encoding these three uniform rows got codes 0/1/2 by the order their
  // colors were seen, so `mid` sat exactly between `first` and `last` and the
  // ordering was an artifact of insertion order rather than of color. With rgb
  // channels, the two rows painted the same shade of green are the close pair
  // whatever order they arrive in — and this is the property a continuous
  // palette needs that no categorical encoding can provide.
  test('similar colors are closer than dissimilar ones regardless of insertion order', () => {
    const [seenFirst, seenMid, seenLast] = buildMultiRowMatrix({
      sources: ['seenFirst', 'seenMid', 'seenLast'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 2,
      features: [
        // insertion order deliberately interleaves: green, red, near-green
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

  // A gap must not read as "some dark color": black and absent are different
  // answers. The sentinel sits one channel range outside the cube, so absent is at
  // least as far from any color as the two extremes are from each other, and
  // strictly farther than any color from a mid-tone.
  test('a gap sits outside the color cube', () => {
    const [black, white, gray, absent] = buildMultiRowMatrix({
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
  // The reason this path exists. Under rgb these three are *not* equidistant —
  // red↔blue is ~360 while red↔purple and blue↔purple are ~180 — so a
  // three-category painting clustered partly on where its palette happens to sit
  // in the color cube. As categories every pair is sqrt(2) per bin apart.
  test('three categories are equidistant, which the rgb encoding is not', () => {
    const [red, blue, purple] = buildMultiRowMatrix({
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
    const [s1, s2] = buildMultiRowMatrix({
      sources: ['s1', 's2'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 4,
      features: [
        { regionIndex: 0, row: 's1', start: 0, end: 10, colorKey: 'red' },
        { regionIndex: 0, row: 's2', start: 0, end: 5, colorKey: 'blue' },
      ],
    })
    // 2 colors + 1 gap slot, per bin
    const channels = 3
    expect(s1).toHaveLength(4 * channels)
    for (let bin = 0; bin < 4; bin++) {
      const slice = s1!.slice(bin * channels, (bin + 1) * channels)
      // exactly one slot set, so every bin contributes the same magnitude
      expect(slice.filter(v => v === 1)).toHaveLength(1)
      expect(slice.filter(v => v === 0)).toHaveLength(channels - 1)
    }
    // s1 is one color throughout, s2 changes to a gap halfway: they agree
    // nowhere, so the distance is the full mismatch count over 4 bins
    expect(dist(s1!, s2!)).toBeCloseTo(Math.sqrt(2 * 4))
  })

  test('distance counts mismatched bins', () => {
    const [same, oneOff] = buildMultiRowMatrix({
      sources: ['same', 'oneOff'],
      regions: [{ start: 0, end: 10 }],
      maxBins: 4, // midpoints 1.25, 3.75, 6.25, 8.75
      features: [
        { regionIndex: 0, row: 'same', start: 0, end: 10, colorKey: 'red' },
        { regionIndex: 0, row: 'oneOff', start: 0, end: 10, colorKey: 'red' },
        // repaint just the last bin of `oneOff`
        { regionIndex: 0, row: 'oneOff', start: 8, end: 10, colorKey: 'blue' },
      ],
    })
    expect(dist(same!, oneOff!)).toBeCloseTo(Math.sqrt(2 * 1))
  })

  test('absent is a category: two absent rows agree, and absence is no farther than any other mismatch', () => {
    const [painted, absentA, absentB] = buildMultiRowMatrix({
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
    // a gap differs from a color exactly as much as two colors differ
    expect(dist(painted!, absentA!)).toBeCloseTo(Math.sqrt(2 * 2))
  })

  test('switches to rgb once the palette outgrows the categorical ceiling', () => {
    const build = (numColors: number) =>
      buildMultiRowMatrix({
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
    // 12 colors + a gap slot
    expect(build(12)[0]).toHaveLength(13)
    // 13 colors is past the ceiling → rgb triples
    expect(build(13)[0]).toHaveLength(3)
  })
})

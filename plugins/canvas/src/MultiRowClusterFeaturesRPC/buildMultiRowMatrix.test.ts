import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'

const RED = [255, 0, 0]
const BLUE = [0, 0, 255]
const GAP = [-255, -255, -255]

test('rows in `sources` order; bins carry rgb channels; gaps are -255', () => {
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
// ordering was an artifact of insertion order rather than of color. With
// channels, the two rows painted the same shade of green are the close pair
// whatever order they arrive in.
test('similar colors are closer than dissimilar ones regardless of insertion order', () => {
  const dist = (a: number[], b: number[]) =>
    Math.hypot(...a.map((v, i) => v - b[i]!))
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
  const dist = (a: number[], b: number[]) =>
    Math.hypot(...a.map((v, i) => v - b[i]!))
  const [black, white, gray, absent] = buildMultiRowMatrix({
    sources: ['black', 'white', 'gray', 'absent'],
    regions: [{ start: 0, end: 10 }],
    maxBins: 2,
    features: [
      { regionIndex: 0, row: 'black', start: 0, end: 10, colorKey: '#000000' },
      { regionIndex: 0, row: 'white', start: 0, end: 10, colorKey: '#ffffff' },
      { regionIndex: 0, row: 'gray', start: 0, end: 10, colorKey: '#808080' },
    ],
  })
  expect(dist(black!, absent!)).toBeGreaterThanOrEqual(dist(black!, white!))
  expect(dist(gray!, absent!)).toBeGreaterThan(dist(gray!, black!))
  expect(dist(gray!, absent!)).toBeGreaterThan(dist(gray!, white!))
})

import { syntenyBlockLines } from './syntenyBlockLines.ts'

const sides = [
  { assemblyName: 'grape', refName: 'chr1', start: 93_399, end: 107_732 },
  {
    assemblyName: 'peach',
    name: 'Prupe.1G290900.1',
    refName: 'Pp01',
    start: 28_942_281,
    end: 28_949_086,
  },
]

test('a one-to-one pair says nothing about its syntenic depth', () => {
  expect(
    syntenyBlockLines({
      sides,
      inverted: true,
      attributes: { syntenicDepth: 1 },
    }),
  ).toEqual([
    'grape chr1:93,400-107,732 (14.3Kbp)',
    'peach Prupe.1G290900.1 Pp01:28,942,282-28,949,086 (6.8Kbp)',
    'Inverted',
  ])
})

test('a chromosome-scale block reads in Mbp', () => {
  expect(
    syntenyBlockLines({
      sides: [
        { refName: 'chr2', start: 66_123_456, end: 98_234_567 },
        { refName: 'chr7', start: 1_200_000, end: 31_800_000 },
      ],
      inverted: false,
      attributes: {},
    }),
  ).toEqual(['chr2:66Mbp-98Mbp (32.1Mbp)', 'chr7:1Mbp-32Mbp (30.6Mbp)'])
})

test('a gene with more than one partner says how many', () => {
  expect(
    syntenyBlockLines({
      sides,
      inverted: false,
      attributes: { syntenicDepth: 3 },
    }),
  ).toContain('Shared by 3 genes')
})

test('the genes sharing an ortholog are named, and any past five counted', () => {
  expect(
    syntenyBlockLines({
      sides,
      inverted: false,
      attributes: { syntenicDepth: 3 },
      sharedBy: ['Fgfr2', 'Fgfr2b', 'Fgfr2c'],
    }),
  ).toContain('Shared by 3 genes: Fgfr2, Fgfr2b, Fgfr2c')
  expect(
    syntenyBlockLines({
      sides,
      inverted: false,
      attributes: { syntenicDepth: 8 },
      sharedBy: ['a', 'b', 'c', 'd', 'e', 'f'],
    }),
  ).toContain('Shared by 8 genes: a, b, c, d, e and 3 more')
})

test('a sharing gene outside the loaded region is counted, not named', () => {
  expect(
    syntenyBlockLines({
      sides,
      inverted: false,
      attributes: { syntenicDepth: 3 },
      sharedBy: ['Fgfr2', 'Fgfr2b'],
    }),
  ).toContain('Shared by 3 genes: Fgfr2, Fgfr2b and 1 more')
})

test('a hovered segment takes the place of the spans, and the block is given by length', () => {
  expect(
    syntenyBlockLines({
      sides: [
        {
          assemblyName: 'hg19',
          refName: 'chr1',
          start: 1_000_000,
          end: 46_000_000,
        },
        {
          assemblyName: 'hg38',
          refName: 'chr1',
          start: 1_050_000,
          end: 46_300_000,
        },
      ],
      segment: [
        {
          assemblyName: 'hg19',
          refName: 'chr1',
          start: 10_000_000,
          end: 10_020_000,
        },
        {
          assemblyName: 'hg38',
          refName: 'chr1',
          start: 10_050_000,
          end: 10_070_000,
        },
      ],
      inverted: true,
      attributes: {},
    }),
  ).toEqual([
    'hg19 chr1:10,000,001-10,020,000 (20Kbp)',
    'hg38 chr1:10,050,001-10,070,000 (20Kbp)',
    'Part of an alignment spanning 45Mbp and 45.3Mbp',
    'Inverted',
  ])
})

test('a block as long on both sides gives its length once', () => {
  expect(
    syntenyBlockLines({
      sides: [
        { refName: 'chr1', start: 0, end: 5000 },
        { refName: 'chr2', start: 100, end: 5100 },
      ],
      segment: [
        { refName: 'chr1', start: 0, end: 100 },
        { refName: 'chr2', start: 100, end: 200 },
      ],
      inverted: false,
      attributes: {},
    }),
  ).toEqual([
    'chr1:1-100 (100bp)',
    'chr2:101-200 (100bp)',
    'Part of an alignment spanning 5Kbp',
  ])
})

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
    'grape chr1:93,400-107,732 (14,333 bp)',
    'peach Prupe.1G290900.1 Pp01:28,942,282-28,949,086 (6,805 bp)',
    'Inverted',
  ])
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

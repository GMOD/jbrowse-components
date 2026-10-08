import { readsJoiningRegions } from './joinedReads.ts'

test('sums the reads behind every arc crossing the seam, over the lanes', () => {
  expect(
    readsJoiningRegions(
      new Map([
        ['HP1', [{ support: 24 }, { support: 2 }]],
        ['HP2', []],
        ['', [{ support: 1 }]],
      ]),
    ),
  ).toBe(27)
})

test('is zero where no arc crosses', () => {
  expect(readsJoiningRegions(new Map())).toBe(0)
  expect(readsJoiningRegions(new Map([['', []]]))).toBe(0)
})

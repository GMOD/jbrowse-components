import { syntenyPairs } from './syntenyPairs.ts'

test('each pair names its two adjacent rows', () => {
  expect(syntenyPairs(['hg38', 'mm39', 'rn7'])).toEqual([
    ['hg38', 'mm39'],
    ['mm39', 'rn7'],
  ])
})

test('N rows make N-1 pairs, so a lone row makes none', () => {
  expect(syntenyPairs(['hg38'])).toEqual([])
  expect(syntenyPairs([])).toEqual([])
})

test('a repeated assembly is a self-alignment pair, not deduplicated', () => {
  expect(syntenyPairs(['hg38', 'hg38'])).toEqual([['hg38', 'hg38']])
})

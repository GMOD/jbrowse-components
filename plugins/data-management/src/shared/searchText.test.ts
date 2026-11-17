import { buildSearchText, highlightTerms, searchMatcher } from './searchText.ts'

const fiber = buildSearchText([
  'Fiber-seq Compendium - THP-1 CpG Hap1/2',
  'Regulation',
])
const liftOver = buildSearchText([
  'hg38 to mm10 liftOver',
  'Pairwise alignments, liftOver',
])

function matches(query: string) {
  const match = searchMatcher(query)
  return [fiber, liftOver].map(text => match(text))
}

test('an empty or blank query matches every track', () => {
  expect(matches('')).toEqual([true, true])
  expect(matches('   ')).toEqual([true, true])
})

test('every word must match, in any field and any order', () => {
  expect(matches('fiber thp-1')).toEqual([true, false])
  expect(matches('regulation cpg')).toEqual([true, false])
  expect(matches('fiber mm10')).toEqual([false, false])
})

test('a word matches with or without its hyphens and underscores', () => {
  expect(matches('thp1')).toEqual([true, false])
  expect(matches('fiberseq')).toEqual([true, false])
  expect(matches('Fiber-Seq')).toEqual([true, false])
})

test('a quoted phrase must match as typed', () => {
  expect(matches('"thp-1 cpg"')).toEqual([true, false])
  expect(matches('"cpg thp-1"')).toEqual([false, false])
  expect(matches('"thp-1 cpg')).toEqual([true, false])
})

test('a leading minus excludes tracks containing the word', () => {
  expect(matches('-liftover')).toEqual([true, false])
  expect(matches('hg38 -mm10')).toEqual([false, false])
  expect(matches('-"pairwise alignments"')).toEqual([true, false])
})

test('a hyphen inside a word is part of it', () => {
  expect(matches('hap1/2')).toEqual([true, false])
  expect(matches('-')).toEqual([true, false])
  expect(matches('--')).toEqual([false, true])
})

test('a term cannot span two fields', () => {
  expect(matches('"hap1/2 regulation"')).toEqual([false, false])
})

test('only the terms a track must contain are highlighted', () => {
  expect(highlightTerms('Fiber "THP-1 cpg" -liftover')).toEqual([
    'fiber',
    'thp-1 cpg',
  ])
})

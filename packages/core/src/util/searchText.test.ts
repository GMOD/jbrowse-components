import {
  buildSearchText,
  highlightPatterns,
  searchMatcher,
} from './searchText.ts'

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
  return [fiber, liftOver].map(text => match?.(text) ?? true)
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

test('a typed hyphen must match, but the track text may also drop one', () => {
  expect(matches('hap1/2')).toEqual([true, false])
  expect(matches('thp_1')).toEqual([false, false])
  const decimals = searchMatcher('1.5')!
  expect(decimals(buildSearchText(['dbSNP(155)']))).toBe(false)
  expect(decimals(buildSearchText(['v1.5']))).toBe(true)
})

test('a minus before a plain number searches for the negative value', () => {
  const foldChange = searchMatcher('-2.3')!
  expect(foldChange(buildSearchText(['log2FC -2.3']))).toBe(true)
  expect(foldChange(buildSearchText(['log2FC 2.3']))).toBe(false)
  const excluded = searchMatcher('-10x')!
  expect(excluded(buildSearchText(['10x Genomics']))).toBe(false)
  expect(excluded(buildSearchText(['Nanopore']))).toBe(true)
})

test('a lone minus, on the way to an excluded word, is no term yet', () => {
  expect(searchMatcher('-')).toBeUndefined()
  expect(matches('fiber -')).toEqual([true, false])
})

test('a term cannot span two fields', () => {
  expect(matches('"hap1/2 regulation"')).toEqual([false, false])
})

function highlighted(query: string, text: string) {
  return highlightPatterns(query).flatMap(pattern =>
    [...text.matchAll(pattern)].map(m => m[0]),
  )
}

test('only the terms a track must contain are highlighted, as they appear', () => {
  expect(
    highlighted(
      'Fiber "THP-1 cpg" -liftover',
      'Fiber-seq - THP-1 CpG liftover',
    ),
  ).toEqual(['Fiber', 'THP-1 CpG'])
})

test('a term matched past a hyphen is highlighted across it', () => {
  expect(highlighted('thp1 fiberseq', 'Fiber-seq - THP-1 CpG')).toEqual([
    'THP-1',
    'Fiber-seq',
  ])
  expect(highlighted('a.b (c', 'a.b (c axb')).toEqual(['a.b', '(c'])
})

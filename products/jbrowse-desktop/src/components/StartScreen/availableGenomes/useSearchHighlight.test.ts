import { searchTokens } from './searchTokens.ts'
import { collectMatchRanges } from './useSearchHighlight.ts'

// What the highlight covers has to be what the search matched. The search is
// token-based ("e coli" finds Escherichia coli), so highlighting the raw query
// as one substring meant every multi-word search highlighted nothing.

function highlighted(html: string, query: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  return collectMatchRanges(root, searchTokens(query)).map(r => r.toString())
}

test('highlights a single-token match', () => {
  expect(highlighted('<span>Escherichia coli</span>', 'coli')).toEqual(['coli'])
})

test('highlights every token of a multi-token query', () => {
  expect(highlighted('<span>Escherichia coli</span>', 'e coli')).toEqual([
    // both 'e's of Escherichia, then 'coli'
    'E',
    'e',
    'coli',
  ])
})

test('matches tokens that no single substring of the query would', () => {
  // 'human t2t' is not a substring of anything here, but both tokens are
  expect(
    highlighted('<td>Human</td><td>T2T-CHM13v2.0</td>', 'human t2t'),
  ).toEqual(['Human', 'T2T'])
})

test('matches across separate text nodes and repeated occurrences', () => {
  expect(highlighted('<td>hg38</td><td>GRCh38/hg38</td>', 'hg38')).toEqual([
    'hg38',
    'hg38',
  ])
})

test('is case insensitive but preserves the matched casing', () => {
  expect(highlighted('<span>Homo Sapiens</span>', 'HOMO')).toEqual(['Homo'])
})

test('an all-whitespace query highlights nothing', () => {
  expect(highlighted('<span>Escherichia coli</span>', '   ')).toEqual([])
})

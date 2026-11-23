import { matchHint } from './util.ts'

const row = {
  name: 'H3K27ac ChIP-seq',
  categories: ['ENCODE'],
  hintFields: [
    ['description', 'Histone marks in liver'],
    ['biosample', 'THP-1'],
    ['lab', 'Bernstein'],
    ['assay', 'ChIP-seq'],
    ['project', 'ENCODE'],
  ] as [string, string][],
}

test('no hint when the name or a drawn category holds the term', () => {
  expect(matchHint(row, ['h3k27ac'])).toBe('')
  expect(matchHint(row, ['encode'])).toBe('')
})

test('a metadata-only hit names its field', () => {
  expect(matchHint(row, ['bernstein'])).toBe('lab: Bernstein')
})

test('a term spelled without joiners still names its field', () => {
  expect(matchHint(row, ['thp1'])).toBe('biosample: THP-1')
})

test('two terms found in two fields name both', () => {
  expect(matchHint(row, ['bernstein', 'thp'])).toBe(
    'lab: Bernstein · biosample: THP-1',
  )
})

test('a term the name holds adds nothing beside another field', () => {
  expect(matchHint(row, ['chip', 'bernstein'])).toBe('lab: Bernstein')
})

test('a description-only hit shows the description unlabeled', () => {
  expect(matchHint(row, ['marks'])).toBe('Histone marks in liver')
})

test('a value starts at the word holding a term past its first characters', () => {
  const long = {
    ...row,
    hintFields: [
      ['description', 'UCSC annotations of RefSeq RNAs (NM_* and NR_*)'],
      ['protocol', 'Crosslinked chromatin was sheared then immunoprecipitated'],
    ] as [string, string][],
  }
  expect(matchHint(long, ['rnas'])).toBe('…RNAs (NM_* and NR_*)')
  expect(matchHint(long, ['immuno'])).toBe('protocol: …immunoprecipitated')
  expect(matchHint(long, ['ucsc'])).toBe(
    'UCSC annotations of RefSeq RNAs (NM_* and NR_*)',
  )
})

test('a term spelled without joiners finds its place in a long value', () => {
  const long = {
    ...row,
    hintFields: [
      ['description', 'Monocyte-derived macrophages from THP-1 cells'],
    ] as [string, string][],
  }
  expect(matchHint(long, ['thp1'])).toBe('…THP-1 cells')
})

test('a term deep in a long word starts the value at the term', () => {
  const url = {
    ...row,
    hintFields: [
      ['url', 'https://www.encodeproject.org/files/ENCFF123ABC/'],
    ] as [string, string][],
  }
  expect(matchHint(url, ['encff123'])).toBe('url: …ENCFF123ABC/')
  expect(matchHint(url, ['www'])).toBe(
    'url: https://www.encodeproject.org/files/ENCFF123ABC/',
  )
})

test('two terms in one field name it once, from the first term', () => {
  expect(matchHint(row, ['marks', 'liver'])).toBe('Histone marks in liver')
})

test('a metadata field keeps its key beside an unlabeled description', () => {
  expect(matchHint(row, ['bernstein', 'marks'])).toBe(
    'lab: Bernstein · Histone marks in liver',
  )
})

test('no hint for a term nothing holds', () => {
  expect(matchHint(row, ['k562'])).toBe('')
})

import { expandLooseSearchIndex } from './expandLooseSearchIndex.ts'

test('a bare .ix string is the whole trix entry', () => {
  expect(expandLooseSearchIndex('trix/hg38.ix', ['hg38'])).toEqual({
    type: 'TrixTextSearchAdapter',
    uri: 'trix/hg38.ix',
    assemblyNames: ['hg38'],
  })
})

test('the string and { uri } forms expand alike, query string included', () => {
  const uri = 'https://example.com/trix/genes.ix?v=2'
  expect(expandLooseSearchIndex(uri)).toEqual(expandLooseSearchIndex({ uri }))
  expect(expandLooseSearchIndex(uri)).toMatchObject({
    type: 'TrixTextSearchAdapter',
  })
})

test('keys already written win, and a typed entry comes back untouched', () => {
  const typed = { type: 'JBrowse1TextSearchAdapter', assemblyNames: ['a'] }
  expect(expandLooseSearchIndex(typed, ['b'])).toBe(typed)
  expect(
    expandLooseSearchIndex({ uri: 'x.ix', assemblyNames: ['a'] }, ['b']),
  ).toMatchObject({ assemblyNames: ['a'] })
})

test('a string naming no .ix gets no guessed type', () => {
  expect(expandLooseSearchIndex('names/')).toEqual({ uri: 'names/' })
})

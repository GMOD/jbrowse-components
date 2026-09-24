import { createTrixAdapter, indexFileOf } from './adapter-utils.ts'

test('an index written short is the same index text-index writes, so a re-index replaces it', () => {
  const written = indexFileOf(createTrixAdapter('hg38', ['hg38']))
  expect(indexFileOf('trix/hg38.ix')).toBe(written)
  expect(indexFileOf({ uri: 'trix/hg38.ix' })).toBe(written)
  expect(
    indexFileOf({ type: 'TrixTextSearchAdapter', uri: 'trix/hg38.ix' }),
  ).toBe(written)
})

test('an index with no trix file is only ever itself', () => {
  const jb1 = { type: 'JBrowse1TextSearchAdapter', namesIndexLocation: {} }
  expect(indexFileOf(jb1)).toBe(jb1)
})

import { getRowStr } from './util.ts'

test('reads a top-level facet', () => {
  expect(
    getRowStr('category', { id: 't1', category: 'Annotation', metadata: {} }),
  ).toBe('Annotation')
})

test('reads a metadata facet via the metadata. prefix', () => {
  expect(getRowStr('metadata.assay', { id: 't1', metadata: { assay: 'DNA' } })).toBe('DNA')
})

test('missing values become an empty string', () => {
  expect(getRowStr('nope', { id: 't1', metadata: {} })).toBe('')
  expect(getRowStr('metadata.nope', { id: 't1', metadata: {} })).toBe('')
})

test('coerces non-string values', () => {
  expect(getRowStr('count', { id: 't1', count: 5, metadata: {} })).toBe('5')
})

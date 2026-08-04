import { sortSources } from './sortUtils.ts'

import type { TrackNodeSource } from './types.ts'

function src(sortName: string, categories: string[] = []): TrackNodeSource {
  return {
    conf: undefined as unknown as TrackNodeSource['conf'],
    name: sortName,
    sortName,
    description: '',
    categories,
    searchText: sortName.toLowerCase(),
  }
}

function names(sources: TrackNodeSource[]) {
  return sources.map(s => s.sortName)
}

test('neither sort returns the input untouched', () => {
  const input = [src('b'), src('a')]
  expect(sortSources(input, false, false)).toBe(input)
})

// sorting by code point would give sample1, sample10, sample2
test('track names sort numerically, not by code point', () => {
  expect(
    names(
      sortSources(
        [src('sample10'), src('sample2'), src('sample1')],
        true,
        false,
      ),
    ),
  ).toEqual(['sample1', 'sample2', 'sample10'])
})

test('categories sort numerically too', () => {
  expect(
    names(
      sortSources(
        [src('a', ['cat10']), src('b', ['cat2']), src('c', ['cat1'])],
        false,
        true,
      ),
    ),
  ).toEqual(['c', 'b', 'a'])
})

// the category sort runs second and relies on Array#sort being stable
test('names stay ordered within a category', () => {
  expect(
    names(
      sortSources(
        [
          src('sample10', ['cat2']),
          src('sample2', ['cat2']),
          src('sample1', ['cat1']),
        ],
        true,
        true,
      ),
    ),
  ).toEqual(['sample1', 'sample2', 'sample10'])
})

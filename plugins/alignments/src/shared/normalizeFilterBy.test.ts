import { READ_CATEGORY_KEYS, normalizeFilterBy } from './types.ts'
import { defaultFilterFlags } from './util.ts'

// `filterBy` is a `frozen` slot, so MST validates nothing inside it. A config
// file, a share link or an older session can therefore put any string in a
// category field, and the four readers disagreed about what to do with one:
// the worker's `keepCategory` tests `=== 'only'` and so read anything else as
// `exclude`, while `filterSpliced` tests both names and so read it as unfiltered,
// and the menu's `readCategoryChoice` showed "All reads" while the badge counted
// the filter active. Coerced once here instead.
test.each(READ_CATEGORY_KEYS)('%s keeps the two names it has', key => {
  expect(normalizeFilterBy({ [key]: 'only' })[key]).toBe('only')
  expect(normalizeFilterBy({ [key]: 'exclude' })[key]).toBe('exclude')
})

// 'all' is the word the menu radios and the jbrowse-img flag both use for OFF,
// so it is the value most likely to be written by hand — and the one that used
// to hide nearly every read.
test.each(READ_CATEGORY_KEYS)(
  '%s reads an unknown value as unfiltered',
  key => {
    for (const bad of ['all', 'ONLY', '', 'true', 'none']) {
      expect(normalizeFilterBy({ [key]: bad })[key]).toBeUndefined()
    }
  },
)

test('an absent category stays absent, and the flags are still backfilled', () => {
  const filterBy = normalizeFilterBy({ readName: 'x' })
  for (const key of READ_CATEGORY_KEYS) {
    expect(filterBy[key]).toBeUndefined()
  }
  expect(filterBy.flagInclude).toBe(defaultFilterFlags.flagInclude)
  expect(filterBy.flagExclude).toBe(defaultFilterFlags.flagExclude)
})

test('a set category survives the legacy tagFilter fold', () => {
  expect(
    normalizeFilterBy({
      split: 'only',
      tagFilter: { tag: 'HP', value: '1' },
    }),
  ).toMatchObject({
    split: 'only',
    tagFilters: [{ tag: 'HP', value: '1' }],
  })
})

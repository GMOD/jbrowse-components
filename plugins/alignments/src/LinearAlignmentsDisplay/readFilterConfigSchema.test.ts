import { refusingUndeclaredKeys } from '@jbrowse/core/configuration'

import { READ_CATEGORY_KEYS } from '../shared/types.ts'
import { defaultFilterFlags } from '../shared/util.ts'
import {
  readFilterConfigSchema,
  readFilterOf,
} from './readFilterConfigSchema.ts'

function filterOf(snap: Record<string, unknown> = {}) {
  return readFilterOf(readFilterConfigSchema.create(snap))
}

test('a partial filter reads back with the masks filled and no category set', () => {
  const filter = filterOf({ readName: 'x' })
  expect(filter.flagInclude).toBe(defaultFilterFlags.flagInclude)
  expect(filter.flagExclude).toBe(defaultFilterFlags.flagExclude)
  expect(filter.readName).toBe('x')
  expect(filter.tagFilters).toEqual([])
  for (const key of READ_CATEGORY_KEYS) {
    expect(filter[key]).toBeUndefined()
  }
})

test.each(READ_CATEGORY_KEYS)(
  '%s takes only and exclude, and refuses a third word',
  key => {
    expect(filterOf({ [key]: 'only' })[key]).toBe('only')
    expect(filterOf({ [key]: 'exclude' })[key]).toBe('exclude')
    expect(() => readFilterConfigSchema.create({ [key]: 'all' })).toThrow()
  },
)

test("a v4 session's single tagFilter lifts into tagFilters", () => {
  expect(
    filterOf({ split: 'only', tagFilter: { tag: 'HP', value: '1' } }),
  ).toMatchObject({ split: 'only', tagFilters: [{ tag: 'HP', value: '1' }] })
})

test('a write refuses a key the filter does not declare', () => {
  expect(() =>
    refusingUndeclaredKeys(() =>
      readFilterConfigSchema.create({ flagExcludes: 4 }),
    ),
  ).toThrow('not flagExcludes')
})

import { refusingUndeclaredKeys } from '@jbrowse/core/configuration'

import { READ_CATEGORY_KEYS } from '../shared/types.ts'
import { defaultFilterFlags } from '../shared/util.ts'
import { alignmentsFilterConfigSchema } from './alignmentsFilterConfigSchema.ts'
import {
  readFilterMembers,
  readFilterOf,
} from './baseAlignmentsFilterConfigSchema.ts'

function filterOf(snap: Record<string, unknown> = {}) {
  return readFilterOf(alignmentsFilterConfigSchema.create(snap))
}

test('a partial filter reads back with the masks filled and no category set', () => {
  const filter = filterOf({ readName: 'x' })
  expect(filter.flagInclude).toBe(defaultFilterFlags.flagInclude)
  expect(filter.flagExclude).toBe(defaultFilterFlags.flagExclude)
  expect(filter.readName).toBe('x')
  expect(filter.tags).toEqual([])
  for (const key of READ_CATEGORY_KEYS) {
    expect(filter[key]).toBeUndefined()
  }
})

test.each(READ_CATEGORY_KEYS)(
  '%s takes only and exclude, and refuses a third word',
  key => {
    expect(filterOf({ [key]: 'only' })[key]).toBe('only')
    expect(filterOf({ [key]: 'exclude' })[key]).toBe('exclude')
    expect(() =>
      alignmentsFilterConfigSchema.create({ [key]: 'all' }),
    ).toThrow()
  },
)

test('a `*` or empty tag value is unset, the one spelling of any value', () => {
  expect(
    filterOf({
      tags: [
        { tag: 'HP', value: '*' },
        { tag: 'RG', value: '' },
      ],
    }).tags,
  ).toEqual([{ tag: 'HP' }, { tag: 'RG' }])
})

test("a v4 session's single tagFilter lifts into tags", () => {
  expect(
    filterOf({ split: 'only', tagFilter: { tag: 'HP', value: '1' } }),
  ).toMatchObject({ split: 'only', tags: [{ tag: 'HP', value: '1' }] })
})

test('a write refuses a key the filter does not declare', () => {
  expect(() =>
    refusingUndeclaredKeys(() =>
      alignmentsFilterConfigSchema.create({ flagExcludes: 4 }),
    ),
  ).toThrow('not flagExcludes')
})

// `setReadFilter` and the v4 lift write by this list, so a read member missing
// from it would be one neither can clear
test('the read members are the ones readFilterOf hands the worker', () => {
  expect(readFilterMembers.toSorted()).toEqual(
    Object.keys(filterOf()).toSorted(),
  )
  expect(readFilterMembers).not.toContain('junctions')
  expect(readFilterMembers).not.toContain('connections')
})

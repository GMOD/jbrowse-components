import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  fieldPredicateList,
  predicateListDefaults,
} from './fieldPredicateConfigSchema.ts'

const Display = ConfigurationSchema('FilterHost', {
  filter: fieldPredicateList(),
})

const filterOf = (filter: unknown[]) =>
  getSnapshot(Display.create({ filter })).filter ?? []

test('range loads as gte and lte, a null end open', () => {
  expect(filterOf([{ field: 'score', range: [100, 500] }])).toEqual([
    { field: 'score', gte: 100, lte: 500 },
  ])
  expect(filterOf([{ field: 'score', range: [null, 500] }])).toEqual([
    { field: 'score', lte: 500 },
  ])
})

test('range beside a written bound keeps the tighter one', () => {
  expect(
    filterOf([{ field: 'score', gte: 200, lte: 900, range: [100, 500] }]),
  ).toEqual([{ field: 'score', gte: 200, lte: 500 }])
})

describe('an entry whose tests all drop loads as no entry', () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  test("R's NA and Python's None write null", () => {
    expect(
      filterOf([
        { field: 'flags.DUP', equal: null },
        { field: 'mapq', gte: 20 },
      ]),
    ).toEqual([{ field: 'mapq', gte: 20 }])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('states no test this release applies'),
    )
  })

  test('an operator this release does not know', () => {
    expect(filterOf([{ field: 'junction.reads', between: [2, 9] }])).toEqual([])
  })

  test('a range with no number in it', () => {
    expect(filterOf([{ field: 'score', range: [null, null] }])).toEqual([])
  })

  test('a bare { field } stays, since it removes defaults on purpose', () => {
    expect(filterOf([{ field: 'flags.DUP' }, 'jexl:feature.x > 1'])).toEqual([
      { field: 'flags.DUP' },
      { field: 'jexl:feature.x > 1', equal: true },
    ])
    expect(warn).not.toHaveBeenCalled()
  })
})

test('the lists declaring defaults are found at any depth, by path', () => {
  const dup = [{ field: 'flags.DUP', equal: false }]
  const floor = [{ field: 'depth', gte: 8 }]
  const Host = ConfigurationSchema('DefaultsHost', {
    filter: fieldPredicateList({ defaults: dup }),
    plain: fieldPredicateList(),
    band: ConfigurationSchema('DefaultsBand', {
      layer: ConfigurationSchema('DefaultsLayer', {
        filter: fieldPredicateList({ defaults: floor }),
      }),
    }),
  })
  expect(predicateListDefaults(Host.create())).toEqual([
    { path: 'filter', entries: dup },
    { path: 'band.layer.filter', entries: floor },
  ])
})

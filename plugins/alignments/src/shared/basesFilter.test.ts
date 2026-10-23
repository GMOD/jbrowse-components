import {
  basesFilterOf,
  liftModificationThresholds,
  modificationFiltersOf,
} from './basesFilter.ts'

test('a bases filter states only the fields it names', () => {
  expect(modificationFiltersOf([])).toEqual({})
  expect(
    modificationFiltersOf([
      { field: 'probability', gte: 0.07 },
      { field: 'context', oneOf: ['CHH'] },
      { field: 'code', oneOf: ['a'] },
    ]),
  ).toEqual({ threshold: 7, cytosineContext: 'CHH', shownModifications: ['a'] })
  expect(modificationFiltersOf([{ field: 'context' }])).toEqual({
    cytosineContext: 'all',
  })
})

test('the settings round-trip, their defaults left unwritten', () => {
  const mods = {
    threshold: 35,
    cytosineContext: 'CHG' as const,
    shownModifications: ['m', 'h'],
  }
  expect(modificationFiltersOf(basesFilterOf(mods))).toEqual(mods)
  expect(basesFilterOf({ threshold: 10, cytosineContext: 'CG' })).toEqual([])
})

test('a written bases filter beats a lifted beta threshold on its field', () => {
  expect(
    liftModificationThresholds({
      modifications: { threshold: 50, cytosineContext: 'CHG' },
      pileup: { bases: { filter: [{ field: 'probability', gte: 0.9 }] } },
    }),
  ).toEqual({
    modifications: {},
    pileup: {
      bases: {
        filter: [
          { field: 'context', oneOf: ['CHG'] },
          { field: 'probability', gte: 0.9 },
        ],
      },
    },
  })
})

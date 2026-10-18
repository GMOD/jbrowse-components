import { flatSettings, nestedSettings } from './decode.ts'

const display = {
  coverage: { height: 90 },
  filter: {
    split: 'only',
    tags: [{ tag: 'HP', value: '1' }],
    junctions: { minReads: 3 },
    connections: { interchrom: 'exclude' },
  },
}

// the read members stay one entry, which the read-category step reads whole
test("an alignments filter flattens its junction and connection members alone", () => {
  expect(flatSettings(display)).toEqual([
    ['coverage.height', 90],
    ['filter', { split: 'only', tags: [{ tag: 'HP', value: '1' }] }],
    ['filter.junctions.minReads', 3],
    ['filter.connections.interchrom', 'exclude'],
  ])
})

test('nesting undoes flattening whatever order the entries come in', () => {
  expect(nestedSettings(Object.fromEntries(flatSettings(display)))).toEqual(
    display,
  )
  expect(
    nestedSettings(Object.fromEntries(flatSettings(display).toReversed())),
  ).toEqual(display)
})

test('nesting leaves the entries it was handed as they were', () => {
  const entries = flatSettings(display)
  nestedSettings(Object.fromEntries(entries))
  expect(entries).toEqual(flatSettings(display))
})

// each member of a feature display's filter is a row of its own in its menu
test('a feature filter flattens member by member, its list shorthand included', () => {
  expect(
    flatSettings({
      filter: {
        expressions: ['jexl:feature.score > 5'],
        genes: 'only',
        maxMissingness: 0.1,
      },
    }),
  ).toEqual([
    ['filter.expressions', ['jexl:feature.score > 5']],
    ['filter.genes', 'only'],
    ['filter.maxMissingness', 0.1],
  ])
  expect(flatSettings({ filter: ['jexl:feature.score > 5'] })).toEqual([
    ['filter.expressions', ['jexl:feature.score > 5']],
  ])
})

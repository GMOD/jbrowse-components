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

import { flatSettings, nestedSettings } from './decode.ts'

const display = {
  coverage: { height: 90 },
  filter: [
    { field: 'split', equal: true },
    { field: 'junction.reads', gte: 3 },
    { field: 'connection.interchrom', equal: false },
  ],
}

// the recipe reads the list entry by entry, as one setting
test('a band flattens member by member, and a filter list stays one entry', () => {
  expect(flatSettings(display)).toEqual([
    ['coverage.height', 90],
    ['filter', display.filter],
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

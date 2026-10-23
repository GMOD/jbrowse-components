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

// each channel is a step of its own, the display's and a band's alike
test('an encoding flattens channel by channel, under the display or a band', () => {
  const channels = {
    encoding: { color: 'strand' },
    legend: { show: false },
    readConnections: { encoding: { color: 'insertSize' } },
    pileup: { bases: { show: true, encoding: { color: 'modifications' } } },
  }
  expect(flatSettings(channels)).toEqual([
    ['encoding.color', 'strand'],
    ['legend.show', false],
    ['readConnections.encoding.color', 'insertSize'],
    [
      'pileup.bases',
      { show: true, encoding: { color: 'modifications' } },
    ],
  ])
  expect(nestedSettings(Object.fromEntries(flatSettings(channels)))).toEqual(
    channels,
  )
})

test("a row display's axis flattens to one entry per member", () => {
  const settings = { axis: { tree: false, grid: true } }
  expect(flatSettings(settings)).toEqual([
    ['axis.tree', false],
    ['axis.grid', true],
  ])
  expect(nestedSettings(Object.fromEntries(flatSettings(settings)))).toEqual(
    settings,
  )
})

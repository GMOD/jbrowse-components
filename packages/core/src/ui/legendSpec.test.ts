import { legendEntries, nonEmptyLegendSections } from './legendSpec.ts'

const READS = { id: 'reads', title: 'Read colors', items: [{ label: 'A' }] }
const ARCS = { id: 'arcs', title: 'Arc colors', items: [{ label: 'B' }] }

test('a lone section is untitled, like the live legend', () => {
  expect(legendEntries({ sections: [READS] })).toEqual([
    { key: 'reads-0', label: 'A', color: undefined },
  ])
})

test('more than one surviving section brings the headings back', () => {
  expect(legendEntries({ sections: [READS, ARCS] }).map(e => e.label)).toEqual([
    'Read colors',
    'A',
    'Arc colors',
    'B',
  ])
})

test('a heading never appears over an empty section', () => {
  const empty = { id: 'connections', title: 'Read connections', items: [] }
  expect(legendEntries({ sections: [READS, empty] }).map(e => e.label)).toEqual(
    ['A'],
  )
})

// `color` alone is a flat square, so only a row saying something more carries a
// swatch list into the export. A ramp is one of those things — dropping it here
// would leave the exported figure flat while the live legend showed the ramp.
test('a ramp row carries its swatches into the export', () => {
  const [entry] = legendEntries({
    items: [{ label: 'Long insert', color: 'red', gradient: ['grey', 'red'] }],
  })
  expect(entry).toEqual({
    key: 'items-0',
    label: 'Long insert',
    color: 'red',
    swatches: [{ color: 'red', mark: undefined, gradient: ['grey', 'red'] }],
  })
})

test('a plain flat row still carries no swatch list', () => {
  const [entry] = legendEntries({ items: [{ label: 'Normal', color: 'grey' }] })
  expect(entry).toEqual({
    key: 'items-0',
    label: 'Normal',
    color: 'grey',
    swatches: undefined,
  })
})

test('a box title shows even as the only section', () => {
  expect(
    legendEntries({
      title: 'r² to index SNP',
      items: [{ label: '1.0', color: 'red' }],
    }),
  ).toEqual([
    { key: 'legend-title', label: 'r² to index SNP' },
    { key: 'items-0', label: '1.0', color: 'red' },
  ])
})

test('heading rows carry no color, so they read as headings not swatches', () => {
  const [heading] = legendEntries({ sections: [READS, ARCS] })
  expect(heading!.color).toBeUndefined()
})

// The export carries marks only when they say something a plain color square
// doesn't, so an ordinary entry stays the three fields it has always been and
// every existing consumer keeps rendering it identically.
test('marks reach the export, and only where they mean something', () => {
  const [fill, curve, both] = legendEntries({
    items: [
      { label: 'A', color: 'red' },
      { label: 'B', color: 'blue', mark: 'curve' },
      {
        label: 'C',
        swatches: [{ color: 'pink' }, { color: 'red', mark: 'curve' }],
      },
    ],
  })
  expect(fill!.swatches).toBeUndefined()
  expect(curve!.swatches).toEqual([{ color: 'blue', mark: 'curve' }])
  expect(both!.swatches).toHaveLength(2)
})

test('nonEmptyLegendSections wraps the items shorthand', () => {
  expect(nonEmptyLegendSections({ items: [{ label: 'A' }] })).toEqual([
    { id: 'items', items: [{ label: 'A' }] },
  ])
  expect(nonEmptyLegendSections({})).toEqual([])
})

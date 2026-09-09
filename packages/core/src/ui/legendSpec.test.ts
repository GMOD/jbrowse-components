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

// The export carries a swatch list only for a row showing more than one color,
// so an ordinary entry stays the three fields it has always been and every
// existing consumer keeps rendering it identically.
test('only a multi-color row carries its swatches into the export', () => {
  const [one, both] = legendEntries({
    items: [
      { label: 'A', color: 'red' },
      { label: 'B', swatches: [{ color: 'pink' }, { color: 'red' }] },
    ],
  })
  expect(one!.swatches).toBeUndefined()
  expect(both!.swatches).toEqual([{ color: 'pink' }, { color: 'red' }])
})

test('nonEmptyLegendSections wraps the items shorthand', () => {
  expect(nonEmptyLegendSections({ items: [{ label: 'A' }] })).toEqual([
    { id: 'items', items: [{ label: 'A' }] },
  ])
  expect(nonEmptyLegendSections({})).toEqual([])
})

// A display with two vocabularies usually has only one that toggles. Carrying
// `hidden` per item is what keeps the strike-through off the other section's
// rows and off the section titles when a label appears in both.
test('hidden travels with the item, not with the label', () => {
  const entries = legendEntries({
    sections: [
      {
        id: 'features',
        title: 'Feature colors',
        items: [{ label: 'Wolf', color: 'red', hidden: true }],
      },
      {
        id: 'rowGroups',
        title: 'Row groups',
        items: [{ label: 'Wolf', color: 'blue' }],
      },
    ],
  })
  expect(entries.map(e => [e.label, e.hidden])).toEqual([
    ['Feature colors', undefined],
    ['Wolf', true],
    ['Row groups', undefined],
    ['Wolf', undefined],
  ])
})

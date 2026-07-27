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

test('nonEmptyLegendSections wraps the items shorthand', () => {
  expect(nonEmptyLegendSections({ items: [{ label: 'A' }] })).toEqual([
    { id: 'items', items: [{ label: 'A' }] },
  ])
  expect(nonEmptyLegendSections({})).toEqual([])
})

import {
  countFacetValues,
  filterRowsByFacets,
  filterRowsByText,
  rowSearchText,
} from './facetFilters.ts'

import type { Row } from './components/util.ts'

interface TestRow extends Row {
  name: string
  category?: string
  adapter?: string
  description?: string
  metadata: Record<string, unknown>
  searchText: string
}

// searchText comes from rowSearchText here exactly as it does in allRows
const rows: TestRow[] = [
  {
    id: 't1',
    name: 'Genes',
    category: 'Annotation',
    adapter: 'Gff3TabixAdapter',
    metadata: { sampleType: 'tumor', assay: 'RNA' },
  },
  {
    id: 't2',
    name: 'Variants',
    category: 'Annotation',
    description: 'normal calls',
    metadata: { sampleType: 'normal', assay: 'DNA' },
  },
  {
    id: 't3',
    name: 'Coverage',
    category: 'Quantitative',
    metadata: { sampleType: 'tumor', assay: 'DNA' },
  },
].map(row => ({ ...row, searchText: rowSearchText(row) }))

describe('rowSearchText', () => {
  test('joins the searchable fields, lowercased', () => {
    expect(rows[0]!.searchText).toBe(
      'genes\nannotation\ngff3tabixadapter\ntumor\nrna',
    )
  })

  test('strips markup so a query matches the displayed text, not the tags', () => {
    const searchText = rowSearchText({
      name: '<i>Genes</i>',
      metadata: { note: 'see <a href="http://example.com">link</a>' },
    })
    expect(searchText).toBe('genes\nsee link')
    expect(searchText).not.toContain('href')
  })

  test('leaves out nested metadata, which the grid shows no column for', () => {
    const searchText = rowSearchText({
      name: 'Genes',
      metadata: { assay: 'RNA', ucsc: { visibility: 'dense' }, tags: ['a'] },
    })
    expect(searchText).toBe('genes\nrna')
  })
})

describe('filterRowsByText', () => {
  test('empty query returns the same rows reference', () => {
    expect(filterRowsByText(rows, '')).toBe(rows)
  })
  test('matches name case-insensitively', () => {
    expect(filterRowsByText(rows, 'GEN').map(r => r.id)).toEqual(['t1'])
  })
  test('matches category', () => {
    expect(filterRowsByText(rows, 'quantitative').map(r => r.id)).toEqual([
      't3',
    ])
  })
  test('matches adapter type', () => {
    expect(filterRowsByText(rows, 'gff3tabix').map(r => r.id)).toEqual(['t1'])
  })
  test('matches description', () => {
    expect(filterRowsByText(rows, 'calls').map(r => r.id)).toEqual(['t2'])
  })
  test('matches a metadata value', () => {
    expect(filterRowsByText(rows, 'normal').map(r => r.id)).toEqual(['t2'])
  })
  test('no match returns empty', () => {
    expect(filterRowsByText(rows, 'zzz')).toEqual([])
  })
})

describe('filterRowsByFacets', () => {
  test('empty filter map returns all rows', () => {
    expect(filterRowsByFacets(rows, new Map())).toEqual(rows)
  })
  test('filters by a non-metadata facet', () => {
    expect(
      filterRowsByFacets(rows, new Map([['category', ['Annotation']]])).map(
        r => r.id,
      ),
    ).toEqual(['t1', 't2'])
  })
  test('filters by a metadata facet', () => {
    expect(
      filterRowsByFacets(rows, new Map([['metadata.assay', ['DNA']]])).map(
        r => r.id,
      ),
    ).toEqual(['t2', 't3'])
  })
  test('multiple facets combine with AND', () => {
    expect(
      filterRowsByFacets(
        rows,
        new Map([
          ['category', ['Annotation']],
          ['metadata.assay', ['DNA']],
        ]),
      ).map(r => r.id),
    ).toEqual(['t2'])
  })
})

describe('countFacetValues', () => {
  test('a selected value no row shows any more stays listed, at 0', () => {
    const counts = countFacetValues(
      rows.filter(r => r.id === 't1'),
      'metadata.assay',
      new Map([['metadata.assay', ['DNA']]]),
    )
    expect(counts.get('DNA')).toBe(0)
  })

  test('counts a facet over all rows when nothing is filtered', () => {
    expect([...countFacetValues(rows, 'category', new Map())]).toEqual([
      ['Annotation', 2],
      ['Quantitative', 1],
    ])
    expect([...countFacetValues(rows, 'metadata.assay', new Map())]).toEqual([
      ['RNA', 1],
      ['DNA', 2],
    ])
  })

  test('an active filter drills down other facets but counts itself over the full set', () => {
    const filters = new Map([['metadata.assay', ['DNA']]])
    expect([...countFacetValues(rows, 'metadata.assay', filters)]).toEqual([
      ['RNA', 1],
      ['DNA', 2],
    ])
    expect([...countFacetValues(rows, 'category', filters)]).toEqual([
      ['Annotation', 1],
      ['Quantitative', 1],
    ])
    expect([...countFacetValues(rows, 'metadata.sampleType', filters)]).toEqual(
      [
        ['normal', 1],
        ['tumor', 1],
      ],
    )
  })

  test('each facet reflects every other active filter, independent of order', () => {
    const filters = new Map([
      ['category', ['Annotation']],
      ['metadata.assay', ['DNA']],
    ])
    expect([...countFacetValues(rows, 'category', filters)]).toEqual([
      ['Annotation', 1],
      ['Quantitative', 1],
    ])
    expect([...countFacetValues(rows, 'metadata.assay', filters)]).toEqual([
      ['RNA', 1],
      ['DNA', 1],
    ])
    expect([...countFacetValues(rows, 'metadata.sampleType', filters)]).toEqual(
      [['normal', 1]],
    )
  })
})

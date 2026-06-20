import {
  computeFacetCategoryCounts,
  filterRowsByFacets,
  filterRowsByText,
} from './facetedFilter.ts'

import type { Row } from './components/util.ts'

interface TestRow extends Row {
  name: string
  category?: string
  description?: string
  metadata: Record<string, unknown>
}

const rows: TestRow[] = [
  {
    id: 't1',
    name: 'Genes',
    category: 'Annotation',
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
]

describe('filterRowsByText', () => {
  test('empty query returns the same rows reference', () => {
    expect(filterRowsByText(rows, '')).toBe(rows)
  })
  test('matches name case-insensitively', () => {
    expect(filterRowsByText(rows, 'GEN').map(r => r.id)).toEqual(['t1'])
  })
  test('matches category', () => {
    expect(filterRowsByText(rows, 'quantitative').map(r => r.id)).toEqual(['t3'])
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
  test('a facet with an empty value array does not constrain', () => {
    expect(filterRowsByFacets(rows, new Map([['category', []]]))).toEqual(rows)
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

describe('computeFacetCategoryCounts', () => {
  const facets = ['category', 'metadata.sampleType', 'metadata.assay']

  test('counts every facet over all rows when nothing is filtered', () => {
    const counts = computeFacetCategoryCounts(rows, facets, new Map())
    expect([...counts.get('category')!]).toEqual([
      ['Annotation', 2],
      ['Quantitative', 1],
    ])
    expect([...counts.get('metadata.assay')!]).toEqual([
      ['RNA', 1],
      ['DNA', 2],
    ])
  })

  test('an active filter drills down other facets but counts itself over the full set', () => {
    const counts = computeFacetCategoryCounts(
      rows,
      facets,
      new Map([['metadata.assay', ['DNA']]]),
    )
    // assay counts itself against the full set (drill-down ordering)
    expect([...counts.get('metadata.assay')!]).toEqual([
      ['RNA', 1],
      ['DNA', 2],
    ])
    // other facets count only among the DNA rows (t2, t3)
    expect([...counts.get('category')!]).toEqual([
      ['Annotation', 1],
      ['Quantitative', 1],
    ])
    expect([...counts.get('metadata.sampleType')!]).toEqual([
      ['normal', 1],
      ['tumor', 1],
    ])
  })
})

import { mergeFilter } from '../../shared/alignmentsFilter.ts'
import { getFiltersMenuItems } from './filters.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

function mapqRow(written: FieldPredicate[]) {
  const model = {
    filterPredicates: mergeFilter(written),
    setFilterFields: jest.fn(),
    filterNarrowing: () => ({ count: 0, clear: () => {} }),
  }
  const items = getFiltersMenuItems(model)
  const group = items.find(i => 'subMenu' in i) as {
    subMenu: (MenuItem & { label: string; subMenu?: MenuItem[] })[]
  }
  const row = group.subMenu.find(i => i.label.startsWith('Mapping quality'))!
  const radios = row.subMenu as (MenuItem & {
    label: string
    checked: boolean
    onClick: () => void
  })[]
  return { row, radios, model }
}

test('the mapping-quality row offers the facet bin edges and writes a mapq floor', () => {
  const { radios, model } = mapqRow([])
  expect(radios.map(r => r.label)).toEqual([
    'All reads',
    'MAPQ 1+',
    'MAPQ 10+',
    'MAPQ 30+',
  ])
  expect(radios.find(r => r.checked)?.label).toBe('All reads')
  radios.find(r => r.label === 'MAPQ 10+')!.onClick()
  expect(model.setFilterFields).toHaveBeenCalledWith({
    mapq: [{ field: 'mapq', gte: 10 }],
  })
})

test('a minimum the dialog wrote gets a radio of its own, checked', () => {
  const { row, radios } = mapqRow([{ field: 'mapq', gte: 20 }])
  expect(radios.map(r => r.label)).toContain('MAPQ 20+')
  expect(radios.find(r => r.checked)?.label).toBe('MAPQ 20+')
  expect(row.label).toContain('20+')
})

test('a floor change keeps the ceiling written on the same field', () => {
  const { radios, model } = mapqRow([
    { field: 'mapq', gte: 20 },
    { field: 'mapq', lte: 50 },
  ])
  radios.find(r => r.label === 'MAPQ 30+')!.onClick()
  expect(model.setFilterFields).toHaveBeenCalledWith({
    mapq: [
      { field: 'mapq', gte: 30 },
      { field: 'mapq', lte: 50 },
    ],
  })
})

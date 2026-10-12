import { defaultFilterFlags } from '../../shared/util.ts'
import { getFiltersMenuItems } from './filters.ts'

import type { ReadFilter } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

function mapqRow(readFilter: ReadFilter) {
  const model = { readFilter, setReadFilter: jest.fn() }
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

test('the mapping-quality row offers the facet bin edges and writes minMapq', () => {
  const { radios, model } = mapqRow(defaultFilterFlags)
  expect(radios.map(r => r.label)).toEqual([
    'All reads',
    'MAPQ 1+',
    'MAPQ 10+',
    'MAPQ 30+',
  ])
  expect(radios.find(r => r.checked)?.label).toBe('All reads')
  radios.find(r => r.label === 'MAPQ 10+')!.onClick()
  expect(model.setReadFilter).toHaveBeenCalledWith({
    ...defaultFilterFlags,
    minMapq: 10,
  })
})

test('a minimum the dialog wrote gets a radio of its own, checked', () => {
  const { row, radios } = mapqRow({ ...defaultFilterFlags, minMapq: 20 })
  expect(radios.map(r => r.label)).toContain('MAPQ 20+')
  expect(radios.find(r => r.checked)?.label).toBe('MAPQ 20+')
  expect(row.label).toContain('20+')
})

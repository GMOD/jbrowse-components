import { getFiltersMenuItem } from './filters.ts'

import type { FilterBy } from '../../shared/types.ts'

function baseModel() {
  return {
    filterBy: {} as FilterBy,
    setFilterBy() {},
  }
}

// The alignments display passes the SAM-flag toggles explicitly.
function pairFilters() {
  return {
    drawProperPairs: true,
    setDrawProperPairs(v: boolean) {
      this.drawProperPairs = v
    },
    drawSingletons: true,
    setDrawSingletons(v: boolean) {
      this.drawSingletons = v
    },
  }
}

function subMenuOf(item: ReturnType<typeof getFiltersMenuItem>) {
  return ('subMenu' in item ? item.subMenu : undefined) ?? []
}

describe('filters menu', () => {
  test('with pair filters it is a "Filter by..." submenu', () => {
    const item = getFiltersMenuItem(baseModel(), { pairFilters: pairFilters() })
    expect(item.label).toBe('Filter by...')
    expect(
      subMenuOf(item).flatMap(i => ('label' in i ? [i.label] : ['<divider>'])),
    ).toEqual([
      'Show proper pairs',
      'Show singletons',
      '<divider>',
      'Edit read name / tag / flag filters...',
    ])
  })

  test('proper-pairs checkbox reflects and flips the model', () => {
    const controls = pairFilters()
    const proper = subMenuOf(
      getFiltersMenuItem(baseModel(), { pairFilters: controls }),
    ).find(i => 'label' in i && i.label === 'Show proper pairs')
    if (!proper || !('checked' in proper) || !('onClick' in proper)) {
      throw new Error('no proper-pairs checkbox')
    }
    expect(proper.checked).toBe(true)
    proper.onClick()
    expect(controls.drawProperPairs).toBe(false)
  })

  test('without pair filters (synteny) it stays a single "Edit filters..." action', () => {
    const item = getFiltersMenuItem(baseModel())
    expect(item.label).toBe('Edit filters...')
    expect('subMenu' in item).toBe(false)
    expect('onClick' in item).toBe(true)
  })
})

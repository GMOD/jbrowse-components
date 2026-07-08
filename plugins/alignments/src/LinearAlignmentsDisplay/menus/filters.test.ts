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
      'Hide proper pairs',
      'Hide reads without a mate',
      '<divider>',
      'Edit read name / tag / flag filters...',
    ])
  })

  // "Hide proper pairs" is checked = filtered out, the inverse of the
  // show-oriented drawProperPairs slot.
  test('"Hide proper pairs" is unchecked while shown and hides on click', () => {
    const controls = pairFilters()
    const hideProper = () =>
      subMenuOf(
        getFiltersMenuItem(baseModel(), { pairFilters: controls }),
      ).find(i => 'label' in i && i.label === 'Hide proper pairs')
    const item = hideProper()
    if (!item || !('checked' in item) || !('onClick' in item)) {
      throw new Error('no hide-proper-pairs checkbox')
    }
    expect(item.checked).toBe(false)
    item.onClick()
    expect(controls.drawProperPairs).toBe(false)

    const afterHide = hideProper()
    expect(afterHide && 'checked' in afterHide && afterHide.checked).toBe(true)
  })

  test('without pair filters (synteny) it stays a single "Edit filters..." action', () => {
    const item = getFiltersMenuItem(baseModel())
    expect(item.label).toBe('Edit filters...')
    expect('subMenu' in item).toBe(false)
    expect('onClick' in item).toBe(true)
  })
})

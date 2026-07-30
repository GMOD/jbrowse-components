import { getSyntenyGroupByMenuItem } from './menus.ts'

import type { GroupByType } from '@jbrowse/plugin-alignments'

function makeModel(type?: GroupByType, hideSelfAlignments = false) {
  return {
    groupBy: type ? { type } : undefined,
    setGroupBy: jest.fn(),
    hideSelfAlignments,
    setHideSelfAlignments: jest.fn(),
  }
}

// The menu mixes radios, a divider and a checkbox; every assertion below is
// about the labelled entries, so narrow to those once here.
function items(model: ReturnType<typeof makeModel>) {
  return getSyntenyGroupByMenuItem(model).subMenu.filter(i => 'label' in i)
}

// No "One row per group" here: that toggle is the group's drawn height, not a
// dimension, so the "Show..." menu carries it (`collapseGroupRowsItems`).
test('offers None plus the synteny-applicable dimensions, then the self lane', () => {
  expect(items(makeModel('mateAssembly')).map(i => i.label)).toEqual([
    'None',
    'Mate assembly',
    'Strand',
    'Mapping quality',
    'Hide self-alignment lane',
  ])
})

test('ungrouped checks None', () => {
  expect(
    items(makeModel())
      .filter(i => i.checked)
      .map(i => i.label),
  ).toEqual(['None'])
})

test('the active dimension is the only dimension checked', () => {
  expect(
    items(makeModel('mateAssembly'))
      .filter(i => i.checked)
      .map(i => i.label),
  ).toEqual(['Mate assembly'])
})

test('picking a dimension sets it; picking None ungroups', () => {
  const model = makeModel('mateAssembly')
  items(model)
    .find(i => i.label === 'Strand')!
    .onClick()
  expect(model.setGroupBy).toHaveBeenCalledWith({ type: 'strand' })

  items(model)
    .find(i => i.label === 'None')!
    .onClick()
  expect(model.setGroupBy).toHaveBeenCalledWith(undefined)
})

test('the self-lane toggle reflects and flips hideSelfAlignments', () => {
  const off = makeModel('mateAssembly')
  const item = items(off).find(i => i.label === 'Hide self-alignment lane')!
  expect(item.checked).toBe(false)
  item.onClick()
  expect(off.setHideSelfAlignments).toHaveBeenCalledWith(true)

  const on = makeModel('mateAssembly', true)
  items(on)
    .find(i => i.label === 'Hide self-alignment lane')!
    .onClick()
  expect(on.setHideSelfAlignments).toHaveBeenCalledWith(false)
})

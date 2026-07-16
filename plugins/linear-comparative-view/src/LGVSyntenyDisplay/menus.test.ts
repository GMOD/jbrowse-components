import { getSyntenyGroupByMenuItem } from './menus.ts'

import type { GroupByType } from '@jbrowse/plugin-alignments'

function makeModel(type?: GroupByType) {
  return {
    groupBy: type ? { type } : undefined,
    setGroupBy: jest.fn(),
  }
}

function radios(model: ReturnType<typeof makeModel>) {
  return getSyntenyGroupByMenuItem(model).subMenu
}

test('offers None plus the synteny-applicable dimensions', () => {
  expect(radios(makeModel()).map(i => i.label)).toEqual([
    'None',
    'Mate assembly',
    'Strand',
    'MAPQ (binned)',
  ])
})

test('ungrouped checks None', () => {
  expect(radios(makeModel()).filter(i => i.checked).map(i => i.label)).toEqual([
    'None',
  ])
})

test('the active dimension is the only one checked', () => {
  expect(
    radios(makeModel('mateAssembly'))
      .filter(i => i.checked)
      .map(i => i.label),
  ).toEqual(['Mate assembly'])
})

test('picking a dimension sets it; picking None ungroups', () => {
  const model = makeModel('mateAssembly')
  radios(model).find(i => i.label === 'Strand')!.onClick()
  expect(model.setGroupBy).toHaveBeenCalledWith({ type: 'strand' })

  radios(model).find(i => i.label === 'None')!.onClick()
  expect(model.setGroupBy).toHaveBeenCalledWith(undefined)
})

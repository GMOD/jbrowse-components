import { SimpleFeature } from '@jbrowse/core/util'

import {
  checkedPanels,
  movePanel,
  setPanelChecked,
  toPanelRows,
} from './panelOrder.ts'

import type { MateCandidate } from './pickMatesForRegion.ts'

function candidates(...assemblyNames: string[]): MateCandidate[] {
  return assemblyNames.map(assemblyName => ({
    assemblyName,
    feature: new SimpleFeature({
      uniqueId: assemblyName,
      refName: 'chr',
      start: 0,
      end: 1,
    }),
  }))
}

const rows = toPanelRows(candidates('Sakai', 'CFT073', 'IAI39'))

function names(list: ReturnType<typeof toPanelRows>) {
  return list.map(r => r.assemblyName)
}

test('every discovered mate starts as a panel', () => {
  expect(rows.every(r => r.checked)).toBe(true)
  expect(names(rows)).toEqual(['Sakai', 'CFT073', 'IAI39'])
})

test('moving a panel swaps it with its neighbour', () => {
  expect(names(movePanel(rows, 2, -1))).toEqual(['Sakai', 'IAI39', 'CFT073'])
  expect(names(movePanel(rows, 0, 1))).toEqual(['CFT073', 'Sakai', 'IAI39'])
})

test('moving past either end is a no-op', () => {
  expect(names(movePanel(rows, 0, -1))).toEqual(names(rows))
  expect(names(movePanel(rows, 2, 1))).toEqual(names(rows))
})

// unchecking must not drop the row, or re-checking would append it at the
// bottom and silently change which panels are adjacent
test('unchecking keeps the row in place', () => {
  const unchecked = setPanelChecked(rows, 1, false)
  expect(names(unchecked)).toEqual(['Sakai', 'CFT073', 'IAI39'])
  expect(names(checkedPanels(unchecked))).toEqual(['Sakai', 'IAI39'])
  expect(names(checkedPanels(setPanelChecked(unchecked, 1, true)))).toEqual([
    'Sakai',
    'CFT073',
    'IAI39',
  ])
})

test('reordering carries the unchecked rows along', () => {
  const unchecked = setPanelChecked(rows, 0, false)
  expect(names(movePanel(unchecked, 2, -1))).toEqual([
    'Sakai',
    'IAI39',
    'CFT073',
  ])
})

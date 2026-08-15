import {
  launchOrder,
  movePanel,
  setAllPanelsChecked,
  setPanelChecked,
  toPanelRows,
} from './panelOrder.ts'

import type { PanelRow } from './panelOrder.ts'
import type { ResolvedPanel } from './resolvePanel.ts'

function panels(...assemblyNames: string[]): ResolvedPanel[] {
  return assemblyNames.map(assemblyName => ({
    assemblyName,
    refName: 'ctg',
    anchorStart: 0,
    anchorEnd: 1,
    mateStart: 10,
    mateEnd: 20,
    reversed: false,
  }))
}

const rows = toPanelRows('K12', panels('Sakai', 'CFT073', 'IAI39'))

function names(list: PanelRow[]) {
  return list.map(r => r.assemblyName)
}

function spanOf(list: PanelRow[], assemblyName: string) {
  const row = list.find(r => r.assemblyName === assemblyName)
  return row?.kind === 'mate'
    ? { start: row.mateStart, end: row.mateEnd, refName: row.refName }
    : undefined
}

test('the anchor leads the list and every discovered mate starts checked', () => {
  expect(names(rows)).toEqual(['K12', 'Sakai', 'CFT073', 'IAI39'])
  expect(rows.filter(r => r.kind === 'mate').every(r => r.checked)).toBe(true)
})

// The row IS where its panel opens — the worker resolved it, and reordering or
// unchecking moves the panel rather than moving the locus, so both have to
// carry it through.
test('a row carries its resolved locus through a reorder and an uncheck', () => {
  expect(spanOf(rows, 'Sakai')).toEqual({
    refName: 'ctg',
    start: 10,
    end: 20,
  })
  const moved = movePanel(setPanelChecked(rows, 1, false), 1, 1)
  expect(spanOf(moved, 'Sakai')).toEqual(spanOf(rows, 'Sakai'))
})

test('moving a panel swaps it with its neighbour', () => {
  expect(names(movePanel(rows, 3, -1))).toEqual([
    'K12',
    'Sakai',
    'IAI39',
    'CFT073',
  ])
  expect(names(movePanel(rows, 0, 1))).toEqual([
    'Sakai',
    'K12',
    'CFT073',
    'IAI39',
  ])
})

test('moving past either end is a no-op', () => {
  expect(names(movePanel(rows, 0, -1))).toEqual(names(rows))
  expect(names(movePanel(rows, 3, 1))).toEqual(names(rows))
})

// unchecking must not drop the row, or re-checking would append it at the
// bottom and silently change which panels are adjacent
test('unchecking keeps the row in place', () => {
  const unchecked = setPanelChecked(rows, 2, false)
  expect(names(unchecked)).toEqual(['K12', 'Sakai', 'CFT073', 'IAI39'])
  expect(names(launchOrder(unchecked).mates)).toEqual(['Sakai', 'IAI39'])
  expect(names(launchOrder(setPanelChecked(unchecked, 2, true)).mates)).toEqual(
    ['Sakai', 'CFT073', 'IAI39'],
  )
})

test('reordering carries the unchecked rows along', () => {
  const unchecked = setPanelChecked(rows, 1, false)
  expect(names(movePanel(unchecked, 3, -1))).toEqual([
    'K12',
    'Sakai',
    'IAI39',
    'CFT073',
  ])
})

// the anchor is where the coordinates came from, so the launch can't drop it
test('the anchor cannot be unchecked, one at a time or in bulk', () => {
  expect(launchOrder(setPanelChecked(rows, 0, false)).anchorIndex).toBe(0)
  const none = setAllPanelsChecked(rows, false)
  expect(names(launchOrder(none).mates)).toEqual([])
  expect(launchOrder(none).anchorIndex).toBe(0)
  expect(names(launchOrder(setAllPanelsChecked(none, true)).mates)).toEqual([
    'Sakai',
    'CFT073',
    'IAI39',
  ])
})

// three panels off a reference-anchored dataset: with the anchor in the middle
// both bands are direct pairs, with it on top only the first one is
test('dragging the anchor down reports its index in the launched stack', () => {
  const middle = movePanel(rows, 0, 1)
  expect(names(middle)).toEqual(['Sakai', 'K12', 'CFT073', 'IAI39'])
  expect(launchOrder(middle).anchorIndex).toBe(1)
  expect(names(launchOrder(middle).mates)).toEqual(['Sakai', 'CFT073', 'IAI39'])
})

// an unchecked row above the anchor must not count toward its index, or the
// anchor lands one panel lower than the list showed
test('the anchor index counts only the panels being launched', () => {
  const middle = movePanel(rows, 0, 2)
  expect(names(middle)).toEqual(['Sakai', 'CFT073', 'K12', 'IAI39'])
  expect(launchOrder(setPanelChecked(middle, 0, false)).anchorIndex).toBe(1)
})

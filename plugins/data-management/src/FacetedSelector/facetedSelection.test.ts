import { getRowSelectionState } from './facetedSelection.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'

const rows = [{ id: 't1' }, { id: 't2' }, { id: 't3' }]

// Minimal stand-ins for the bits of the track-selector model the selection
// helpers touch; cast at the boundary so the tests stay readable.
function nonCartModel() {
  const shown = new Set<string>()
  const recent: string[] = []
  const model = {
    trackContainer: {
      launchTrack: async (id: string) => shown.add(id),
      hideTrack: (id: string) => shown.delete(id),
    },
    addToRecentlyUsed: (id: string) => recent.push(id),
  } as unknown as HierarchicalTrackSelectorModel
  return { model, shown, recent }
}

function cartModel(selectionIds: string[]) {
  const selectionSet = new Set(selectionIds)
  const added: string[][] = []
  const removed: string[][] = []
  const model = {
    selectionSet,
    addToSelection: (ids: string[]) => added.push(ids),
    removeFromSelection: (ids: string[]) => removed.push(ids),
  } as unknown as HierarchicalTrackSelectorModel
  return { model, selectionSet, added, removed }
}

describe('derived selection state (shown-tracks mode)', () => {
  test('partial selection is indeterminate', () => {
    const { selectedIds, allSelected, someSelected } = getRowSelectionState({
      model: nonCartModel().model,
      useShoppingCart: false,
      shownTrackIds: new Set(['t1']),
      selectionSet: new Set<string>(),
      filteredRows: rows,
    })
    expect(selectedIds.has('t1')).toBe(true)
    expect(allSelected).toBe(false)
    expect(someSelected).toBe(true)
  })

  test('all rows selected', () => {
    const { allSelected, someSelected } = getRowSelectionState({
      model: nonCartModel().model,
      useShoppingCart: false,
      shownTrackIds: new Set(['t1', 't2', 't3']),
      selectionSet: new Set<string>(),
      filteredRows: rows,
    })
    expect(allSelected).toBe(true)
    expect(someSelected).toBe(false)
  })

  test('nothing selected', () => {
    const { allSelected, someSelected } = getRowSelectionState({
      model: nonCartModel().model,
      useShoppingCart: false,
      shownTrackIds: new Set(),
      selectionSet: new Set<string>(),
      filteredRows: rows,
    })
    expect(allSelected).toBe(false)
    expect(someSelected).toBe(false)
  })
})

describe('derived selection state (shopping-cart mode)', () => {
  test('selection set drives selectedIds', () => {
    const { model, selectionSet } = cartModel(['t2'])
    const { selectedIds, someSelected } = getRowSelectionState({
      model,
      useShoppingCart: true,
      shownTrackIds: new Set(),
      selectionSet,
      filteredRows: rows,
    })
    expect([...selectedIds]).toEqual(['t2'])
    expect(someSelected).toBe(true)
  })
})

describe('toggle handlers (shown-tracks mode)', () => {
  test('toggleRow shows an unselected track and records recent use', async () => {
    const { model, shown, recent } = nonCartModel()
    getRowSelectionState({
      model,
      useShoppingCart: false,
      shownTrackIds: new Set(),
      selectionSet: new Set<string>(),
      filteredRows: rows,
    }).toggleRow('t2')
    // the show goes through the async launchTrack path now
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(shown.has('t2')).toBe(true)
    expect(recent).toEqual(['t2'])
  })

  test('toggleRow hides an already-selected track', () => {
    const { model, shown } = nonCartModel()
    shown.add('t2')
    getRowSelectionState({
      model,
      useShoppingCart: false,
      shownTrackIds: new Set(['t2']),
      selectionSet: new Set<string>(),
      filteredRows: rows,
    }).toggleRow('t2')
    expect(shown.has('t2')).toBe(false)
  })

  test('toggleAll shows the rows not yet selected', async () => {
    const { model, shown } = nonCartModel()
    getRowSelectionState({
      model,
      useShoppingCart: false,
      shownTrackIds: new Set(['t1']),
      selectionSet: new Set<string>(),
      filteredRows: rows,
    }).toggleAll()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect([...shown].sort()).toEqual(['t2', 't3'])
  })
})

describe('toggle handlers (shopping-cart mode)', () => {
  test('toggleRow adds the track to the selection', () => {
    const { model, selectionSet, added } = cartModel([])
    getRowSelectionState({
      model,
      useShoppingCart: true,
      shownTrackIds: new Set(),
      selectionSet,
      filteredRows: rows,
    }).toggleRow('t1')
    expect(added).toEqual([['t1']])
  })

  test('toggleRow removes one already in the selection', () => {
    const { model, selectionSet, removed } = cartModel(['t1'])
    getRowSelectionState({
      model,
      useShoppingCart: true,
      shownTrackIds: new Set(),
      selectionSet,
      filteredRows: rows,
    }).toggleRow('t1')
    expect(removed).toEqual([['t1']])
  })
})

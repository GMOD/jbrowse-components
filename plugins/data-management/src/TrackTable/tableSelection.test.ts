import { getRowSelectionState, setTracksSelected } from './tableSelection.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'

const rows = [
  { id: 't1', name: 'one' },
  { id: 't2', name: 'two' },
  { id: 't3', name: 'three' },
]

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
    const { allSelected, someSelected } = getRowSelectionState({
      model: nonCartModel().model,
      useShoppingCart: false,
      shownTrackIds: new Set(['t1']),
      selectionSet: new Set<string>(),
      filteredRows: rows,
    })
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
  test('the selection set, not the shown tracks, drives the state', () => {
    const { model, selectionSet } = cartModel(['t2'])
    const { allSelected, someSelected } = getRowSelectionState({
      model,
      useShoppingCart: true,
      shownTrackIds: new Set(['t1', 't2', 't3']),
      selectionSet,
      filteredRows: rows,
    })
    expect(allSelected).toBe(false)
    expect(someSelected).toBe(true)
  })

  test('select-all skips a placeholder track, which never counts as unselected', () => {
    const withPlaceholders = [
      ...rows,
      { id: 'ucsc', name: 'bigInteract track (Unsupported)' },
      { id: 'jb1', name: 'mystery (Unknown)' },
    ]
    const some = cartModel(['t1'])
    getRowSelectionState({
      model: some.model,
      useShoppingCart: true,
      shownTrackIds: new Set(),
      selectionSet: some.selectionSet,
      filteredRows: withPlaceholders,
    }).toggleAll()
    expect(some.added).toEqual([['t2', 't3']])

    const all = cartModel(['t1', 't2', 't3'])
    const state = getRowSelectionState({
      model: all.model,
      useShoppingCart: true,
      shownTrackIds: new Set(),
      selectionSet: all.selectionSet,
      filteredRows: withPlaceholders,
    })
    expect(state.allSelected).toBe(true)
    state.toggleAll()
    expect(all.removed).toEqual([['t1', 't2', 't3']])
  })
})

describe('toggle handlers (shown-tracks mode)', () => {
  test('selecting a track shows it and records recent use', async () => {
    const { model, shown, recent } = nonCartModel()
    setTracksSelected(model, ['t2'], true, false)
    // the show goes through the async launchTrack path now
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(shown.has('t2')).toBe(true)
    expect(recent).toEqual(['t2'])
  })

  test('deselecting a track hides it', () => {
    const { model, shown } = nonCartModel()
    shown.add('t2')
    setTracksSelected(model, ['t2'], false, false)
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
  test('selecting a track adds it to the selection', () => {
    const { model, added } = cartModel([])
    setTracksSelected(model, ['t1'], true, true)
    expect(added).toEqual([['t1']])
  })

  test('deselecting a track removes it from the selection', () => {
    const { model, removed } = cartModel(['t1'])
    setTracksSelected(model, ['t1'], false, true)
    expect(removed).toEqual([['t1']])
  })
})

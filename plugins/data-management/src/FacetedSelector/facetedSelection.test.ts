import { getRowSelectionState } from './facetedSelection.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const rows = [{ id: 't1' }, { id: 't2' }, { id: 't3' }]

// Minimal stand-ins for the bits of the track-selector model the selection
// helpers touch; cast at the boundary so the tests stay readable.
function nonCartModel() {
  const shown = new Set<string>()
  const recent: string[] = []
  const model = {
    view: {
      showTrack: (id: string) => shown.add(id),
      hideTrack: (id: string) => shown.delete(id),
    },
    addToRecentlyUsed: (id: string) => recent.push(id),
  } as unknown as HierarchicalTrackSelectorModel
  return { model, shown, recent }
}

function cartModel(selectionIds: string[]) {
  const selection = selectionIds.map(id => ({ trackId: id }))
  const setSelectionCalls: { trackId: string }[][] = []
  const model = {
    selection,
    setSelection: (s: { trackId: string }[]) => setSelectionCalls.push(s),
    allTrackConfigurationMap: new Map(
      ['t1', 't2', 't3'].map(id => [id, { trackId: id }]),
    ),
  } as unknown as HierarchicalTrackSelectorModel
  return {
    model,
    selection: selection as unknown as AnyConfigurationModel[],
    setSelectionCalls,
  }
}

describe('derived selection state (shown-tracks mode)', () => {
  test('partial selection is indeterminate', () => {
    const { selectedIds, allSelected, someSelected } = getRowSelectionState({
      model: nonCartModel().model,
      useShoppingCart: false,
      shownTrackIds: new Set(['t1']),
      selection: [],
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
      selection: [],
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
      selection: [],
      filteredRows: rows,
    })
    expect(allSelected).toBe(false)
    expect(someSelected).toBe(false)
  })
})

describe('derived selection state (shopping-cart mode)', () => {
  test('selection set drives selectedIds', () => {
    const { model, selection } = cartModel(['t2'])
    const { selectedIds, someSelected } = getRowSelectionState({
      model,
      useShoppingCart: true,
      shownTrackIds: new Set(),
      selection,
      filteredRows: rows,
    })
    expect([...selectedIds]).toEqual(['t2'])
    expect(someSelected).toBe(true)
  })
})

describe('toggle handlers (shown-tracks mode)', () => {
  test('toggleRow shows an unselected track and records recent use', () => {
    const { model, shown, recent } = nonCartModel()
    getRowSelectionState({
      model,
      useShoppingCart: false,
      shownTrackIds: new Set(),
      selection: [],
      filteredRows: rows,
    }).toggleRow('t2')
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
      selection: [],
      filteredRows: rows,
    }).toggleRow('t2')
    expect(shown.has('t2')).toBe(false)
  })

  test('toggleAll shows the rows not yet selected', () => {
    const { model, shown } = nonCartModel()
    getRowSelectionState({
      model,
      useShoppingCart: false,
      shownTrackIds: new Set(['t1']),
      selection: [],
      filteredRows: rows,
    }).toggleAll()
    expect([...shown].sort()).toEqual(['t2', 't3'])
  })
})

describe('toggle handlers (shopping-cart mode)', () => {
  test('toggleRow adds the track config to the selection', () => {
    const { model, selection, setSelectionCalls } = cartModel([])
    getRowSelectionState({
      model,
      useShoppingCart: true,
      shownTrackIds: new Set(),
      selection,
      filteredRows: rows,
    }).toggleRow('t1')
    expect(setSelectionCalls).toHaveLength(1)
    expect(setSelectionCalls[0]!.map(s => s.trackId)).toEqual(['t1'])
  })
})

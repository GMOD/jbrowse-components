import { getShowAllState, setTracksShown } from './tableSelection.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'

const rows = [
  { id: 't1', name: 'one' },
  { id: 't2', name: 'two' },
  { id: 't3', name: 'three' },
]

const withPlaceholders = [
  ...rows,
  { id: 'ucsc', name: 'bigInteract track (Unsupported)' },
  { id: 'jb1', name: 'mystery (Unknown)' },
]

// Minimal stand-ins for the bits of the track-selector model the helpers
// touch; cast at the boundary so the tests stay readable.
function fakeModel(shownIds: string[] = []) {
  const shown = new Set(shownIds)
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

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

describe('show-all state', () => {
  test('some shown is indeterminate', () => {
    const { model, shown } = fakeModel(['t1'])
    const state = getShowAllState({ model, shownTrackIds: shown, rows })
    expect(state.allShown).toBe(false)
    expect(state.someShown).toBe(true)
  })

  test('every row shown', () => {
    const { model, shown } = fakeModel(['t1', 't2', 't3'])
    const state = getShowAllState({ model, shownTrackIds: shown, rows })
    expect(state.allShown).toBe(true)
    expect(state.someShown).toBe(false)
  })

  test('nothing shown', () => {
    const { model, shown } = fakeModel()
    const state = getShowAllState({ model, shownTrackIds: shown, rows })
    expect(state.allShown).toBe(false)
    expect(state.someShown).toBe(false)
  })

  test('a placeholder track never counts as hidden', () => {
    const { model, shown } = fakeModel(['t1', 't2', 't3'])
    expect(
      getShowAllState({ model, shownTrackIds: shown, rows: withPlaceholders })
        .allShown,
    ).toBe(true)
  })
})

describe('toggles', () => {
  test('showing a track records recent use', async () => {
    const { model, shown, recent } = fakeModel()
    setTracksShown(model, ['t2'], true)
    await settle()
    expect(shown.has('t2')).toBe(true)
    expect(recent).toEqual(['t2'])
  })

  test('hiding a track', () => {
    const { model, shown } = fakeModel(['t2'])
    setTracksShown(model, ['t2'], false)
    expect(shown.has('t2')).toBe(false)
  })

  test('toggleAll shows the rows not yet shown and skips placeholders', async () => {
    const { model, shown } = fakeModel(['t1'])
    getShowAllState({
      model,
      shownTrackIds: new Set(shown),
      rows: withPlaceholders,
    }).toggleAll()
    await settle()
    expect([...shown].sort()).toEqual(['t1', 't2', 't3'])
  })

  test('toggleAll hides every row once all are shown', () => {
    const { model, shown } = fakeModel(['t1', 't2', 't3'])
    getShowAllState({
      model,
      shownTrackIds: new Set(shown),
      rows,
    }).toggleAll()
    expect(shown.size).toBe(0)
  })
})

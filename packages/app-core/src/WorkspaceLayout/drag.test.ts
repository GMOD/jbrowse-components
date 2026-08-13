import { applySnapshot, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { WorkspaceLayoutMixin } from './model.ts'
import { isBranch } from './tree.ts'

const TestSession = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  WorkspaceLayoutMixin(),
)

// two cells side by side. left has two tabs (view-1, view-2), right has one
// (view-3) — the shape every drag question needs.
function twoPanels() {
  const session = TestSession.create({ name: 't' })
  const left = session.panels[0]!.id
  const tabA = session.tabs[0]!.id
  session.addViewToTab(tabA, 'view-1')
  const tabB = session.addTab(left, ['view-2'])!.id
  const rightPanel = session.splitPanel(left, 'row')!
  const right = rightPanel.id
  const tabC = rightPanel.tabs[0]!.id
  session.addViewToTab(tabC, 'view-3')
  return { session, left, right, tabA, tabB, tabC }
}

test('dropping a tab in another cell moves it, and only it', () => {
  const { session, left, right, tabB } = twoPanels()

  session.dropTabInPanel(tabB, right)

  expect(session.findTab(tabB)?.panel.id).toBe(right)
  expect(session.panelContainingView('view-1')?.id).toBe(left)
  expect(session.panels.length).toBe(2)
  expect(session.activePanelId).toBe(right)
})

test('dragging the last tab out of a cell collapses it', () => {
  const { session, left, tabC } = twoPanels()

  session.dropTabInPanel(tabC, left)

  expect(session.panels.length).toBe(1)
  expect(session.panels[0]!.id).toBe(left)
  expect(session.panels[0]!.size).toBe(1)
  expect(session.panels[0]!.tabs).toHaveLength(3)
})

test('dropping on an edge splits and lands in the new half', () => {
  const { session, right, tabA } = twoPanels()

  const created = session.dropTabInNewSplit(tabA, right, 'column', false)

  expect(session.findTab(tabA)?.panel.id).toBe(created)
  expect(session.panels.length).toBe(3)
  expect(isBranch(session.tree) && session.tree.children.length).toBe(2)
  expect(session.activePanelId).toBe(created)
})

// The case that would otherwise need a guard: the gesture is a no-op, and it
// falls out of pruning the empty source rather than being special-cased.
test('dropping a cell’s only tab on its own edge collapses back', () => {
  const { session, right, tabC } = twoPanels()

  session.dropTabInNewSplit(tabC, right, 'row', false)

  expect(session.panels.length).toBe(2)
  expect(session.findTab(tabC)).toBeDefined()
  expect(session.panels.every(p => p.tabs.length > 0)).toBe(true)
})

// The gesture no longer publishes a drag for this at all, so nothing reaches
// the action by that route — which is the reason to pin it here. `useLayoutDrag`
// declining and `dropTabInPanel` declining are one rule at two layers, the same
// shape as `moveTabToPanel`'s totality under the model's own guards.
test('dropping a tab in its own cell without an index does nothing', () => {
  const { session, left, tabA, tabB } = twoPanels()
  const before = getSnapshot(session)

  session.dropTabInPanel(tabA, left)

  expect(session.panels.find(p => p.id === left)!.tabs.map(t => t.id)).toEqual([
    tabA,
    tabB,
  ])
  expect(getSnapshot(session)).toEqual(before)
})

test('a cell with tabs left over is not pruned', () => {
  const { session, right, tabA, left } = twoPanels()

  session.dropTabInPanel(tabA, right)

  // left still has tabB, so it stays
  expect(session.panels.map(p => p.id).sort()).toEqual([left, right].sort())
  expect(session.panelContainingView('view-2')?.id).toBe(left)
})

test('a drop is a single action, so undo takes back the whole gesture', () => {
  const { session, right, tabA } = twoPanels()
  const before = getSnapshot(session)

  session.dropTabInNewSplit(tabA, right, 'column', false)
  expect(session.panels.length).toBe(3)

  applySnapshot(session, before)

  expect(session.panels.length).toBe(2)
  expect(session.findTab(tabA)?.panel.id).toBe(session.panels[0]!.id)
})

test('sizes stay normalised through a drag', () => {
  const { session, right, tabA } = twoPanels()
  session.setSizes((session.layout as unknown as { id: string }).id, [0.8, 0.2])

  session.dropTabInNewSplit(tabA, right, 'column', false)

  const root = session.tree
  expect(isBranch(root)).toBe(true)
  if (isBranch(root)) {
    const total = root.children.reduce((sum, c) => sum + c.size, 0)
    expect(total).toBeCloseTo(1, 6)
    // the left pane kept its 80% — a split on the right does not move it
    expect(root.children[0]!.size).toBeCloseTo(0.8, 6)
  }
})

// The mirror of "dragging the last tab out of a cell collapses it", by the
// gesture that empties the same cell without moving anything: closing its last
// tab. It left a blank half of the split that rendered NOTHING — not even the
// view launcher an empty tab shows — with only the `+` to get out of it.
test('closing the last tab of one half of a split collapses it too', () => {
  const { session, left, tabC } = twoPanels()

  session.closeTab(tabC)

  expect(session.panels).toHaveLength(1)
  expect(session.panels[0]!.id).toBe(left)
  expect(session.panels[0]!.size).toBe(1)
  expect(session.activePanelId).toBe(left)
})

// but a cell with tabs left over is not a cell anyone emptied
test('closing one of several tabs leaves the cell standing', () => {
  const { session, left, tabA } = twoPanels()

  session.closeTab(tabA)

  expect(session.panels).toHaveLength(2)
  expect(session.panels.map(p => p.id)).toContain(left)
})

// and the last cell in the workspace has nowhere to collapse to, so it stays —
// `pruneEmptyPanel` already refuses, and this is the state `removePanel` hands
// back for the same reason
test('closing the last tab of the only cell keeps the cell', () => {
  const session = TestSession.create({ name: 't' })

  session.closeTab(session.tabs[0]!.id)

  expect(session.panels).toHaveLength(1)
  expect(session.panels[0]!.tabs).toEqual([])
})

test('a moved tab keeps its views and its title', () => {
  const { session, right, tabB } = twoPanels()
  session.renameTab(tabB, 'Renamed')

  session.dropTabInPanel(tabB, right)

  const moved = session.findTab(tabB)!
  expect(moved.panel.id).toBe(right)
  expect(moved.tab.title).toBe('Renamed')
  expect(moved.tab.viewIds).toEqual(['view-2'])
})

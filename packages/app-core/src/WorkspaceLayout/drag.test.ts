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
  const tabB = session.addTab(left, ['view-2']).id
  const rightPanel = session.splitPanel(left, 'row')
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

test('a moved tab keeps its views and its title', () => {
  const { session, right, tabB } = twoPanels()
  session.renameTab(tabB, 'Renamed')

  session.dropTabInPanel(tabB, right)

  const moved = session.findTab(tabB)!
  expect(moved.panel.id).toBe(right)
  expect(moved.tab.title).toBe('Renamed')
  expect(moved.tab.viewIds).toEqual(['view-2'])
})

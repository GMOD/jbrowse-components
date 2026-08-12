import { applySnapshot, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { WorkspaceLayoutMixin } from './model.ts'
import { isBranch, panels } from './tree.ts'

const TestSession = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  WorkspaceLayoutMixin(),
)

// two panels side by side: left holds view-1 and view-2, right holds view-3
function twoPanels() {
  const session = TestSession.create({ name: 't' })
  const left = session.panels[0]!.id
  session.addViewToPanel(left, 'view-1')
  session.addViewToPanel(left, 'view-2')
  const right = session.splitPanel(left, 'row')
  session.addViewToPanel(right, 'view-3')
  return { session, left, right }
}

test('dropping a tab in another panel moves it, and only it', () => {
  const { session, left, right } = twoPanels()

  session.dropViewInPanel('view-2', right)

  expect(session.panelContainingView('view-2')?.id).toBe(right)
  expect(session.panelContainingView('view-1')?.id).toBe(left)
  expect(session.panels.length).toBe(2)
  expect(session.activePanelId).toBe(right)
})

test('dragging the last view out of a panel collapses it', () => {
  const { session, left, right } = twoPanels()

  session.dropViewInPanel('view-3', left)

  expect(session.panels.length).toBe(1)
  expect(session.panels[0]!.id).toBe(left)
  expect(session.panels[0]!.size).toBe(1)
  expect(
    panels(session.tree)
      .flatMap(p => p.viewIds)
      .sort(),
  ).toEqual(['view-1', 'view-2', 'view-3'])
  void right
})

test('dropping on an edge splits and lands in the new half', () => {
  const { session, right } = twoPanels()

  const created = session.dropViewInNewSplit('view-1', right, 'column', false)

  expect(session.panelContainingView('view-1')?.id).toBe(created)
  expect(session.panels.length).toBe(3)
  // right was split vertically, so the row still has two children
  expect(isBranch(session.tree) && session.tree.children.length).toBe(2)
  expect(session.activePanelId).toBe(created)
})

// The case that would otherwise need a guard: the gesture is a no-op, and it
// falls out of pruning the empty source rather than being special-cased.
test('dropping a panel’s only view on its own edge collapses back', () => {
  const { session, right } = twoPanels()

  session.dropViewInNewSplit('view-3', right, 'row', false)

  expect(session.panels.length).toBe(2)
  expect(session.panelContainingView('view-3')).toBeDefined()
  expect(session.panels.every(p => p.viewIds.length > 0)).toBe(true)
})

test('an empty panel made on purpose survives a drag elsewhere', () => {
  const { session, left, right } = twoPanels()
  const empty = session.splitPanel(right, 'column')

  session.dropViewInPanel('view-1', right)

  // the deliberate empty panel is still there; only a drag's own source is pruned
  expect(session.panels.map(p => p.id)).toContain(empty)
  expect(session.panelContainingView('view-2')?.id).toBe(left)
})

test('a drop is a single action, so undo takes back the whole gesture', () => {
  const { session, right } = twoPanels()
  const before = getSnapshot(session)

  session.dropViewInNewSplit('view-1', right, 'column', false)
  expect(session.panels.length).toBe(3)

  // one action in, one snapshot back out
  applySnapshot(session, before)

  expect(session.panels.length).toBe(2)
  expect(session.panelContainingView('view-1')?.id).toBe(session.panels[0]!.id)
})

test('sizes stay normalised through a drag', () => {
  const { session, right } = twoPanels()
  session.setSizes((session.layout as unknown as { id: string }).id, [0.8, 0.2])

  session.dropViewInNewSplit('view-1', right, 'column', false)

  const root = session.tree
  expect(isBranch(root)).toBe(true)
  if (isBranch(root)) {
    const total = root.children.reduce((sum, c) => sum + c.size, 0)
    expect(total).toBeCloseTo(1, 6)
    // the left pane kept its 80% — a split on the right does not move it
    expect(root.children[0]!.size).toBeCloseTo(0.8, 6)
  }
})

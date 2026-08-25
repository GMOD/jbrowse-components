import { applySnapshot, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { WorkspaceLayoutMixin } from './model.ts'

const TestSession = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  WorkspaceLayoutMixin(),
)

function createSession() {
  const session = TestSession.create({ name: 'test' })
  session.addViewToTab(session.tabs[0]!.id, 'view-1')
  return session
}

test('a split is one action and the tree is immediately consistent', () => {
  const session = createSession()
  const left = session.panels[0]!.id
  const right = session.splitPanel(left, 'row')!.id

  expect(session.panels.map(p => p.id)).toEqual([left, right])
  expect(session.activePanelId).toBe(right)
  expect(session.panelContainingView('view-1')?.id).toBe(left)
})

test('a new tab lands in the cell it was asked for, and becomes active', () => {
  const session = createSession()
  const panelId = session.panels[0]!.id
  const tab = session.addTab(panelId)!

  const panel = session.panels[0]!
  expect(panel.tabs.map(t => t.id)).toEqual([session.tabs[0]!.id, tab.id])
  expect(panel.activeTabId).toBe(tab.id)
  // an empty tab is the view launcher, not a bug
  expect(tab.viewIds).toEqual([])
})

test('closing a tab falls back to its left neighbour', () => {
  const session = createSession()
  const panelId = session.panels[0]!.id
  const first = session.tabs[0]!.id
  const second = session.addTab(panelId)!.id
  const third = session.addTab(panelId)!.id
  expect(session.activeTabOf(panelId)?.id).toBe(third)

  session.closeTab(third)
  expect(session.activeTabOf(panelId)?.id).toBe(second)
  session.closeTab(second)
  expect(session.activeTabOf(panelId)?.id).toBe(first)
})

// The point of the exercise. Undo is applySnapshot on the session and nothing
// else has to be notified, because nothing else holds layout state. In the
// dockview seam this needed an autorun that re-applied the blob, and that
// autorun is what had to be stopped from running mid-mutation.
test('undo is applySnapshot, with nothing to notify', () => {
  const session = createSession()
  const before = getSnapshot(session)

  const right = session.splitPanel(session.panels[0]!.id, 'row')!
  session.addViewToTab(right.tabs[0]!.id, 'view-2')
  expect(session.panels.length).toBe(2)

  applySnapshot(session, before)

  expect(session.panels.length).toBe(1)
  expect(session.panelContainingView('view-1')).toBeDefined()
  expect(session.panelContainingView('view-2')).toBeUndefined()
})

// The dockview seam wrote api.toJSON() back into the session on every layout
// event, and `types.frozen` set to a deep-equal-but-new object still fires
// onSnapshot — so an undo pushed its own re-serialisation into the undo history
// 300ms later and truncated the redo stack. With one owner there is no echo to
// write back, so a settled layout emits nothing at all.
test('a settled layout produces no further snapshots', () => {
  const session = createSession()
  session.splitPanel(session.panels[0]!.id, 'row')

  let snapshots = 0
  const dispose = autorun(() => {
    getSnapshot(session)
    snapshots++
  })
  expect(snapshots).toBe(1)

  for (let i = 0; i < 10; i++) {
    expect(session.panels.length).toBe(2)
    expect(session.tree).toBeDefined()
  }
  expect(snapshots).toBe(1)
  dispose()
})

test('sizes survive a snapshot round trip at depth', () => {
  const session = createSession()
  const p1 = session.panels[0]!.id
  const p2 = session.splitPanel(p1, 'row')!.id
  session.splitPanel(p2, 'column')

  const branch = session.layout as unknown as { id: string }
  session.setSizes(branch.id, [0.7, 0.3])

  const snapshot = getSnapshot(session)
  const restored = TestSession.create(snapshot)
  const restoredBranch = restored.layout as unknown as {
    children: { size: number }[]
  }
  expect(restoredBranch.children.map(c => Number(c.size.toFixed(2)))).toEqual([
    0.7, 0.3,
  ])
  expect(restored.panels.length).toBe(3)
})

test('homing is one-directional: unassigned views land, departed views leave', () => {
  const session = createSession()
  const right = session.splitPanel(session.panels[0]!.id, 'row')!

  session.homeUnassignedViews(['view-1', 'view-2'])
  expect(session.panelContainingView('view-2')?.id).toBe(right.id)

  session.homeUnassignedViews(['view-1'])
  expect(session.panelContainingView('view-2')).toBeUndefined()
  expect(session.panelContainingView('view-1')).toBeDefined()
})

test('closing a panel drops its tabs from the layout', () => {
  const session = createSession()
  const right = session.splitPanel(session.panels[0]!.id, 'row')!
  session.addViewToTab(right.tabs[0]!.id, 'view-2')

  session.closePanel(right.id)

  expect(session.panels.length).toBe(1)
  expect(session.panelContainingView('view-2')).toBeUndefined()
  expect(session.activePanelId).toBe(session.panels[0]!.id)
})

test('a renamed tab keeps its title; an unnamed one has none to keep', () => {
  const session = createSession()
  const tabId = session.tabs[0]!.id
  expect(session.findTab(tabId)?.tab.title).toBeUndefined()

  session.renameTab(tabId, 'My comparison')
  expect(session.findTab(tabId)?.tab.title).toBe('My comparison')

  session.renameTab(tabId, undefined)
  expect(session.findTab(tabId)?.tab.title).toBeUndefined()
})

// The scenario that needed three separate mechanisms in the dockview seam.
// A user closes a panel; another model reacts to the resulting state change by
// rearranging the workspace. There, that was a reaction re-entering dockview
// mid-mutation — `clear()` disposing groups whose events were still being
// dispatched — and making it safe took an origin filter, a last-seen-layout
// comparison, and a deferral onto a microtask.
//
// Here it is two actions. MST finishes one before reactions run, there is no
// half-applied tree to catch, and nothing outside the tree to notify.
test('a reaction rearranging the workspace during a close is just two actions', () => {
  const session = createSession()
  const right = session.splitPanel(session.panels[0]!.id, 'row')!
  session.addViewToTab(right.tabs[0]!.id, 'view-2')
  session.addViewToTab(right.tabs[0]!.id, 'view-3')

  const allViews = ['view-1', 'view-2', 'view-3']
  let rearrangements = 0
  const dispose = autorun(() => {
    const homeless = allViews.filter(id => !session.panelContainingView(id))
    if (homeless.length > 0) {
      rearrangements++
      session.homeUnassignedViews(allViews)
    }
  })

  session.closePanel(right.id)

  expect(rearrangements).toBe(1)
  for (const id of allViews) {
    expect(session.panelContainingView(id)).toBeDefined()
  }
  expect(session.panels.length).toBe(1)
  dispose()
})

// The four whole-workspace commands the dockview header owned. They went with
// that component in ea9cb165af and were not reimplemented, so these pin that
// each shape reaches the tree rather than only the spec.
test('tiling horizontally gives every view a cell of one row', () => {
  const session = createSession()
  session.addViewToTab(session.tabs[0]!.id, 'view-2')
  session.addViewToTab(session.tabs[0]!.id, 'view-3')

  session.tileViews('horizontal', ['view-1', 'view-2', 'view-3'])

  expect(session.panels).toHaveLength(3)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([
    ['view-1'],
    ['view-2'],
    ['view-3'],
  ])
})

test('tiling into tabs collapses the grid back to one cell', () => {
  const session = createSession()
  const right = session.splitPanel(session.panels[0]!.id, 'row')!
  session.addViewToTab(right.tabs[0]!.id, 'view-2')

  session.tileViews('tabs', ['view-1', 'view-2'])

  expect(session.panels).toHaveLength(1)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([
    ['view-1'],
    ['view-2'],
  ])
})

// `setPendingMove` is the plugin-facing spelling of the two View menu moves
// (jbrowse-plugin-protein3d, putting a protein view beside its genome view), and
// a plugin asking for one is asking for its view to be ON SCREEN.
//
// It goes through a spec, and a spec states an arrangement rather than a
// selection — `treeFromSpec` shows each cell's first tab. `newTab` puts the
// moved view in a tab beside all the others, so it was landing as the one tab
// nobody could see: the plugin's view was in the workspace and invisible, and
// the menu's `moveViewToNewTab` had always ended with it showing.
describe('setPendingMove', () => {
  const shownIn = (session: ReturnType<typeof createSession>, i: number) =>
    session.activeTabOf(session.panels[i]!.id)?.viewIds

  test('a new tab is the tab that shows', () => {
    const session = createSession()
    session.addViewToTab(session.tabs[0]!.id, 'view-2')

    session.setPendingMove({ type: 'newTab', viewId: 'view-2' }, [
      'view-1',
      'view-2',
    ])

    expect(session.panels).toHaveLength(1)
    expect(session.tabs.map(t => [...t.viewIds])).toEqual([
      ['view-1'],
      ['view-2'],
    ])
    expect(shownIn(session, 0)).toEqual(['view-2'])
  })

  test('a split right shows the view, and makes its cell the active one', () => {
    const session = createSession()
    session.addViewToTab(session.tabs[0]!.id, 'view-2')

    session.setPendingMove({ type: 'splitRight', viewId: 'view-2' }, [
      'view-1',
      'view-2',
    ])

    expect(session.panels).toHaveLength(2)
    expect(shownIn(session, 1)).toEqual(['view-2'])
    expect(session.activePanelId).toBe(session.panels[1]!.id)
  })

  test('with nothing to move relative to, the view takes the space', () => {
    const session = createSession()

    session.setPendingMove({ type: 'splitRight', viewId: 'view-1' }, ['view-1'])

    expect(session.panels).toHaveLength(1)
    expect(shownIn(session, 0)).toEqual(['view-1'])
  })
})

test('a tiling leaves every view somewhere, and homing after it is a no-op', () => {
  const session = createSession()
  const ids = ['view-1', 'view-2', 'view-3', 'view-4', 'view-5']
  for (const id of ids.slice(1)) {
    session.addViewToTab(session.tabs[0]!.id, id)
  }

  session.tileViews('grid', ids)
  const tiled = getSnapshot(session.layout)
  // homing exists to place views no tab holds; a tiling has just placed them
  // all, so it must have nothing left to do — otherwise the arrangement would
  // be undone by the autorun that runs on every views change
  session.homeUnassignedViews(ids)

  expect(getSnapshot(session.layout)).toEqual(tiled)
  for (const id of ids) {
    expect(session.tabContainingView(id)).toBeDefined()
  }
})

// `setPendingMove` and `tileViews` are sugar over `applyLayoutSpec`, and they
// have to reach it through `self` rather than sideways with `this`. The fork's
// `instantiateActions` does `fn.bind(actions)`, so a `this.` hop resolves
// against the literal its own block returned and is pinned to that block's
// implementation for good — a later block, or a plugin's `extendStateModel`,
// replaces the action on the instance and the hop goes on calling the one it
// replaced, with no error and no type complaint.
//
// Overriding is the only way to see the difference: both spellings behave
// identically until something replaces the callee.
test('the sugars call the applyLayoutSpec the session actually has', () => {
  const calls: string[] = []
  const Overridden = types
    .compose(
      'Overridden',
      types.model({ name: types.string }),
      WorkspaceLayoutMixin(),
    )
    .actions(self => {
      const base = self.applyLayoutSpec
      return {
        applyLayoutSpec(spec: Parameters<typeof base>[0]) {
          calls.push('override')
          return base(spec)
        },
      }
    })

  const session = Overridden.create({ name: 'test' })
  session.addViewToTab(session.tabs[0]!.id, 'view-1')

  session.tileViews('grid', ['view-1'])
  session.setPendingMove({ type: 'splitRight', viewId: 'view-1' }, ['view-1'])

  expect(calls).toEqual(['override', 'override'])
})

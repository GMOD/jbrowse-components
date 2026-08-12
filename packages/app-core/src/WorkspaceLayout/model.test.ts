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
  session.addViewToPanel(session.panels[0]!.id, 'view-1')
  return session
}

test('a split is one action and the tree is immediately consistent', () => {
  const session = createSession()
  const left = session.panels[0]!.id
  const right = session.splitPanel(left, 'row')

  expect(session.panels.map(p => p.id)).toEqual([left, right])
  expect(session.activePanelId).toBe(right)
  expect(session.panelContainingView('view-1')?.id).toBe(left)
})

// The point of the exercise. Undo is applySnapshot on the session and nothing
// else has to be notified, because nothing else holds layout state. In the
// dockview seam this needed an autorun that re-applied the blob, and that
// autorun is what had to be stopped from running mid-mutation.
test('undo is applySnapshot, with nothing to notify', () => {
  const session = createSession()
  const before = getSnapshot(session)

  const right = session.splitPanel(session.panels[0]!.id, 'row')
  session.addViewToPanel(right, 'view-2')
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

  // reading the layout as much as anything could want to
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
  const p2 = session.splitPanel(p1, 'row')
  session.splitPanel(p2, 'column')

  const branch = session.layout as unknown as {
    id: string
    children: { size: number }[]
  }
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
  const right = session.splitPanel(session.panels[0]!.id, 'row')

  session.homeUnassignedViews(['view-1', 'view-2'])
  expect(session.panelContainingView('view-2')?.id).toBe(right)

  session.homeUnassignedViews(['view-1'])
  expect(session.panelContainingView('view-2')).toBeUndefined()
  expect(session.panelContainingView('view-1')).toBeDefined()
})

test('closing a panel with views drops them from the layout only', () => {
  const session = createSession()
  const right = session.splitPanel(session.panels[0]!.id, 'row')
  session.addViewToPanel(right, 'view-2')

  session.closePanel(right)

  expect(session.panels.length).toBe(1)
  expect(session.panelContainingView('view-2')).toBeUndefined()
  expect(session.activePanelId).toBe(session.panels[0]!.id)
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
  const right = session.splitPanel(session.panels[0]!.id, 'row')
  session.addViewToPanel(right, 'view-2')
  session.addViewToPanel(right, 'view-3')

  const allViews = ['view-1', 'view-2', 'view-3']
  let rearrangements = 0
  const dispose = autorun(() => {
    const homeless = allViews.filter(id => !session.panelContainingView(id))
    if (homeless.length > 0) {
      rearrangements++
      session.homeUnassignedViews(allViews)
    }
  })

  session.closePanel(right)

  expect(rearrangements).toBe(1)
  for (const id of allViews) {
    expect(session.panelContainingView(id)).toBeDefined()
  }
  expect(session.panels.length).toBe(1)
  dispose()
})

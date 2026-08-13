import { getSnapshot, onSnapshot, types } from '@jbrowse/mobx-state-tree'

import { WorkspaceLayoutMixin } from './model.ts'

const TestSession = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  WorkspaceLayoutMixin(),
)

// 1. Ids must survive a reload. This is the test that has to fake a fresh
// process, because the bug only exists across one: a module-level counter
// restarts at zero on every page load while the restored snapshot still holds
// `panel-1`, `tab-1`, ..., so the first tab a returning user opens mints an id
// the tree already has — and these are `types.identifier`.
//
// Doing it in-process proves nothing: the counter keeps advancing, so the ids
// never collide and the test passes against the broken code. jest.resetModules
// plus a re-import is what actually restarts it.
test('ids minted after a reload do not collide with restored ones', async () => {
  jest.resetModules()
  const first = await freshSession()
  first.splitPanel(first.panels[0]!.id, 'row')
  first.addTab(first.panels[0]!.id)
  const snapshot = getSnapshot(first)
  const restoredIds = new Set([
    ...first.panels.map(p => p.id),
    ...first.tabs.map(t => t.id),
  ])

  // a genuinely fresh module graph, as a page load gives
  jest.resetModules()
  const restored = await freshSession(snapshot)
  const added = restored.addTab(restored.panels[0]!.id)!
  const split = restored.splitPanel(restored.panels[0]!.id, 'column')!

  expect(restoredIds.has(added.id)).toBe(false)
  expect(restoredIds.has(split.id)).toBe(false)

  const ids = [
    ...restored.panels.map(p => p.id),
    ...restored.tabs.map(t => t.id),
  ]
  expect(new Set(ids).size).toBe(ids.length)
})

async function freshSession(snapshot?: Record<string, unknown>) {
  const { WorkspaceLayoutMixin: Mixin } = await import('./model.ts')
  const { types: t } = await import('@jbrowse/mobx-state-tree')
  const Model = t.compose('TestSession', t.model({ name: t.string }), Mixin())
  return Model.create((snapshot ?? { name: 't' }) as never)
}

// 2. Homing runs on every change to session.views. If it writes even when it
// changes nothing, every unrelated view edit lands a fresh layout snapshot in
// the undo history — which is the exact bug class the rewrite removed on the
// dockview side (the layout echo truncating the redo stack).
test('homing writes nothing when there is nothing to home', () => {
  const session = TestSession.create({ name: 't' })
  session.addViewToTab(session.tabs[0]!.id, 'view-1')

  session.homeUnassignedViews(['view-1'])

  let snapshots = 0
  const dispose = onSnapshot(session, () => {
    snapshots++
  })
  for (let i = 0; i < 5; i++) {
    session.homeUnassignedViews(['view-1'])
  }
  dispose()
  expect(snapshots).toBe(0)
})

// 2b. The same claim, but about the LAYOUT rather than about membership — and
// the case where it was false. `normalize` runs on every action, so if it has
// no fixed point then every action rewrites every size and the undo history
// fills with entries in which nothing observable changed. Seven equal panes is
// the first shape a user reaches by accident: "Global: tile horizontally" with
// seven views.
test('a tiled workspace stops emitting snapshots once it is settled', () => {
  const session = TestSession.create({ name: 't' })
  const views = Array.from({ length: 7 }, (_, i) => `view-${i}`)
  session.tileViews('horizontal', views)
  session.homeUnassignedViews(views)

  let snapshots = 0
  const dispose = onSnapshot(session, () => {
    snapshots++
  })
  for (let i = 0; i < 5; i++) {
    session.homeUnassignedViews(views)
  }
  dispose()
  expect(snapshots).toBe(0)
})

// 3. activeTabId must always name a tab that panel actually has, through every
// operation that can retire one.
test('activeTabId never dangles', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const a = session.tabs[0]!.id
  const b = session.addTab(p1)!.id
  const p2 = session.splitPanel(p1, 'row')!

  const check = () => {
    for (const panel of session.panels) {
      if (panel.activeTabId !== undefined) {
        expect(panel.tabs.map(t => t.id)).toContain(panel.activeTabId)
      }
    }
  }
  check()
  session.dropTabInPanel(b, p2.id)
  check()
  session.closeTab(a)
  check()
  session.dropTabInNewSplit(b, session.panels[0]!.id, 'column', false)
  check()
  session.closePanel(session.panels[0]!.id)
  check()
})

// 4. A panel created by an edge-drop must never be left empty, including when
// the dragged tab does not exist.
test('an edge drop of a tab that is not there leaves no empty cell behind', () => {
  const session = TestSession.create({ name: 't' })
  session.addViewToTab(session.tabs[0]!.id, 'view-1')
  const before = session.panels.length

  session.dropTabInNewSplit(
    'tab-does-not-exist',
    session.panels[0]!.id,
    'row',
    false,
  )

  expect(session.panels.length).toBe(before)
  expect(session.panels.every(p => p.tabs.length > 0)).toBe(true)
})

// 5. A move whose TARGET does not exist must be a no-op, not a deletion.
// moveTabToPanel removes the tab and then inserts it, so a target that cannot be
// found leaves the tab — and every view in it — nowhere at all.
test('a move to a panel that is not there loses nothing', () => {
  const session = TestSession.create({ name: 't' })
  session.addViewToTab(session.tabs[0]!.id, 'view-1')
  const tabId = session.tabs[0]!.id

  session.dropTabInPanel(tabId, 'panel-does-not-exist')

  expect(session.findTab(tabId)).toBeDefined()
  expect(session.tabContainingView('view-1')).toBeDefined()
  expect(session.tabs.flatMap(t => t.viewIds)).toEqual(['view-1'])
})

// 6. activePanelId must always name a panel that exists, or be undefined.
// Homing falls back on it, so a dangling one puts views in a cell nobody draws.
test('activePanelId never dangles', () => {
  const session = TestSession.create({ name: 't' })
  const check = () => {
    if (session.activePanelId !== undefined) {
      expect(session.panels.map(p => p.id)).toContain(session.activePanelId)
    }
  }
  const p1 = session.panels[0]!.id
  const p2 = session.splitPanel(p1, 'row')!
  check()
  session.addTab('panel-does-not-exist')
  check()
  // closing a tab can now take its cell with it, so it is a way of retiring the
  // panel `activePanelId` names as well
  session.setActivePanelId(p2.id)
  session.closeTab(session.activeTabOf(p2.id)!.id)
  check()
  session.closePanel(session.panels[0]!.id)
  check()
})

// 3b. Including the one path that empties a panel without removing it: closing
// the LAST panel has nowhere to collapse to, so `removePanel` hands back that
// same panel with no tabs — and `activeTabId` named one of the tabs it just
// dropped. A panel showing a tab it does not have renders no content and no
// launcher, so the cell goes blank.
test('closing the only panel takes activeTabId with the tabs', () => {
  const session = TestSession.create({ name: 't' })
  const only = session.panels[0]!.id
  expect(session.activeTabOf(only)).toBeDefined()

  session.closePanel(only)

  expect(session.panels).toHaveLength(1)
  expect(session.panels[0]!.tabs).toEqual([])
  expect(session.panels[0]!.activeTabId).toBeUndefined()
})

// 4b. The mirror of 4, on the TARGET rather than the dragged tab. An edge drop
// onto a panel that is not there splits nothing, so claiming the new cell's id
// would leave activePanelId naming one nobody draws — the same reason
// `splitPanel` checks its own result before claiming it.
test('an edge drop onto a panel that is not there claims no cell', () => {
  const session = TestSession.create({ name: 't' })
  const tabId = session.tabs[0]!.id
  const before = session.activePanelId

  const landed = session.dropTabInNewSplit(
    tabId,
    'panel-does-not-exist',
    'row',
    false,
  )

  expect(landed).toBeUndefined()
  expect(session.panels).toHaveLength(1)
  expect(session.activePanelId).toBe(before)
})

// 8. Moving one view out must disturb nothing else.
//
// `moveViewToNewTab`/`moveViewToSplitRight` home the session's views on the way
// through, and homing is two-directional about membership: it DROPS any view
// its list does not name. So `allViewIds` has to be every view in the session,
// and it used to default to `[viewId]` — which unhomed every other view in the
// workspace and let the homing autorun sweep them all into one tab. It is a
// required parameter now, so the signature is what stops that; this pins the
// behaviour the signature is protecting.
test('moving one view out leaves the others where they were', () => {
  const session = TestSession.create({ name: 't' })
  const first = session.panels[0]!.id
  const second = session.splitPanel(first, 'row')!
  session.addViewToTab(session.activeTabOf(first)!.id, 'view-1')
  session.addViewToTab(session.activeTabOf(second.id)!.id, 'view-2')

  session.moveViewToNewTab('view-1', ['view-1', 'view-2'])

  expect(session.panelContainingView('view-2')?.id).toBe(second.id)
  expect(session.tabContainingView('view-1')).toBeDefined()
})

// 7. The homing autorun must not drive itself. It writes to the layout, so if it
// also read the layout it would loop — and a loop here is a hung tab, not a
// wrong pixel.
test('homing does not retrigger itself', async () => {
  const { autorun } = await import('mobx')
  const session = TestSession.create({ name: 't' })
  const views = ['view-1', 'view-2']

  let runs = 0
  const dispose = autorun(() => {
    runs++
    session.homeUnassignedViews(views)
  })

  expect(runs).toBe(1)
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(runs).toBe(1)
  dispose()
})

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
  session.closePanel(p2.id)
  check()
  session.closePanel(session.panels[0]!.id)
  check()
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

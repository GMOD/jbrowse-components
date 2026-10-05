import { getSnapshot, onSnapshot, types } from '@jbrowse/mobx-state-tree'

import { WorkspaceLayoutMixin } from './model.ts'

const TestSession = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  WorkspaceLayoutMixin(),
)

// jest.resetModules plus a re-import fakes the page load; in-process a counter
// would keep advancing and pass
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

// homing runs on every change to session.views, so a no-op write would fill undo
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

// seven equal panes have no floating-point fixed point without SIZE_EPSILON
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

// moveTabToPanel removes before it inserts, so a missing target risks deletion
test('a move to a panel that is not there loses nothing', () => {
  const session = TestSession.create({ name: 't' })
  session.addViewToTab(session.tabs[0]!.id, 'view-1')
  const tabId = session.tabs[0]!.id

  session.dropTabInPanel(tabId, 'panel-does-not-exist')

  expect(session.findTab(tabId)).toBeDefined()
  expect(session.tabContainingView('view-1')).toBeDefined()
  expect(session.tabs.flatMap(t => t.viewIds)).toEqual(['view-1'])
})

// homing falls back on activePanelId, so a dangling one hides views
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
  // closing a cell's last tab closes the cell
  session.setActivePanelId(p2.id)
  session.closeTab(session.activeTabOf(p2.id)!.id)
  check()
  session.closePanel(session.panels[0]!.id)
  check()
})

// the last panel empties rather than going, so its activeTabId must go instead
test('closing the only panel takes activeTabId with the tabs', () => {
  const session = TestSession.create({ name: 't' })
  const only = session.panels[0]!.id
  expect(session.activeTabOf(only)).toBeDefined()

  session.closePanel(only)

  expect(session.panels).toHaveLength(1)
  expect(session.panels[0]!.tabs).toEqual([])
  expect(session.panels[0]!.activeTabId).toBeUndefined()
})

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

// homing drops any view its list omits, so `allViewIds` must be every view
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

// homing writes the layout, so reading it too would loop
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

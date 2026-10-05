import { applySnapshot, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { WorkspaceLayoutMixin } from './model.ts'

import type { LayoutSpecNode } from './spec.ts'
import type { PanelNode } from './tree.ts'

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

// a snapshot from a settled layout would truncate the redo stack
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

// MST finishes one action before reactions run, so the reaction sees no
// half-applied tree
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

// each tiling shape must reach the tree, not only the spec
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

// a plugin calling `setPendingMove` (protein3d) wants its view on screen, not
// in a background tab
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

  test('keeps the arrangement it moves the view out of', () => {
    const session = createViewsSession()
    session.moveViewToSplit('v2', 'row')
    const right = session.panels[1]!.id
    const renamed = session.tabs[1]!.id
    session.renameTab(renamed, 'mine')
    session.setSizes(session.tree.id, [0.7, 0.3])

    session.setPendingMove({ type: 'newTab', viewId: 'v3' })

    expect(session.panels.map(p => p.id)).toContain(right)
    expect(session.findTab(renamed)?.tab.title).toBe('mine')
    expect(session.panels.map(p => p.size)).toEqual([0.7, 0.3])
    expect(session.tabs.map(t => [...t.viewIds])).toEqual([
      ['v1'],
      ['v3'],
      ['v2'],
    ])
    expect(session.activeTabOf(session.panels[0]!.id)?.viewIds).toEqual(['v3'])
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
  // otherwise the homing autorun would undo the arrangement
  session.homeUnassignedViews(ids)

  expect(getSnapshot(session.layout)).toEqual(tiled)
  for (const id of ids) {
    expect(session.tabContainingView(id)).toBeDefined()
  }
})

// a `this.` hop binds to the block's own literal and would skip an override;
// only overriding shows the difference
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

  expect(calls).toEqual(['override'])
})

describe('maximize', () => {
  function twoCells() {
    const session = createSession()
    const left = session.panels[0]!.id
    const right = session.splitPanel(left, 'row')!.id
    return { session, left, right }
  }

  test('a toggle maximizes, and toggling the same cell restores', () => {
    const { session, left } = twoCells()

    session.toggleMaximizedPanel(left)
    expect(session.maximizedPanelId).toBe(left)
    expect(session.activePanelId).toBe(left)

    session.toggleMaximizedPanel(left)
    expect(session.maximizedPanelId).toBeUndefined()
  })

  test('maximizing another cell moves the mode', () => {
    const { session, left, right } = twoCells()
    session.toggleMaximizedPanel(left)

    session.toggleMaximizedPanel(right)

    expect(session.maximizedPanelId).toBe(right)
  })

  test('a cell that is not there cannot be maximized', () => {
    const { session } = twoCells()
    session.toggleMaximizedPanel('panel-does-not-exist')
    expect(session.maximizedPanelId).toBeUndefined()
  })

  test('the visible tree is the maximized cell alone, at full size', () => {
    const { session, right } = twoCells()
    session.setSizes(
      (session.layout as unknown as { id: string }).id,
      [0.7, 0.3],
    )

    session.toggleMaximizedPanel(right)

    const visible = session.visibleTree as PanelNode
    expect(visible.id).toBe(right)
    expect(visible.size).toBe(1)
    expect('children' in visible).toBe(false)
  })

  test('with nothing maximized the visible tree is the whole tree', () => {
    const { session } = twoCells()
    expect(session.visibleTree).toEqual(session.tree)
  })

  test('closing the maximized cell restores rather than moving the mode', () => {
    const { session, left, right } = twoCells()
    session.toggleMaximizedPanel(right)

    session.closePanel(right)

    expect(session.maximizedPanelId).toBeUndefined()
    expect(session.activePanelId).toBe(left)
  })

  test('closing the last tab of the maximized cell restores', () => {
    const { session, right } = twoCells()
    session.toggleMaximizedPanel(right)

    session.closeTab(session.activeTabOf(right)!.id)

    expect(session.panels).toHaveLength(1)
    expect(session.maximizedPanelId).toBeUndefined()
  })

  test.each([
    [
      'a split of the maximized cell',
      (s: ReturnType<typeof createSession>, id: string) => {
        s.splitPanel(id, 'row')
      },
    ],
    [
      'an edge drop that makes a new cell',
      (s: ReturnType<typeof createSession>, id: string) => {
        s.dropTabInNewSplit(s.activeTabOf(id)!.id, id, 'column', false)
      },
    ],
    [
      'moving a view out to a split',
      (s: ReturnType<typeof createSession>) => {
        s.moveViewToSplit('view-1', 'row', ['view-1'])
      },
    ],
    [
      'a whole-workspace tiling',
      (s: ReturnType<typeof createSession>) => {
        s.tileViews('horizontal', ['view-1'])
      },
    ],
  ])('%s leaves the mode', (_name, act) => {
    const { session, left } = twoCells()
    session.toggleMaximizedPanel(left)

    act(session, left)

    expect(session.maximizedPanelId).toBeUndefined()
  })

  test('working inside the maximized cell keeps it maximized', () => {
    const { session, left } = twoCells()
    session.toggleMaximizedPanel(left)

    const tab = session.addTab(left)!
    session.renameTab(tab.id, 'named')
    session.setActiveTab(left, tab.id)
    session.addViewToTab(tab.id, 'view-9')

    expect(session.maximizedPanelId).toBe(left)
  })

  test('the mode is in the snapshot, and undo steps through it', () => {
    const { session, left } = twoCells()
    const before = getSnapshot(session)

    session.toggleMaximizedPanel(left)
    expect(getSnapshot(session)).not.toEqual(before)

    applySnapshot(session, before)
    expect(session.maximizedPanelId).toBeUndefined()
  })
})

const ViewsSession = types.compose(
  'ViewsSession',
  types.model({
    views: types.array(types.model({ id: types.identifier })),
  }),
  WorkspaceLayoutMixin(),
)

function createViewsSession() {
  const session = ViewsSession.create({
    views: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }],
  })
  session.homeUnassignedViews(['v1', 'v2', 'v3'])
  return session
}

describe('a session saved before the workspace was always on', () => {
  const split = {
    id: 'branch-1',
    size: 1,
    direction: 'row',
    children: [
      { id: 'panel-1', size: 0.5, tabs: [{ id: 'tab-1', viewIds: ['v1'] }] },
      { id: 'panel-2', size: 0.5, tabs: [{ id: 'tab-2', viewIds: ['v2'] }] },
    ],
  }
  const views = [{ id: 'v1' }, { id: 'v2' }]

  test('with workspaces off opens as the stack it showed', () => {
    const session = ViewsSession.create({
      views,
      layout: split,
      activePanelId: 'panel-2',
      useWorkspaces: false,
    } as never)
    session.homeUnassignedViews(['v1', 'v2'])

    expect(session.panels).toHaveLength(1)
    expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v2']])
  })

  test('with workspaces on keeps its arrangement', () => {
    const session = ViewsSession.create({
      views,
      layout: split,
      useWorkspaces: true,
    } as never)

    expect(session.panels.map(p => p.id)).toEqual(['panel-1', 'panel-2'])
  })
})

test('applyLayoutSpec counts a leaf index into session.views, beside ids', () => {
  const session = createViewsSession()

  const stated = session.applyLayoutSpec({
    direction: 'horizontal',
    children: [{ views: [2, 'v1'] }, { views: [1] }],
  })

  expect(stated).toEqual(['v3', 'v1', 'v2'])
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v3', 'v1'], ['v2']])
})

describe('layoutViews', () => {
  const order: string[] = []
  const HostSession = ViewsSession.actions(() => ({
    orderViews(ids: string[]) {
      order.push(`order:${ids.join(',')}`)
    },
  }))

  beforeEach(() => {
    order.length = 0
  })

  test('applies the spec and orders the views', () => {
    const session = HostSession.create({
      views: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }],
    })
    session.homeUnassignedViews(['v1', 'v2', 'v3'])
    const seated = session.layoutViews({
      direction: 'horizontal',
      children: [{ views: ['v2'] }, { views: [0, 'v3'] }],
    })
    expect(seated).toEqual(['v2', 'v1', 'v3'])
    expect(order).toEqual(['order:v2,v1,v3'])
    expect(session.tabs.map(t => [...t.viewIds])).toEqual([
      ['v2'],
      ['v1', 'v3'],
    ])
  })

  test.each([
    ['seating no view', { children: [] }, /seats no views/],
    ['naming no view the session has', { views: ['nope'] }, /view id "nope"/],
  ])('a layout %s throws before changing anything', (_, spec, message) => {
    const session = HostSession.create({ views: [{ id: 'v1' }] })
    session.homeUnassignedViews(['v1'])
    const before = getSnapshot(session.layout)
    expect(() => session.layoutViews(spec)).toThrow(message)
    expect(order).toEqual([])
    expect(getSnapshot(session.layout)).toEqual(before)
  })

  test('a host with no view list says so', () => {
    const session = createViewsSession()
    expect(() => session.layoutViews({ views: ['v1'] })).toThrow(
      /composed with MultipleViewsSessionMixin/,
    )
  })
})

// shapes an untyped caller (MCP run_javascript) can send, hence the cast
test.each([
  [
    'a leaf spelled viewIds',
    { viewIds: ['v1'] },
    /unrecognized key\(s\) "viewIds"/,
  ],
  [
    'one view seated in two cells',
    { direction: 'horizontal', children: [{ views: ['v1'] }, { views: [0] }] },
    /seats view "v1" in more than one cell/,
  ],
  [
    'an index past the end',
    { views: [3] },
    /view index 3, but the session has 3 view\(s\) \(indexes 0-2\)/,
  ],
  [
    'an id no view has',
    { views: ['nope'] },
    /view id "nope".*ids: "v1", "v2", "v3"/,
  ],
  ['a non-array views', { views: 'v1' }, /"views" is an array.*received "v1"/],
])(
  'applyLayoutSpec refuses %s, naming what it received, and leaves the tree alone',
  (_, spec, message) => {
    const session = createViewsSession()
    const before = getSnapshot(session.layout)

    expect(() =>
      session.applyLayoutSpec(spec as unknown as LayoutSpecNode),
    ).toThrow(message)
    expect(getSnapshot(session.layout)).toEqual(before)
  },
)

// the same empty panel `treeFromSpec` builds on the session-spec path
test('a node stating neither views nor children is the empty panel', () => {
  const session = createViewsSession()

  expect(() => session.applyLayoutSpec({})).not.toThrow()
  expect(session.panels).toHaveLength(1)
  expect(session.tabs).toEqual([])
})

test('an empty leaf beside a populated one costs only its own cell', () => {
  const session = createViewsSession()

  session.applyLayoutSpec({
    direction: 'horizontal',
    children: [{ views: [0, 1, 2] }, { size: 30 }],
  })

  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v2', 'v3']])
})

// a plugin's id list can be stale, and a throw here breaks a launch nobody wraps
describe('a stale id in a caller-supplied list', () => {
  test('costs setPendingMove nothing, since it reads the session', () => {
    const session = createViewsSession()

    expect(() => {
      session.setPendingMove({ type: 'splitRight', viewId: 'v3' }, [
        'v1',
        'gone',
        'v3',
      ])
    }).not.toThrow()
    expect(session.tabs.map(t => [...t.viewIds])).toEqual([
      ['v1', 'v2'],
      ['v3'],
    ])
  })

  test('leaves setPendingMove nothing to move when it is the moved view', () => {
    const session = createViewsSession()
    const before = getSnapshot(session.layout)

    expect(() => {
      session.setPendingMove({ type: 'newTab', viewId: 'gone' })
    }).not.toThrow()
    expect(getSnapshot(session.layout)).toEqual(before)
  })

  test('costs tileViews that cell and nothing else', () => {
    const session = createViewsSession()

    expect(() => {
      session.tileViews('vertical', ['v1', 'gone', 'v2', 'v1'])
    }).not.toThrow()
    expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1'], ['v2']])
  })
})

test('an index means nothing on a host with no view list, and says so', () => {
  const session = createSession()

  expect(() => session.applyLayoutSpec({ views: [0] })).toThrow(
    /no view list for an index to count into/,
  )
  expect(session.applyLayoutSpec({ views: ['view-1'] })).toEqual(['view-1'])
})

test('moveViewToSplit without a view list homes the whole session', () => {
  const session = createViewsSession()

  session.moveViewToSplit('v2', 'row')

  expect(session.panels).toHaveLength(2)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v3'], ['v2']])
})

test('splitting out the only view of a cell leaves no blank cell behind', () => {
  const session = createViewsSession()
  session.moveViewToSplit('v2', 'row')

  session.moveViewToSplit('v2', 'row')

  expect(session.panels).toHaveLength(2)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v3'], ['v2']])
})

test('moveViewToSplit column puts the new cell below', () => {
  const session = createViewsSession()

  session.moveViewToSplit('v2', 'column')

  const root = session.tree
  expect('direction' in root && root.direction).toBe('column')
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v3'], ['v2']])
})

describe('moveViewToTab', () => {
  test('into a cell hidden by maximize leaves maximize, so it lands on screen', () => {
    const session = createViewsSession()
    session.moveViewToSplit('v2', 'row')
    const [left, right] = session.panels
    session.toggleMaximizedPanel(left!.id)

    session.moveViewToTab('v3', right!.tabs[0]!.id)
    session.homeUnassignedViews(['v1', 'v2', 'v3', 'v4'])

    expect(session.maximizedPanelId).toBeUndefined()
    expect(session.panelContainingView('v4')?.id).toBe(right!.id)
  })

  test('joins an existing tab in another cell, and shows it', () => {
    const session = createViewsSession()
    session.moveViewToSplit('v2', 'row')
    const target = session.tabs[1]!.id

    session.moveViewToTab('v3', target)

    expect(session.tabs.map(t => [...t.viewIds])).toEqual([
      ['v1'],
      ['v2', 'v3'],
    ])
    expect(session.activePanelId).toBe(session.panels[1]!.id)
    expect(session.activeTabOf(session.panels[1]!.id)?.id).toBe(target)
  })

  test('takes the emptied cell away with it', () => {
    const session = createViewsSession()
    session.moveViewToSplit('v2', 'row')

    session.moveViewToTab('v2', session.tabs[0]!.id)

    expect(session.panels).toHaveLength(1)
    expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v3', 'v2']])
  })

  test('to the tab it is already in, or one that is not there, does nothing', () => {
    const session = createViewsSession()
    const before = getSnapshot(session.layout)

    session.moveViewToTab('v1', session.tabs[0]!.id)
    session.moveViewToTab('v1', 'no-such-tab')

    expect(getSnapshot(session.layout)).toEqual(before)
  })
})

test('moveViewToNewTab with one argument keeps the other views homed', () => {
  const session = createViewsSession()

  session.moveViewToNewTab('v2')

  expect(session.panels).toHaveLength(1)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v3'], ['v2']])
})

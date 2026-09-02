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

// ---------------------------------------------------------------------------
// Maximize. The flag is on the MIXIN, beside activePanelId, and not on
// PanelNode — on the node every operation in `tree.ts` would have to say what
// it does to it, and the randomised sequence would need a new invariant to
// catch any of that going wrong. Beside activePanelId it is the same class of
// thing, so it shares the same repair.
// ---------------------------------------------------------------------------

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

  // The menu item on another cell's strip asks for THAT cell, not for a
  // restore, so the mode moves rather than ending.
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

  // `visibleTree` is what the renderer is handed, and the size matters: CSS
  // hands out free space by grow factor only up to a total of 1, so a cell that
  // was a third of a row would draw a third of the window and leave the rest
  // blank.
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

  // Losing the cell leaves the mode rather than picking an arbitrary cell to
  // hold the user in it — the fallback that differs from activePanelId's, which
  // takes the first cell because a workspace always shows one.
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

  // A cell appearing where it cannot be seen is the one thing maximize must not
  // do, so anything that adds one leaves the mode. Three actions split, and
  // stating it once as the cell COUNT is what keeps the fourth
  // (`applyLayoutSpec`, which arrives at the same place by replacing every id)
  // from being a case of its own.
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
        s.moveViewToSplitRight('view-1', ['view-1'])
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

  // ...but everything reachable INSIDE a maximized cell leaves it alone.
  test('working inside the maximized cell keeps it maximized', () => {
    const { session, left } = twoCells()
    session.toggleMaximizedPanel(left)

    const tab = session.addTab(left)!
    session.renameTab(tab.id, 'named')
    session.setActiveTab(left, tab.id)
    session.addViewToTab(tab.id, 'view-9')

    expect(session.maximizedPanelId).toBe(left)
  })

  // Session state, so a shared link opens maximized and undo steps through it.
  test('the mode is in the snapshot, and undo steps through it', () => {
    const { session, left } = twoCells()
    const before = getSnapshot(session)

    session.toggleMaximizedPanel(left)
    expect(getSnapshot(session)).not.toEqual(before)

    applySnapshot(session, before)
    expect(session.maximizedPanelId).toBeUndefined()
  })
})

// `applyLayoutSpec` takes the shape a session spec's `layout` takes, with a
// leaf's `views` counting into `session.views` — the list this mixin reads
// off its host — or naming ids. One shape, so what an agent wrote into a link
// is what it can call live, and a leaf spelled any other way is refused rather
// than arranging nothing: an untyped caller that wrote `viewIds` used to get
// an empty leaf and a workspace collapsed into one blank tab.
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

test('applyLayoutSpec counts a leaf index into session.views, beside ids', () => {
  const session = createViewsSession()

  const stated = session.applyLayoutSpec({
    direction: 'horizontal',
    children: [{ views: [2, 'v1'] }, { views: [1] }],
  })

  expect(stated).toEqual(['v3', 'v1', 'v2'])
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v3', 'v1'], ['v2']])
})

// The wrong shapes an untyped caller (the MCP run_javascript tool) can hand
// the action, hence the cast: the point is what the runtime says to them.
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

// The empty panel `treeFromSpec` has always built for a node stating nothing
// (`{ direction: 'horizontal', children: [] }` is the same shape, and
// spec.test.ts calls it usable) — and the one the session-spec path kept
// building while this action refused it outright, so the two surfaces
// disagreed about the one shape they share. An unrecognized KEY is the slip
// worth refusing, and it is named above.
test('a node stating neither views nor children is the empty panel', () => {
  const session = createViewsSession()

  expect(() => session.applyLayoutSpec({})).not.toThrow()
  expect(session.panels).toHaveLength(1)
  expect(session.tabs).toEqual([])
})

// A cell with nothing in it is a cell nothing can be dragged out of, so the
// builder drops it rather than leaving a dead zone; the point here is that the
// rest of the layout survives it.
test('an empty leaf beside a populated one costs only its own cell', () => {
  const session = createViewsSession()

  session.applyLayoutSpec({
    direction: 'horizontal',
    children: [{ views: [0, 1, 2] }, { size: 30 }],
  })

  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v2', 'v3']])
})

// `applyLayoutSpec` refuses an id no view has, and these two sugars route a
// CALLER's id list through it — a plugin's snapshot of the session, which can
// name a view it is about to add or one already closed. Throwing out of them
// breaks a launch no plugin wraps, which is the failure `setPendingMove`'s
// optional second argument exists because of.
describe('a stale id in a caller-supplied list', () => {
  test('costs setPendingMove that name and nothing else', () => {
    const session = createViewsSession()

    expect(() => {
      session.setPendingMove({ type: 'splitRight', viewId: 'v3' }, [
        'v1',
        'gone',
        'v3',
      ])
    }).not.toThrow()
    expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1'], ['v3']])
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

// The View menu passes every view id; a caller that has only the session (the
// one-argument call an agent tries first) gets the same list read off it.
test('moveViewToSplitRight with one argument homes the whole session', () => {
  const session = createViewsSession()

  session.moveViewToSplitRight('v2')

  expect(session.panels).toHaveLength(2)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v3'], ['v2']])
})

test('moveViewToNewTab with one argument keeps the other views homed', () => {
  const session = createViewsSession()

  session.moveViewToNewTab('v2')

  expect(session.panels).toHaveLength(1)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([['v1', 'v3'], ['v2']])
})

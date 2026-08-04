import { applyOrderWithin } from '@jbrowse/core/util'
import { cast, types } from '@jbrowse/mobx-state-tree'

import { DockviewLayoutMixin } from '../../DockviewLayout/index.ts'
import {
  applyInitLayout,
  createPanelConfig,
  createPanelId,
  getPanelPosition,
  getViewsForPanel,
  layoutsEqual,
  rearrangePanelsWithDirection,
  reconcilePanelAssignments,
} from './dockviewUtils.ts'

import type { DockviewApi } from 'dockview-react'

// `views` stands in for the session's real view list: reconcile only ever reads
// ids off it, so a bare id model is the whole surface it needs. `orderViews`
// calls the same pure permutation MultipleViewsSessionMixin's does, so this
// double cannot drift from the real action's behaviour.
const TestSessionModel = types
  .compose(
    'TestSession',
    types.model({
      name: types.string,
      views: types.array(types.model({ id: types.identifier })),
    }),
    DockviewLayoutMixin(),
  )
  .actions(self => ({
    orderViews(ids: string[]) {
      self.views = cast(applyOrderWithin(self.views, ids, v => v.id))
    },
  }))

function createSession(viewIds: string[] = []) {
  return TestSessionModel.create({
    name: 'test',
    views: viewIds.map(id => ({ id })),
  })
}

type SessionArg = Parameters<typeof applyInitLayout>[1]

interface FakeGroup {
  api: { setSize: (arg: { width?: number; height?: number }) => void }
}
interface FakePanelConfig {
  id: string
  title?: string
  component?: string
  params?: unknown
  position?: unknown
}

// Minimal stand-in for DockviewApi covering only what these helpers touch.
function createFakeApi({ width = 1000, height = 800 } = {}) {
  const panels = new Map<
    string,
    { id: string; group: FakeGroup; config: FakePanelConfig }
  >()
  const addPanelCalls: FakePanelConfig[] = []
  const setSizeCalls: {
    group: FakeGroup
    arg: { width?: number; height?: number }
  }[] = []

  const api = {
    width,
    height,
    addPanel(config: FakePanelConfig) {
      addPanelCalls.push(config)
      const group: FakeGroup = {
        api: {
          setSize(arg) {
            setSizeCalls.push({ group, arg })
          },
        },
      }
      panels.set(config.id, { id: config.id, group, config })
      return { id: config.id, group }
    },
    getPanel(id: string) {
      return panels.get(id)
    },
    removePanel(p: { id: string }) {
      panels.delete(p.id)
    },
    clear() {
      panels.clear()
    },
    get panels() {
      return [...panels.values()].map(p => ({
        id: p.id,
        title: p.config.title,
        params: p.config.params,
      }))
    },
  }

  return {
    api: api as unknown as DockviewApi,
    addPanelCalls,
    setSizeCalls,
    panels,
  }
}

describe('getPanelPosition', () => {
  const group = {} as never

  it('returns undefined with no group', () => {
    expect(getPanelPosition(undefined)).toBeUndefined()
    expect(getPanelPosition(undefined, 'right')).toBeUndefined()
  })

  it('returns referenceGroup only when no direction', () => {
    expect(getPanelPosition(group)).toEqual({ referenceGroup: group })
  })

  it('includes direction when provided', () => {
    expect(getPanelPosition(group, 'below')).toEqual({
      referenceGroup: group,
      direction: 'below',
    })
  })
})

describe('createPanelId', () => {
  it('produces unique, panel-prefixed ids', () => {
    const a = createPanelId()
    const b = createPanelId()
    expect(a).toMatch(/^panel-/)
    expect(b).toMatch(/^panel-/)
    expect(a).not.toBe(b)
  })
})

describe('applyInitLayout', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0)
      return 0
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('builds a single panel and assigns its views', () => {
    const session = createSession()
    const { api, addPanelCalls } = createFakeApi()

    const firstPanelId = applyInitLayout(
      api,
      session as unknown as SessionArg,
      {
        viewIds: ['v1', 'v2'],
      },
    )

    expect(addPanelCalls).toHaveLength(1)
    expect(firstPanelId).toBeDefined()
    expect(session.getViewIdsForPanel(firstPanelId!)).toEqual(['v1', 'v2'])
  })

  it('builds a nested horizontal layout and distributes width by size', () => {
    const session = createSession()
    const { api, addPanelCalls, setSizeCalls } = createFakeApi({ width: 1000 })

    applyInitLayout(api, session as unknown as SessionArg, {
      direction: 'horizontal',
      children: [
        { viewIds: ['v1'], size: 30 },
        { viewIds: ['v2'], size: 70 },
      ],
    })

    expect(addPanelCalls).toHaveLength(2)
    expect(setSizeCalls.map(c => c.arg)).toEqual([
      { width: 300 },
      { width: 700 },
    ])
  })

  it('distributes height for a vertical layout', () => {
    const session = createSession()
    const { api, setSizeCalls } = createFakeApi({ height: 800 })

    applyInitLayout(api, session as unknown as SessionArg, {
      direction: 'vertical',
      children: [
        { viewIds: ['v1'], size: 1 },
        { viewIds: ['v2'], size: 3 },
      ],
    })

    expect(setSizeCalls.map(c => c.arg)).toEqual([
      { height: 200 },
      { height: 600 },
    ])
  })

  // 'tabs' means "same group, another tab": dockview expresses that as a
  // position with a reference group but no split direction
  it('puts tabs children in one group and distributes no size', () => {
    const session = createSession()
    const { api, addPanelCalls, setSizeCalls } = createFakeApi()

    applyInitLayout(api, session as unknown as SessionArg, {
      direction: 'tabs',
      children: [
        { viewIds: ['v1'], size: 30 },
        { viewIds: ['v2'], size: 70 },
      ],
    })

    expect(addPanelCalls).toHaveLength(2)
    expect(addPanelCalls[0]!.position).toBeUndefined()
    expect(addPanelCalls[1]!.position).toEqual({
      referenceGroup: api.getPanel(addPanelCalls[0]!.id)!.group,
    })
    expect(setSizeCalls).toHaveLength(0)
  })

  it('skips size distribution when a child lacks a size', () => {
    const session = createSession()
    const { api, setSizeCalls } = createFakeApi()

    applyInitLayout(api, session as unknown as SessionArg, {
      direction: 'horizontal',
      children: [{ viewIds: ['v1'], size: 30 }, { viewIds: ['v2'] }],
    })

    expect(setSizeCalls).toHaveLength(0)
  })
})

// The controller's applyInit does clear-assignments -> api.clear() -> build.
// A spec's `layout` lands after the first view does, so for a visitor already
// in workspaces mode this runs over panels that are already up — the old
// assignments have to go, or their views render in two panels at once.
describe('applyInitLayout over an existing workspace', () => {
  it('replaces the panels and assignments already in place', () => {
    const session = createSession(['v1', 'v2'])
    const { api } = createFakeApi()
    api.addPanel(createPanelConfig('panel-stale'))
    session.assignViewToPanel('panel-stale', 'v1')
    session.assignViewToPanel('panel-stale', 'v2')

    for (const panelId of [...session.panelViewAssignments.keys()]) {
      session.removePanel(panelId)
    }
    api.clear()
    applyInitLayout(api, session as unknown as SessionArg, {
      direction: 'horizontal',
      children: [{ viewIds: ['v1'] }, { viewIds: ['v2'] }],
    })

    expect(session.panelViewAssignments.has('panel-stale')).toBe(false)
    expect(api.panels).toHaveLength(2)
    expect(session.getPanelContainingView('v1')?.panelId).not.toBe(
      session.getPanelContainingView('v2')?.panelId,
    )
    // and nothing renders a view twice
    expect(
      [...session.panelViewAssignments.values()]
        .flat()
        .filter(id => id === 'v1').length,
    ).toBe(1)
  })
})

describe('layoutsEqual', () => {
  it('compares by value, since api.toJSON() is a fresh object each call', () => {
    const a = { grid: { root: { type: 'branch' } }, panels: {} }
    expect(layoutsEqual(a as never, structuredClone(a) as never)).toBe(true)
    expect(layoutsEqual(a as never, { grid: {}, panels: {} } as never)).toBe(
      false,
    )
    expect(layoutsEqual(undefined, undefined)).toBe(true)
    expect(layoutsEqual(a as never, undefined)).toBe(false)
  })
})

describe('reconcilePanelAssignments', () => {
  it('homes an unassigned view into the active panel', () => {
    const { api } = createFakeApi()
    api.addPanel(createPanelConfig('panel-1'))
    const session = createSession(['view-1'])
    session.setActivePanelId('panel-1')

    reconcilePanelAssignments(api, session as unknown as SessionArg)

    expect(session.getViewIdsForPanel('panel-1')).toEqual(['view-1'])
  })

  it('drops assignments for views that no longer exist', () => {
    const { api } = createFakeApi()
    api.addPanel(createPanelConfig('panel-1'))
    const session = createSession([])
    session.assignViewToPanel('panel-1', 'gone')

    reconcilePanelAssignments(api, session as unknown as SessionArg)

    expect(session.panelViewAssignments.has('panel-1')).toBe(false)
  })

  // an assignment is what marks a view as homed, so one pointing at a panel
  // dockview doesn't have leaves the view rendered by nothing, forever
  it('re-homes a view assigned to a panel dockview no longer has', () => {
    const { api } = createFakeApi()
    api.addPanel(createPanelConfig('panel-live'))
    const session = createSession(['view-1'])
    session.assignViewToPanel('panel-dead', 'view-1')
    session.setActivePanelId('panel-live')

    reconcilePanelAssignments(api, session as unknown as SessionArg)

    expect(session.panelViewAssignments.has('panel-dead')).toBe(false)
    expect(session.getViewIdsForPanel('panel-live')).toEqual(['view-1'])
  })

  it('creates a panel when dockview has none at all', () => {
    const { api, addPanelCalls } = createFakeApi()
    const session = createSession(['view-1'])

    reconcilePanelAssignments(api, session as unknown as SessionArg)

    expect(addPanelCalls).toHaveLength(1)
    const panelId = addPanelCalls[0]!.id
    expect(session.activePanelId).toBe(panelId)
    expect(session.getViewIdsForPanel(panelId)).toEqual(['view-1'])
  })
})

describe('rearrangePanelsWithDirection', () => {
  it('is a no-op with one panel', () => {
    const { api, addPanelCalls } = createFakeApi()
    api.addPanel({ id: 'panel-1', title: 'a', component: 'default' })
    addPanelCalls.length = 0

    rearrangePanelsWithDirection(api, () => undefined)

    expect(addPanelCalls).toHaveLength(0)
  })

  it('removes and re-adds panels with positions from the callback', () => {
    const { api, addPanelCalls, panels } = createFakeApi()
    api.addPanel({ id: 'panel-1', title: 'a', component: 'default' })
    api.addPanel({ id: 'panel-2', title: 'b', component: 'default' })
    addPanelCalls.length = 0

    rearrangePanelsWithDirection(api, (idx, states) =>
      idx === 0
        ? undefined
        : { referencePanel: states[0]!.id, direction: 'right' },
    )

    expect(addPanelCalls).toHaveLength(2)
    expect(addPanelCalls[0]!.position).toBeUndefined()
    expect(addPanelCalls[1]!.position).toEqual({
      referencePanel: 'panel-1',
      direction: 'right',
    })
    expect(panels.size).toBe(2)
  })
})

// The invariant the two orderings collapsed into: a panel says WHICH views it
// holds, `session.views` says in what order they render. Assign them to the
// panel back to front and the panel still renders them in views order.
describe('one ordering', () => {
  it('getViewsForPanel renders in session.views order, not assignment order', () => {
    const session = createSession(['v1', 'v2', 'v3'])
    session.assignViewToPanel('panel-1', 'v3')
    session.assignViewToPanel('panel-1', 'v1')

    expect(
      getViewsForPanel('panel-1', session as unknown as SessionArg),
    ).toEqual([session.views[0], session.views[2]])
  })

  it('a layout that states an order applies it to session.views', () => {
    const session = createSession(['v1', 'v2'])
    const { api } = createFakeApi()
    applyInitLayout(api, session as unknown as SessionArg, {
      direction: 'horizontal',
      children: [{ viewIds: ['v2'] }, { viewIds: ['v1'] }],
    })

    // the layout reads v2 then v1, so that is the order now; nothing has to
    // consult the assignment arrays to find it out
    expect(session.views.map(v => v.id)).toEqual(['v2', 'v1'])
  })
})

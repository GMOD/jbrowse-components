import { types } from '@jbrowse/mobx-state-tree'

import {
  applyInitLayout,
  cleanLayoutForStorage,
  getPanelPosition,
  rearrangePanelsWithDirection,
} from './dockviewUtils.ts'
import { DockviewLayoutMixin } from '../../DockviewLayout/index.ts'

import type { DockviewApi } from 'dockview-react'

const TestSessionModel = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  DockviewLayoutMixin(),
)

function createSession() {
  return TestSessionModel.create({ name: 'test' })
}

type SessionArg = Parameters<typeof applyInitLayout>[1]

interface FakeGroup {
  api: { setSize: (arg: { width?: number; height?: number }) => void }
}
interface FakePanelConfig {
  id: string
  title?: string
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

describe('cleanLayoutForStorage', () => {
  it('blanks params on every panel but preserves other fields', () => {
    const layout = {
      grid: { root: {}, width: 100, height: 100, orientation: 'HORIZONTAL' },
      activeGroup: 'g1',
      panels: {
        'panel-1': {
          id: 'panel-1',
          params: { panelId: 'panel-1', session: {} },
        },
        'panel-2': {
          id: 'panel-2',
          params: { panelId: 'panel-2', session: {} },
        },
      },
    } as unknown as ReturnType<DockviewApi['toJSON']>

    const cleaned = cleanLayoutForStorage(layout)

    expect(cleaned.panels['panel-1']!.params).toEqual({})
    expect(cleaned.panels['panel-2']!.params).toEqual({})
    expect(cleaned.activeGroup).toBe('g1')
    expect(cleaned.grid).toEqual(layout.grid)
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
    const tracked = new Set<string>()

    const firstPanelId = applyInitLayout(
      api,
      session as unknown as SessionArg,
      { viewIds: ['v1', 'v2'] },
      tracked,
    )

    expect(addPanelCalls).toHaveLength(1)
    expect(firstPanelId).toBeDefined()
    expect(session.getViewIdsForPanel(firstPanelId!)).toEqual(['v1', 'v2'])
    expect([...tracked]).toEqual(['v1', 'v2'])
  })

  it('builds a nested horizontal layout and distributes width by size', () => {
    const session = createSession()
    const { api, addPanelCalls, setSizeCalls } = createFakeApi({ width: 1000 })
    const tracked = new Set<string>()

    applyInitLayout(
      api,
      session as unknown as SessionArg,
      {
        direction: 'horizontal',
        children: [
          { viewIds: ['v1'], size: 30 },
          { viewIds: ['v2'], size: 70 },
        ],
      },
      tracked,
    )

    expect(addPanelCalls).toHaveLength(2)
    expect([...tracked].sort()).toEqual(['v1', 'v2'])
    expect(setSizeCalls.map(c => c.arg)).toEqual([
      { width: 300 },
      { width: 700 },
    ])
  })

  it('distributes height for a vertical layout', () => {
    const session = createSession()
    const { api, setSizeCalls } = createFakeApi({ height: 800 })

    applyInitLayout(
      api,
      session as unknown as SessionArg,
      {
        direction: 'vertical',
        children: [
          { viewIds: ['v1'], size: 1 },
          { viewIds: ['v2'], size: 3 },
        ],
      },
      new Set(),
    )

    expect(setSizeCalls.map(c => c.arg)).toEqual([
      { height: 200 },
      { height: 600 },
    ])
  })

  it('skips size distribution when a child lacks a size', () => {
    const session = createSession()
    const { api, setSizeCalls } = createFakeApi()

    applyInitLayout(
      api,
      session as unknown as SessionArg,
      {
        direction: 'horizontal',
        children: [{ viewIds: ['v1'], size: 30 }, { viewIds: ['v2'] }],
      },
      new Set(),
    )

    expect(setSizeCalls).toHaveLength(0)
  })
})

describe('rearrangePanelsWithDirection', () => {
  it('is a no-op with one panel', () => {
    const { api, addPanelCalls } = createFakeApi()
    api.addPanel({ id: 'panel-1', title: 'a' })
    addPanelCalls.length = 0

    rearrangePanelsWithDirection(api, () => undefined)

    expect(addPanelCalls).toHaveLength(0)
  })

  it('removes and re-adds panels with positions from the callback', () => {
    const { api, addPanelCalls, panels } = createFakeApi()
    api.addPanel({ id: 'panel-1', title: 'a' })
    api.addPanel({ id: 'panel-2', title: 'b' })
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

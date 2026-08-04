import PluginManager from '@jbrowse/core/PluginManager'
import { observable, runInAction } from 'mobx'

import { loadSessionSpec } from './loadSessionSpec.ts'

import type { AbstractRootModel } from '@jbrowse/core/util'

// A fake session/pluginManager: the real ones need a full plugin runtime, but
// the layout mapping only cares about which view id each spec entry created, so
// stub the launch handlers to push view ids and record what setInit receives.
interface StubView {
  id: string
  displayName?: string
  setDisplayName: (arg: string) => void
}
function stubView(id: string): StubView {
  const view: StubView = {
    id,
    setDisplayName: (arg: string) => {
      view.displayName = arg
    },
  }
  return view
}

// A connection reports `loading` from the moment it attaches until its own
// fetch settles, so a spec that registers one has to wait that out before
// launching views over the assemblies and tracks it supplies. Observable
// because the wait is a mobx `when` over exactly that flag.
function connectionStub({
  // jbrowse-web has both adders; Desktop and the embedded products have only
  // addConnectionConf, whose one destination is the right one there
  sessionScoped = true,
  throwOnAdd = false,
} = {}) {
  const connectionInstances = observable.array<{ loading: boolean }>([])
  const made: { conf: Record<string, unknown>; silent?: boolean }[] = []
  const addedVia: string[] = []
  const adder = (via: string) => (conf: Record<string, unknown>) => {
    if (throwOnAdd) {
      throw new Error('invalid connection configuration')
    }
    addedVia.push(via)
    return conf
  }
  return {
    made,
    // which of the two adders the spec reached for — the destination is not
    // the same, so this is the assertion, not an implementation detail
    addedVia,
    settle: () => {
      runInAction(() => {
        for (const conn of connectionInstances) {
          conn.loading = false
        }
      })
    },
    session: {
      connectionInstances,
      addConnectionConf: adder('addConnectionConf'),
      ...(sessionScoped
        ? { addSessionConnectionConf: adder('addSessionConnectionConf') }
        : undefined),
      makeConnection: (
        conf: Record<string, unknown>,
        snap?: { silent?: boolean },
      ) => {
        made.push({ conf, silent: snap?.silent })
        connectionInstances.push(observable({ loading: true }))
      },
    },
  }
}

function setup(
  handlers: Record<
    string,
    (
      session: { views: StubView[] },
      args: Record<string, unknown>,
    ) => Promise<void>
  >,
  // workspaces: false models an embedded product's session, which has neither
  // workspaces action. registeredViewTypes are view types the plugin manager
  // knows about, which is what separates "unknown type" from "type exists but
  // has no launcher"
  {
    workspaces = true,
    registeredViewTypes = [] as string[],
    registeredConnectionTypes = ['UCSCTrackHubConnection'],
    connections,
  }: {
    workspaces?: boolean
    registeredViewTypes?: string[]
    registeredConnectionTypes?: string[]
    // omitted models a session that cannot take connections at all
    connections?: ReturnType<typeof connectionStub>
  } = {},
) {
  const session = {
    views: [] as StubView[],
    notifyError: jest.fn(),
    notify: jest.fn(),
    ...(workspaces
      ? { setUseWorkspaces: jest.fn(), setInit: jest.fn() }
      : undefined),
    ...connections?.session,
  }
  const rootModel = { session, setSession: jest.fn() }
  const pluginManager = {
    rootModel,
    extensionPoints: { has: (name: string) => name in handlers },
    getElementTypeRecord: (group: string) => ({
      has: (type: string) =>
        (group === 'connection'
          ? registeredConnectionTypes
          : registeredViewTypes
        ).includes(type),
    }),
    // mirrors the real PluginManager: an extension point with no registered
    // callback resolves to the extendee unchanged rather than throwing
    evaluateAsyncExtensionPointStrict: (
      name: string,
      args: Record<string, unknown>,
    ) =>
      handlers[name] ? handlers[name](session, args) : Promise.resolve(session),
  } as unknown as PluginManager
  return { session, pluginManager }
}

test('layout indices map to the view each spec entry created, not session position', async () => {
  // The first spec view's handler adds a primary view AND an auxiliary one, so
  // session.views is [a-main, a-aux, b] — reading it positionally would map
  // layout index 1 to a-aux; the per-launch capture maps it to b.
  const { session, pluginManager } = setup({
    'LaunchView-A': async s => {
      s.views.push(stubView('a-main'), stubView('a-aux'))
    },
    'LaunchView-B': async s => {
      s.views.push(stubView('b'))
    },
  })

  await loadSessionSpec(
    {
      views: [
        { type: 'A', assembly: 'volvox' },
        { type: 'B', assembly: 'volvox' },
      ],
      layout: {
        direction: 'horizontal',
        children: [{ views: [0] }, { views: [1] }],
      },
    },
    pluginManager,
  )

  expect(session.setUseWorkspaces).toHaveBeenCalledWith(true)
  expect(session.setInit).toHaveBeenCalledWith({
    direction: 'horizontal',
    children: [
      { viewIds: ['a-main'], size: undefined },
      { viewIds: ['b'], size: undefined },
    ],
    size: undefined,
  })
})

test('launches sequentially so a later view can reference an earlier one', async () => {
  const order: string[] = []
  const { pluginManager } = setup({
    'LaunchView-First': async s => {
      await Promise.resolve()
      order.push('first')
      s.views.push(stubView('first'))
    },
    'LaunchView-Second': async s => {
      order.push('second')
      s.views.push(stubView('second'))
    },
  })

  await loadSessionSpec(
    {
      views: [
        { type: 'First', assembly: 'volvox' },
        { type: 'Second', assembly: 'volvox' },
      ],
    },
    pluginManager,
  )

  // even though First awaits, it finishes before Second starts
  expect(order).toEqual(['first', 'second'])
})

test('a spec view that creates no view leaves an undefined slot the layout skips', async () => {
  const { session, pluginManager } = setup({
    'LaunchView-Real': async s => {
      s.views.push(stubView('real'))
    },
    // a handler that adds nothing (e.g. a launch that no-ops)
    'LaunchView-Empty': async () => {},
  })

  await loadSessionSpec(
    {
      views: [
        { type: 'Empty', assembly: 'volvox' },
        { type: 'Real', assembly: 'volvox' },
      ],
      layout: { views: [0, 1] },
    },
    pluginManager,
  )

  // index 0 created nothing, so only index 1's real view lands in the panel
  expect(session.setInit).toHaveBeenCalledWith({
    viewIds: ['real'],
    size: undefined,
  })
})

test('a launch handler that throws surfaces an error instead of a silent no-op', async () => {
  const { session, pluginManager } = setup({
    'LaunchView-Good': async s => {
      s.views.push(stubView('good'))
    },
    'LaunchView-Bad': async () => {
      throw new Error('No assembly provided')
    },
  })

  // loadSessionSpec also console.errors a launch failure so it's visible in
  // the browser console, not just the snackbar; that's expected here
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await loadSessionSpec(
      {
        views: [
          { type: 'Bad', assembly: 'volvox' },
          { type: 'Good', assembly: 'volvox' },
        ],
      },
      pluginManager,
    )

    // the bad view reports the real error, and the loop still launches the good one
    expect(session.notifyError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to launch Bad view'),
      expect.any(Error),
    )
    expect(session.views.map(v => v.id)).toEqual(['good'])
  } finally {
    error.mockRestore()
  }
})

test('displayName is applied to whatever view type the spec launched', async () => {
  const { session, pluginManager } = setup({
    // a launcher that knows nothing about displayName, like a plugin's own
    'LaunchView-Plugin': async s => {
      s.views.push(stubView('plugin-view'))
    },
  })

  await loadSessionSpec(
    {
      views: [{ type: 'Plugin', assembly: 'volvox', displayName: 'My panel' }],
    },
    pluginManager,
  )

  expect(session.views[0]!.displayName).toBe('My panel')
})

test('a layout index past the end of the spec views is reported', async () => {
  const { session, pluginManager } = setup({
    'LaunchView-A': async s => {
      s.views.push(stubView('a'))
    },
  })

  await loadSessionSpec(
    { views: [{ type: 'A', assembly: 'volvox' }], layout: { views: [0, 2] } },
    pluginManager,
  )

  expect(session.notifyError).toHaveBeenCalledWith(
    expect.stringContaining('layout references view index 2'),
  )
  // the valid index still lands in the panel
  expect(session.setInit).toHaveBeenCalledWith({
    viewIds: ['a'],
    size: undefined,
  })
})

test('a session without workspaces support says so instead of throwing', async () => {
  const { session, pluginManager } = setup(
    {
      'LaunchView-A': async s => {
        s.views.push(stubView('a'))
      },
    },
    { workspaces: false },
  )

  await loadSessionSpec(
    { views: [{ type: 'A', assembly: 'volvox' }], layout: { views: [0] } },
    pluginManager,
  )

  expect(session.notifyError).toHaveBeenCalledWith(
    expect.stringContaining('does not support workspace layouts'),
  )
})

test('a view type the plugin manager never heard of reads as a missing plugin', async () => {
  // a REAL plugin manager here, not the stub: the view-type lookup has two
  // shapes (`TypeRecord.has` returns false for an unregistered name, `get`
  // throws), and only the real class pins which one we depend on.
  // A stub that returns undefined would pass either way.
  const session = { views: [], notifyError: jest.fn() }
  const pluginManager = new PluginManager()
  pluginManager.rootModel = {
    session,
    setSession: jest.fn(),
  } as unknown as AbstractRootModel

  await loadSessionSpec(
    { views: [{ type: 'Nope', assembly: 'volvox' }] },
    pluginManager,
  )

  expect(session.notifyError).toHaveBeenCalledWith(
    expect.stringContaining('Unknown view type(s) in session spec: Nope'),
  )
})

test('a registered view type with no launcher says that instead', async () => {
  const { session, pluginManager } = setup(
    {},
    {
      registeredViewTypes: ['GraphGenomeView'],
    },
  )

  await loadSessionSpec(
    { views: [{ type: 'GraphGenomeView', assembly: 'volvox' }] },
    pluginManager,
  )

  expect(session.notifyError).toHaveBeenCalledWith(
    expect.stringContaining(
      'View type(s) GraphGenomeView cannot be launched from a session spec',
    ),
  )
})

// the config/defaultSession shape, pasted into a spec. Reported here rather than
// unwrapped, so it reads the same for every view type — the LGV would otherwise
// report "No assembly provided", the downstream symptom of a misplaced block
test('a spec view nesting its settings under init is told where they go', async () => {
  const { session, pluginManager } = setup({
    'LaunchView-LinearGenomeView': async s => {
      s.views.push(stubView('lgv'))
    },
  })

  await loadSessionSpec(
    {
      views: [
        // @ts-expect-error a spec view is flat; this is the slip being caught
        { type: 'LinearGenomeView', init: { assembly: 'volvox', loc: 'ctgA' } },
      ],
    },
    pluginManager,
  )

  expect(session.notifyError).toHaveBeenCalledWith(
    expect.stringContaining('nest their settings under "init"'),
  )
})

// `sessionTracks` names the session, but `addTrackConf` follows the user (an
// admin's lands in the config every visitor loads), so the spec has to ask for
// the session-scoped adder where one exists — same rule as sessionConnections
describe('sessionTracks', () => {
  const TRACK = { trackId: 't1', type: 'FeatureTrack' }

  function setupWithTracks({ sessionScoped = true } = {}) {
    const addedVia: string[] = []
    const { session, pluginManager } = setup({})
    Object.assign(session, {
      // isSessionWithAddTracks goes through isSessionModel, which keys on these
      // two rather than on MST node-ness
      rpcManager: {},
      configuration: {},
      addTrackConf: (conf: Record<string, unknown>) => {
        addedVia.push('addTrackConf')
        return conf
      },
      ...(sessionScoped
        ? {
            addSessionTrackConf: (conf: Record<string, unknown>) => {
              addedVia.push('addSessionTrackConf')
              return conf
            },
          }
        : undefined),
    })
    return { pluginManager, addedVia }
  }

  it('adds to the session, not to wherever the user edits land', async () => {
    const { pluginManager, addedVia } = setupWithTracks()

    await loadSessionSpec({ sessionTracks: [TRACK], views: [] }, pluginManager)

    expect(addedVia).toEqual(['addSessionTrackConf'])
  })

  // Desktop and the embedded circular view have no sessionTracks array; their
  // one destination is the config, which is saved with the session there anyway
  it('falls back to addTrackConf where there is no session-scoped adder', async () => {
    const { pluginManager, addedVia } = setupWithTracks({
      sessionScoped: false,
    })

    await loadSessionSpec({ sessionTracks: [TRACK], views: [] }, pluginManager)

    expect(addedVia).toEqual(['addTrackConf'])
  })
})

// A hub (or any connection) brings its own assemblies and tracks, from a fetch.
// Before `sessionConnections` a spec could not carry one at all — a URL was
// either a hub or a spec, never both — so a hub could never be opened with a
// dotplot, a layout, or more than the one view its own defaultPos gives it.
describe('sessionConnections', () => {
  const HUB = {
    type: 'UCSCTrackHubConnection',
    connectionId: 'hub1',
    hubTxtLocation: { uri: 'https://example.com/hub.txt' },
  }

  function setupWithHub(
    log: string[],
    opts: Parameters<typeof connectionStub>[0] & {
      registeredConnectionTypes?: string[]
    } = {},
  ) {
    const { registeredConnectionTypes, ...stubOpts } = opts
    const connections = connectionStub(stubOpts)
    const { session, pluginManager } = setup(
      {
        'LaunchView-LinearGenomeView': async s => {
          log.push('launch')
          s.views.push(stubView('lgv'))
        },
      },
      { connections, registeredConnectionTypes },
    )
    return { session, pluginManager, connections }
  }

  // the whole point of waiting: a view launched mid-fetch resolves neither the
  // assembly the hub is about to define nor the track ids it is about to add
  it('launches views only once the connections have settled', async () => {
    const log: string[] = []
    const { session, pluginManager, connections } = setupWithHub(log)

    const p = loadSessionSpec(
      {
        sessionConnections: [HUB],
        views: [{ type: 'LinearGenomeView', assembly: 'hubGenome' }],
      },
      pluginManager,
    )
    // the handler body runs synchronously up to its own first await, so an
    // unguarded launch would already have logged by now
    log.push('settle')
    connections.settle()
    await p

    expect(log).toEqual(['settle', 'launch'])
    expect(session.views).toHaveLength(1)
  })

  it('silences a connection when the spec launches its own views', async () => {
    const { pluginManager, connections } = setupWithHub([])
    const p = loadSessionSpec(
      {
        sessionConnections: [HUB],
        views: [{ type: 'LinearGenomeView', assembly: 'hubGenome' }],
      },
      pluginManager,
    )
    connections.settle()
    await p

    expect(connections.made).toEqual([{ conf: HUB, silent: true }])
  })

  // no views means the spec is only asking to attach the hub, so the hub's own
  // launch at its defaultPos is the only one there is — silencing it would open
  // nothing at all
  it('leaves a connection unsilenced when the spec has no views', async () => {
    const { pluginManager, connections } = setupWithHub([])

    await loadSessionSpec(
      { sessionConnections: [HUB], views: [] },
      pluginManager,
    )

    expect(connections.made).toEqual([{ conf: HUB, silent: false }])
  })

  it('reports a spec that an application cannot attach connections for', async () => {
    const { session, pluginManager } = setup({})

    await loadSessionSpec(
      { sessionConnections: [HUB], views: [] },
      pluginManager,
    )

    expect(session.notifyError).toHaveBeenCalledWith(
      expect.stringContaining('cannot add connections to a session'),
    )
  })

  // the key is `sessionConnections`, so it means the session — not
  // addConnectionConf's "wherever this user's edits go", which for a jbrowse-web
  // admin is the config.json served to every visitor
  it('adds to the session, not to wherever the user edits land', async () => {
    const { pluginManager, connections } = setupWithHub([])

    await loadSessionSpec(
      { sessionConnections: [HUB], views: [] },
      pluginManager,
    )

    expect(connections.addedVia).toEqual(['addSessionConnectionConf'])
  })

  // Desktop and the embedded products have no sessionConnections array; their
  // one destination is the config, which is saved with the session there anyway
  it('falls back to addConnectionConf where there is no session-scoped adder', async () => {
    const { pluginManager, connections } = setupWithHub([], {
      sessionScoped: false,
    })

    await loadSessionSpec(
      { sessionConnections: [HUB], views: [] },
      pluginManager,
    )

    expect(connections.addedVia).toEqual(['addConnectionConf'])
  })

  // an unregistered type fails the connection array's MST union check, which
  // threw past every per-key guard and cost the spec its tracks, views and
  // layout — over one typo, reported as a raw union-type dump
  it('names an unknown connection type and still loads the rest of the spec', async () => {
    const { session, pluginManager, connections } = setupWithHub([], {
      registeredConnectionTypes: ['UCSCTrackHubConnection'],
    })

    await loadSessionSpec(
      {
        sessionConnections: [{ ...HUB, type: 'NotARealConnection' }],
        views: [{ type: 'LinearGenomeView', assembly: 'volvox' }],
      },
      pluginManager,
    )

    expect(session.notifyError).toHaveBeenCalledWith(
      expect.stringContaining('unknown type "NotARealConnection"'),
    )
    expect(connections.made).toEqual([])
    expect(session.views).toHaveLength(1)
  })

  it('keeps loading the spec when a connection config is rejected', async () => {
    const { session, pluginManager, connections } = setupWithHub([], {
      throwOnAdd: true,
    })

    await loadSessionSpec(
      {
        sessionConnections: [HUB],
        views: [{ type: 'LinearGenomeView', assembly: 'volvox' }],
      },
      pluginManager,
    )

    expect(session.notifyError).toHaveBeenCalledWith(
      expect.stringContaining('has an invalid configuration'),
      expect.anything(),
    )
    expect(connections.made).toEqual([])
    expect(session.views).toHaveLength(1)
  })
})

// `size` reaches dockview only on the top-level split, and only when every
// panel there carries one; anywhere else the whole sizing pass bails, so a spec
// author who sizes a nested panel sees an evenly-split layout and no reason why
describe('layout size that cannot be applied', () => {
  async function loadWithLayout(layout: unknown) {
    const { session, pluginManager } = setup({
      'LaunchView-LinearGenomeView': async s => {
        s.views.push(stubView(`v${s.views.length}`))
      },
    })
    const views = [
      { type: 'LinearGenomeView' },
      { type: 'LinearGenomeView' },
      { type: 'LinearGenomeView' },
    ]
    await loadSessionSpec({ views, layout } as never, pluginManager)
    return session
  }

  const sized = (n: number, views: number[]) => ({ views, size: n })

  it('says nothing when every top-level panel is sized', async () => {
    const session = await loadWithLayout({
      direction: 'horizontal',
      children: [sized(70, [0]), sized(30, [1])],
    })
    expect(session.notify).not.toHaveBeenCalled()
  })

  it('says nothing when no size is given at all', async () => {
    const session = await loadWithLayout({
      direction: 'horizontal',
      children: [{ views: [0] }, { views: [1] }],
    })
    expect(session.notify).not.toHaveBeenCalled()
  })

  it('warns when only some top-level panels are sized', async () => {
    const session = await loadWithLayout({
      direction: 'horizontal',
      children: [sized(70, [0]), { views: [1] }],
    })
    expect(session.notify).toHaveBeenCalledWith(
      expect.stringContaining('size'),
      'info',
    )
  })

  it('warns when a size sits inside a nested container', async () => {
    const session = await loadWithLayout({
      direction: 'horizontal',
      children: [
        sized(30, [0]),
        { direction: 'vertical', children: [sized(50, [1]), sized(50, [2])] },
      ],
    })
    expect(session.notify).toHaveBeenCalledWith(
      expect.stringContaining('size'),
      'info',
    )
  })

  it('warns when tabs children are sized, which shares one group', async () => {
    const session = await loadWithLayout({
      direction: 'tabs',
      children: [sized(70, [0]), sized(30, [1])],
    })
    expect(session.notify).toHaveBeenCalledWith(
      expect.stringContaining('size'),
      'info',
    )
  })
})

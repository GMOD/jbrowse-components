import PluginManager from '@jbrowse/core/PluginManager'
import { observable, runInAction } from 'mobx'

import { resolveLayoutSpec, viewIdsInSpec } from '../WorkspaceLayout/spec.ts'
import { loadSessionSpec } from './loadSessionSpec.ts'

import type { LayoutSpecNode } from '../WorkspaceLayout/spec.ts'
import type { AbstractRootModel } from '@jbrowse/core/util'

// A fake session/pluginManager: the real ones need a full plugin runtime, but
// the layout mapping only cares about which view id each spec entry created, so
// stub the launch handlers to push view ids and record the layout spec applied.
interface StubView {
  id: string
  type: string
  displayName?: string
  setDisplayName: jest.Mock<void, [string]>
}
function stubView(id: string, type = 'StubView'): StubView {
  const view: StubView = {
    id,
    type,
    setDisplayName: jest.fn((arg: string) => {
      view.displayName = arg
    }),
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
    acceptedKeys = {},
    connections,
  }: {
    workspaces?: boolean
    registeredViewTypes?: string[]
    registeredConnectionTypes?: string[]
    // what each view type's registration publishes as writable on the view
    // object. A type absent here has none, which is the out-of-tree view whose
    // launcher vocabulary is undeclared — nothing there is classifiable
    acceptedKeys?: Record<string, string[]>
    // omitted models a session that cannot take connections at all
    connections?: ReturnType<typeof connectionStub>
  } = {},
) {
  const views: StubView[] = []
  const session = {
    views,
    notifyError: jest.fn(),
    notify: jest.fn(),
    ...(workspaces
      ? {
          setUseWorkspaces: jest.fn(),
          // Returns what the real action returns — the view ids the spec names,
          // in the order it states — because that return value is the whole
          // input to `orderViews`, and a stub returning `[]` cannot tell a
          // wired-up ordering from a dropped one.
          //
          // It also RESOLVES first, as the real action does. A stub that only
          // read ids off the converted spec could not see it produce a spec the
          // real resolver refuses, which is how a duplicate seat and an empty
          // node both got past this suite.
          applyLayoutSpec: jest.fn((spec: LayoutSpecNode) =>
            viewIdsInSpec(
              resolveLayoutSpec(
                spec,
                views.map(v => v.id),
              ),
            ),
          ),
          orderViews: jest.fn(),
        }
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
    getViewType: (type: string) => ({
      acceptedKeys: acceptedKeys[type],
      loadStateModel: async () => undefined,
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

test('a layout index names every view its spec entry created, not a session position', async () => {
  // The first spec view's handler adds a primary view AND an auxiliary one (a
  // connected ProteinView opens its genome view first, then itself), so
  // session.views is [a-main, a-aux, b]. Read positionally, layout index 1
  // would be a-aux; per-launch capture maps it to b, and index 0 to both of
  // A's views — recording one id per entry left a-aux in no cell at all.
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
  expect(session.applyLayoutSpec).toHaveBeenCalledWith({
    direction: 'horizontal',
    children: [{ views: ['a-main', 'a-aux'] }, { views: ['b'] }],
  })
})

test('a layout names a view by the id the spec pinned, beside the indexes', async () => {
  const { session, pluginManager } = setup({
    'LaunchView-A': async (s, args) => {
      s.views.push(stubView('genome'), stubView(String(args.id)))
    },
    'LaunchView-B': async s => {
      s.views.push(stubView('b'))
    },
  })

  await loadSessionSpec(
    {
      views: [
        { type: 'A', id: 'structure', assembly: 'volvox' },
        { type: 'B', assembly: 'volvox' },
      ],
      layout: {
        direction: 'horizontal',
        children: [{ views: ['genome', 1] }, { views: ['structure'] }],
      },
    },
    pluginManager,
  )

  expect(session.applyLayoutSpec).toHaveBeenCalledWith({
    direction: 'horizontal',
    children: [{ views: ['genome', 'b'] }, { views: ['structure'] }],
  })
  expect(session.notifyError).not.toHaveBeenCalled()
})

test('a layout id no view in the spec has is reported and dropped, like a bad index', async () => {
  const { session, pluginManager } = setup({
    'LaunchView-A': async s => {
      s.views.push(stubView('a'))
    },
  })

  await loadSessionSpec(
    {
      views: [{ type: 'A', assembly: 'volvox' }],
      layout: {
        direction: 'horizontal',
        children: [{ views: [0] }, { views: ['nope', 3] }],
      },
    },
    pluginManager,
  )

  expect(session.notifyError).toHaveBeenCalledWith(
    expect.stringContaining('view index 3'),
  )
  expect(session.notifyError).toHaveBeenCalledWith(
    expect.stringContaining('view id "nope"'),
  )
  expect(session.applyLayoutSpec).toHaveBeenCalledWith({
    direction: 'horizontal',
    children: [{ views: ['a'] }, { views: [] }],
  })
})

test("a spec entry's displayName goes to the view of its own type, not the first one its launcher made", async () => {
  const { session, pluginManager } = setup({
    'LaunchView-ProteinView': async s => {
      s.views.push(
        stubView('genome', 'LinearGenomeView'),
        stubView('structure', 'ProteinView'),
      )
    },
  })

  await loadSessionSpec(
    {
      views: [{ type: 'ProteinView', displayName: 'HBB, folded' }],
    },
    pluginManager,
  )

  const [genome, structure] = session.views
  expect(structure!.setDisplayName).toHaveBeenCalledWith('HBB, folded')
  expect(genome!.setDisplayName).not.toHaveBeenCalled()
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
  expect(session.applyLayoutSpec).toHaveBeenCalledWith({
    views: ['real'],
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

test('a layout stating an order applies it to session.views', async () => {
  // The regression this pins: a tab's `viewIds` carries membership, and a tab
  // renders `session.views` order. So a spec panel that stacks its views in an
  // order the `views` array does not have gets that order ONLY because the
  // layout's stated order is fed back through `orderViews` — the tree holding
  // it is not enough, and nothing reports it when the call goes missing.
  const { session, pluginManager } = setup({
    'LaunchView-A': async s => {
      s.views.push(stubView('a'))
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
      // b above a, the reverse of launch order
      layout: { views: [1, 0] },
    },
    pluginManager,
  )

  expect(session.orderViews).toHaveBeenCalledWith(['b', 'a'])
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
  expect(session.applyLayoutSpec).toHaveBeenCalledWith({
    views: ['a'],
    size: undefined,
  })
})

// The ProteinView case the index expansion exists for, spelled the way anyone
// would write it: one entry opens a genome view beside its own structure, and
// the other cell names the structure by id. Expanding the index blind seats the
// structure in BOTH cells — two React trees and two GPU contexts for one model
// — which the resolver now refuses outright, so the layout would have been lost
// entirely. An id stated by hand is the more specific statement and wins.
test('an id named by hand wins its view from an index that also created it', async () => {
  const { session, pluginManager } = setup({
    'LaunchView-Protein': async s => {
      s.views.push(stubView('genome'))
      s.views.push(stubView('structure', 'ProteinView'))
    },
  })

  await loadSessionSpec(
    {
      views: [{ type: 'Protein', assembly: 'volvox', id: 'structure' }],
      layout: {
        direction: 'horizontal',
        children: [{ views: [0] }, { views: ['structure'] }],
      },
    },
    pluginManager,
  )

  expect(session.notifyError).not.toHaveBeenCalled()
  expect(session.applyLayoutSpec).toHaveBeenCalledWith({
    direction: 'horizontal',
    children: [
      { views: ['genome'], size: undefined },
      { views: ['structure'], size: undefined },
    ],
    size: undefined,
  })
})

test('a node stating nothing costs its own cell, not the layout', async () => {
  const { session, pluginManager } = setup({
    'LaunchView-A': async s => {
      s.views.push(stubView('a'))
    },
  })

  await loadSessionSpec(
    {
      views: [{ type: 'A', assembly: 'volvox' }],
      layout: {
        direction: 'horizontal',
        children: [{ views: [0] }, { size: 30 }],
      },
    },
    pluginManager,
  )

  expect(session.notifyError).not.toHaveBeenCalled()
  expect(session.orderViews).toHaveBeenCalledWith(['a'])
})

// The layout is the LAST thing the spec does, so a layout the resolver will not
// arrange used to reach the whole load's catch — after `setUseWorkspaces(true)`
// had run, with the views left unordered and the spec's error reported as the
// session's.
test.each([
  [
    'seats one view twice',
    { children: [{ views: ['a'] }, { views: ['a'] }] },
    'more than one cell',
  ],
  ['spells views as a bare id', { views: 'a' }, '"views" is an array'],
])(
  'a layout that %s costs the spec its layout alone',
  async (_, layout, message) => {
    const { session, pluginManager } = setup({
      'LaunchView-A': async s => {
        s.views.push(stubView('a'))
      },
    })
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await loadSessionSpec(
        {
          views: [{ type: 'A', assembly: 'volvox' }],
          layout: layout as LayoutSpecNode,
        },
        pluginManager,
      )
    } finally {
      error.mockRestore()
    }

    // the view the spec asked for is still there, and the report names the layout
    expect(session.views.map(v => v.id)).toEqual(['a'])
    expect(session.notifyError).toHaveBeenCalledWith(
      expect.stringContaining(message),
      expect.anything(),
    )
  },
)

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

// v4's nesting, in the words every surface now uses for it — the LGV would
// otherwise report "No assembly provided", the downstream symptom
test('a spec view nesting its settings under init is launched, and warned about', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const launched: Record<string, unknown>[] = []
  const { session, pluginManager } = setup({
    'LaunchView-LinearGenomeView': async (s, args) => {
      launched.push(args)
      s.views.push(stubView('lgv'))
    },
  })

  await loadSessionSpec(
    {
      views: [
        { type: 'LinearGenomeView', init: { assembly: 'volvox', loc: 'ctgA' } },
      ],
    },
    pluginManager,
  )

  expect(warn).toHaveBeenCalledWith(
    'LinearGenomeView nests its settings under "init", which is deprecated: write every setting directly on the view object.',
  )
  expect(launched[0]).toMatchObject({ assembly: 'volvox', loc: 'ctgA' })
  expect(session.notifyError).not.toHaveBeenCalled()
  warn.mockRestore()
})

// A spec is arguments to a launcher and never becomes a view snapshot, so
// withLaunchInput's partition never runs over it. Without this the only report a
// typo produced was the launcher's own downstream symptom, "No assembly
// provided" — on the surface written by hand, with no compiler behind it.
describe('an unknown key on a spec view', () => {
  const lgv = {
    handlers: {
      'LaunchView-LinearGenomeView': async (s: { views: StubView[] }) => {
        s.views.push(stubView('lgv'))
      },
    },
    options: {
      registeredViewTypes: ['LinearGenomeView'],
      acceptedKeys: {
        LinearGenomeView: ['id', 'type', 'displayName', 'assembly', 'loc'],
      },
    },
  }

  test('is named', async () => {
    const { session, pluginManager } = setup(lgv.handlers, lgv.options)

    await loadSessionSpec(
      // @ts-expect-error the misspelling being caught
      { views: [{ type: 'LinearGenomeView', asembly: 'volvox' }] },
      pluginManager,
    )

    expect(session.notifyError).toHaveBeenCalledWith(
      'LinearGenomeView ignored unknown key(s): asembly',
    )
  })

  test('says nothing when every key is one the view takes', async () => {
    const { session, pluginManager } = setup(lgv.handlers, lgv.options)

    await loadSessionSpec(
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            loc: 'ctgA',
            displayName: 'a view',
          },
        ],
      },
      pluginManager,
    )

    expect(session.notifyError).not.toHaveBeenCalled()
  })

  // A view type that registers no launch keys publishes no vocabulary, so its
  // launcher's arguments are unclassifiable and every one of them would read as
  // a typo.
  test('says nothing about a view type that registers none', async () => {
    const { session, pluginManager } = setup(
      { 'LaunchView-GraphGenomeView': async () => {} },
      { registeredViewTypes: ['GraphGenomeView'] },
    )

    await loadSessionSpec(
      // @ts-expect-error a key only that plugin's launcher knows
      { views: [{ type: 'GraphGenomeView', gfa: 'x.gfa' }] },
      pluginManager,
    )

    expect(session.notifyError).not.toHaveBeenCalled()
  })
})

// `sessionTracks` names the session whoever is looking, so the spec asks for the
// session-scoped adder and nothing else. There is no fallback left to test: the
// base tracks mixin defines `addSessionTrackConf` too, so every product has one
// — desktop's is its own config file, which is the same place its session is
// saved. `publishTrackConf` is present here and must stay untouched, because an
// admin loading a spec link must not thereby rewrite the config.json every
// visitor is served.
describe('sessionTracks', () => {
  const TRACK = { trackId: 't1', type: 'FeatureTrack' }

  function setupWithTracks({ sessionScoped = true } = {}) {
    const addedVia: string[] = []
    const { session, pluginManager } = setup({})
    Object.assign(session, {
      // isSessionWithAddSessionTrack goes through isSessionModel, which keys on
      // these two rather than on MST node-ness
      rpcManager: {},
      configuration: {},
      publishTrackConf: (conf: Record<string, unknown>) => {
        addedVia.push('publishTrackConf')
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
    return { session, pluginManager, addedVia }
  }

  it('adds to the session, not to wherever the user edits land', async () => {
    const { pluginManager, addedVia } = setupWithTracks()

    await loadSessionSpec({ sessionTracks: [TRACK], views: [] }, pluginManager)

    expect(addedVia).toEqual(['addSessionTrackConf'])
  })

  // A session with no session-scoped adder at all is now only reachable by
  // hand-building one, and it says so rather than quietly publishing.
  it('declines, rather than publishing, without a session-scoped adder', async () => {
    const { session, pluginManager, addedVia } = setupWithTracks({
      sessionScoped: false,
    })

    await loadSessionSpec({ sessionTracks: [TRACK], views: [] }, pluginManager)

    expect(addedVia).toEqual([])
    expect(session.notifyError).toHaveBeenCalledWith(
      expect.stringContaining('cannot add tracks to a session'),
    )
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
    // the rejected config is console.errored as well as notified; expected here
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})

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
    error.mockRestore()
  })
})

// A `tabs` node shares one cell between its children, so a `size` on one of
// them describes nothing and is the one place a stated size is still dropped.
//
// Everything else here used to warn as well, because dockview honoured `size`
// only on the top-level split and only when every panel there carried one. That
// limitation is gone (ADR-068) and the warning outlived it, so these cases now
// pin the SILENCE: a spec author whose nested or partial sizes were applied
// must not be told they were ignored.
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

  // a bare sibling takes an equal share of what the sized ones leave over, so
  // `70` beside a bare panel is a 70/30 split — documented, and applied
  it('says nothing when only some top-level panels are sized', async () => {
    const session = await loadWithLayout({
      direction: 'horizontal',
      children: [sized(70, [0]), { views: [1] }],
    })
    expect(session.notify).not.toHaveBeenCalled()
  })

  it('says nothing when a size sits inside a nested container', async () => {
    const session = await loadWithLayout({
      direction: 'horizontal',
      children: [
        sized(30, [0]),
        { direction: 'vertical', children: [sized(50, [1]), sized(50, [2])] },
      ],
    })
    expect(session.notify).not.toHaveBeenCalled()
  })

  it('warns when tabs children are sized, which shares one cell', async () => {
    const session = await loadWithLayout({
      direction: 'tabs',
      children: [sized(70, [0]), sized(30, [1])],
    })
    expect(session.notify).toHaveBeenCalledWith(
      expect.stringContaining('size'),
      'info',
    )
  })

  // the `tabs` node the sizes are on is not the root, so the check has to
  // recurse — the old one only ever looked at the top level
  it('warns when a nested tabs node has sized children', async () => {
    const session = await loadWithLayout({
      direction: 'horizontal',
      children: [
        { views: [0] },
        { direction: 'tabs', children: [sized(70, [1]), sized(30, [2])] },
      ],
    })
    expect(session.notify).toHaveBeenCalledWith(
      expect.stringContaining('size'),
      'info',
    )
  })

  // The other thing a `tabs` node cannot take literally, and the one that was
  // failing silently rather than partially: a tab holds a flat stack of views,
  // so a container child has no split to become. Its views are flattened into
  // one tab; they used to be dropped from the layout entirely, after which
  // homing swept them into whichever tab happened to be showing.
  it('warns when a container is nested inside a tabs node', async () => {
    const session = await loadWithLayout({
      direction: 'tabs',
      children: [
        { views: [0] },
        { direction: 'horizontal', children: [{ views: [1] }, { views: [2] }] },
      ],
    })
    expect(session.notify).toHaveBeenCalledWith(
      expect.stringContaining('flattened'),
      'info',
    )
  })

  it('says nothing when a tabs node has only panels under it', async () => {
    const session = await loadWithLayout({
      direction: 'tabs',
      children: [{ views: [0] }, { views: [1, 2] }],
    })
    expect(session.notify).not.toHaveBeenCalled()
  })
})

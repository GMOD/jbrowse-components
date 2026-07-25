import PluginManager from '@jbrowse/core/PluginManager'

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

function setup(
  handlers: Record<string, (session: { views: StubView[] }) => Promise<void>>,
  // workspaces: false models an embedded product's session, which has neither
  // workspaces action. registeredViewTypes are view types the plugin manager
  // knows about, which is what separates "unknown type" from "type exists but
  // has no launcher"
  {
    workspaces = true,
    registeredViewTypes = [] as string[],
  }: { workspaces?: boolean; registeredViewTypes?: string[] } = {},
) {
  const session = {
    views: [] as StubView[],
    notifyError: jest.fn(),
    ...(workspaces
      ? { setUseWorkspaces: jest.fn(), setInit: jest.fn() }
      : undefined),
  }
  const rootModel = { session, setSession: jest.fn() }
  const pluginManager = {
    rootModel,
    extensionPoints: { has: (name: string) => name in handlers },
    getElementTypeRecord: () => ({
      has: (type: string) => registeredViewTypes.includes(type),
    }),
    evaluateAsyncExtensionPointStrict: (name: string) =>
      handlers[name]!(session),
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

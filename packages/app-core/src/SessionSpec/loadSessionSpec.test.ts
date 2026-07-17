import { loadSessionSpec } from './loadSessionSpec.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// A fake session/pluginManager: the real ones need a full plugin runtime, but
// the layout mapping only cares about which view id each spec entry created, so
// stub the launch handlers to push view ids and record what setInit receives.
function setup(
  handlers: Record<string, (session: { views: { id: string }[] }) => Promise<void>>,
) {
  const session = {
    views: [] as { id: string }[],
    setUseWorkspaces: jest.fn(),
    setInit: jest.fn(),
    notifyError: jest.fn(),
  }
  const rootModel = { session, setSession: jest.fn() }
  const pluginManager = {
    rootModel,
    extensionPoints: { has: (name: string) => name in handlers },
    evaluateAsyncExtensionPoint: (name: string) => handlers[name]!(session),
  } as unknown as PluginManager
  return { session, pluginManager }
}

test('layout indices map to the view each spec entry created, not session position', async () => {
  // The first spec view's handler adds a primary view AND an auxiliary one, so
  // session.views is [a-main, a-aux, b] — reading it positionally would map
  // layout index 1 to a-aux; the per-launch capture maps it to b.
  const { session, pluginManager } = setup({
    'LaunchView-A': async s => {
      s.views.push({ id: 'a-main' }, { id: 'a-aux' })
    },
    'LaunchView-B': async s => {
      s.views.push({ id: 'b' })
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
      s.views.push({ id: 'first' })
    },
    'LaunchView-Second': async s => {
      order.push('second')
      s.views.push({ id: 'second' })
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
      s.views.push({ id: 'real' })
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

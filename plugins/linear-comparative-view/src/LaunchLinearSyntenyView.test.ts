import LaunchLinearSyntenyView from './LaunchLinearSyntenyView.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

interface CapturedAddView {
  type: string
  initialState: { init: { views: unknown; tracks: string[][] } }
}

function setup() {
  const captured: CapturedAddView[] = []
  let handler: ((args: unknown) => Promise<void>) | undefined

  const pluginManager = {
    addToExtensionPoint: (
      _name: string,
      fn: (args: unknown) => Promise<void>,
    ) => {
      handler = fn
    },
  } as unknown as PluginManager

  const session = {
    addView: (type: string, initialState: CapturedAddView['initialState']) => {
      captured.push({ type, initialState })
      return { id: 'fake' }
    },
  }

  LaunchLinearSyntenyView(pluginManager)
  return { captured, session, run: (args: unknown) => handler!(args) }
}

test('flat 1D tracks normalized to 2D at level 0', async () => {
  const { captured, session, run } = setup()
  await run({
    session,
    views: [{ assembly: 'A' }, { assembly: 'B' }],
    tracks: ['t1', 't2'],
  })
  expect(captured).toHaveLength(1)
  expect(captured[0]!.type).toBe('LinearSyntenyView')
  expect(captured[0]!.initialState.init.tracks).toEqual([['t1', 't2']])
})

test('2D tracks preserved per-level for multi-way', async () => {
  const { captured, session, run } = setup()
  await run({
    session,
    views: [{ assembly: 'A' }, { assembly: 'B' }, { assembly: 'C' }],
    tracks: [['ab_paf'], ['bc_paf']],
  })
  expect(captured[0]!.initialState.init.tracks).toEqual([
    ['ab_paf'],
    ['bc_paf'],
  ])
})

test('empty tracks normalized to single empty level', async () => {
  const { captured, session, run } = setup()
  await run({
    session,
    views: [{ assembly: 'A' }, { assembly: 'B' }],
    tracks: [],
  })
  expect(captured[0]!.initialState.init.tracks).toEqual([[]])
})

test('omitted tracks defaults to single empty level', async () => {
  const { captured, session, run } = setup()
  await run({
    session,
    views: [{ assembly: 'A' }, { assembly: 'B' }],
  })
  expect(captured[0]!.initialState.init.tracks).toEqual([[]])
})

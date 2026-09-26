import PluginLoader from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'

import { MultipleViewsSessionMixin } from './MultipleViews.ts'

// The contract a runtime plugin's build depends on, end to end over a real
// two-module plugin (test_data/split_plugin): a config naming the plugin
// evaluates its ENTRY, and the module behind its state-model thunk stays
// unevaluated until a view is launched.
//
// `lazyViewStateModels.test.ts` pins the same deferral for a view type
// registered in-process, which is not the same claim: the shape that matters
// to a published plugin is the second MODULE, because that is what a bundler
// turns into a second chunk and what decides whether the download is on the
// boot path. jbrowse-plugin-msaview writes both halves of this today
// (`lazy()` on its component, a thunk available for its model) and ships one
// file, so nothing it wrote is honoured — measured at 466 KB of 505 KB still
// evaluated at install. Without this test nothing here says which side of that
// line the host is on.
//
// The fixture counts its own evaluations on a global; each test resets it.
declare global {
  var __splitPluginModuleEvaluations: number | undefined
}

async function installSplitPlugin() {
  const records = await new PluginLoader(
    [{ esmUrl: 'https://example.com/split_plugin/index.js' }],
    { fetchESM: () => import('../../../../test_data/split_plugin/index.js') },
  ).load()
  const pluginManager = new PluginManager(
    records.map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
    })),
  )
    .createPluggableElements()
    .configure()
  const sessionModel = MultipleViewsSessionMixin(pluginManager)
  return {
    pluginManager,
    session: sessionModel.create({ name: 'test' }, { pluginManager }),
  }
}

beforeEach(() => {
  globalThis.__splitPluginModuleEvaluations = 0
})

test('installing the plugin does not evaluate the module behind its thunk', async () => {
  const { pluginManager } = await installSplitPlugin()
  // registered, so a config naming SplitView is recognised...
  expect(pluginManager.getViewType('SplitView').name).toBe('SplitView')
  // ...and its weight has not been paid
  expect(pluginManager.getViewType('SplitView').isStateModelLoaded).toBe(false)
  expect(globalThis.__splitPluginModuleEvaluations).toBe(0)
})

test('launching the view evaluates it, once', async () => {
  const { session } = await installSplitPlugin()
  const view = await session.launchView('SplitView', { displayName: 'mine' })
  expect(view.type).toBe('SplitView')
  expect(globalThis.__splitPluginModuleEvaluations).toBe(1)

  // a second view reuses the loaded model rather than re-importing
  await session.launchView('SplitView', {})
  expect(globalThis.__splitPluginModuleEvaluations).toBe(1)
})

// The error a session snapshot hits when the deferral is honoured, which is
// the cost of writing the thunk and the reason a plugin's own launcher has to
// move off addView.
test('addView still refuses the type until the module has loaded', async () => {
  const { session } = await installSplitPlugin()
  expect(() => session.addView('SplitView')).toThrow(/use launchView/)
  expect(globalThis.__splitPluginModuleEvaluations).toBe(0)
})

import Plugin from '@jbrowse/core/Plugin'

import createModel from './createModel/index.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

class TestPlugin extends Plugin {
  name = 'TestPlugin'
}

const definition: PluginDefinition = {
  name: 'TestPlugin',
  umdUrl: 'https://example.com/test-plugin.umd.js',
}

test('a plugin class is installed on the main thread', async () => {
  const { pluginManager } = await createModel([TestPlugin])

  expect(pluginManager.hasPlugin('TestPlugin')).toBe(true)
  // nothing to hand the worker: a bare class carries no url to load it from
  expect(pluginManager.runtimePluginDefinitions).toEqual([])
})

// The RPC worker doesn't receive plugin classes — it re-loads them from their
// definitions, which RpcManager reads off pluginManager.runtimePluginDefinitions
// and sends as the worker's boot config. So a `loadPlugins` record must keep
// its definition all the way through, or the plugin is installed on the main
// thread only and anything it contributes that runs in the worker (an adapter,
// typically) fails to resolve there.
test('a loadPlugins record keeps the definition the RPC worker boots from', async () => {
  const { pluginManager } = await createModel([
    { plugin: TestPlugin, definition },
  ])

  expect(pluginManager.hasPlugin('TestPlugin')).toBe(true)
  expect(pluginManager.runtimePluginDefinitions).toEqual([definition])
})

test('bundled core plugins are not treated as runtime plugins', async () => {
  const { pluginManager } = await createModel([])

  expect(pluginManager.plugins.length).toBeGreaterThan(0)
  // the worker bundles the same core set, so it must not be told to fetch them
  expect(pluginManager.runtimePluginDefinitions).toEqual([])
})

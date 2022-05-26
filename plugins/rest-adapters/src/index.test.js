import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

test('plugin in a stock JBrowse', () => {
  const originalConsoleWarn = console.warn
  console.warn = jest.fn()
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  console.warn = originalConsoleWarn
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const adapter = pluginManager.getAdapterType('JBrowseRESTFeatureAdapter')
  const config = adapter.configSchema.create({ type: 'JBrowseRESTFeatureAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()
})

import PluginManager from '@jbrowse/core/PluginManager'
import ThisPlugin from '.'

test('plugin in a stock JBrowse', () => {
  console.warn = jest.fn()
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )
})

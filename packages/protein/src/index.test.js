import PluginManager from '@gmod/jbrowse-core/PluginManager'
import ThisPlugin from '.'

test('plugin in a stock JBrowse', () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )
})

import PluginManager from '@jbrowse/core/PluginManager'
import ThisPlugin from '.'

test("won't add if already added", () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )
})

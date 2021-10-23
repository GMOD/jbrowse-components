import PluginManager from '@jbrowse/core/PluginManager'
import ThisPlugin from '.'

describe('menus', () => {
  let pluginManager

  it("won't add if already added", () => {
    console.warn = jest.fn()
    pluginManager = new PluginManager([new ThisPlugin()])
    pluginManager.createPluggableElements()
    pluginManager.configure()

    expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
      /JBrowse already configured, cannot add plugins/,
    )
  })
})

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import ThisPlugin from '.'

describe('Data management', () => {
  let pluginManager

  beforeAll(() => {
    pluginManager = new PluginManager([new ThisPlugin()])
    pluginManager.createPluggableElements()
    pluginManager.configure()
  })

  it("won't add if already added", () => {
    expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
      /JBrowse already configured, cannot add plugins/,
    )
  })
})

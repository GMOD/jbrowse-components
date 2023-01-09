import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

describe('Config editing', () => {
  let pluginManager: PluginManager

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

  it('adds config editor widget', () => {
    const ConfigurationEditorWidget = pluginManager.getWidgetType(
      'ConfigurationEditorWidget',
    )
    const config = ConfigurationEditorWidget.configSchema.create({
      type: 'ConfigurationEditorWidget',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
  })

  it('creates proper FromConfigAdapter', () => {
    const adapter = pluginManager.getAdapterType('FromConfigAdapter')
    const config = adapter.configSchema.create({
      type: 'FromConfigAdapter',
      adapterId: 'testFromConfigAdapterId',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
  })
})

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

describe('Config editing', () => {
  let pluginManager

  beforeAll(() => {
    const originalConsoleWarn = console.warn
    console.warn = jest.fn()
    pluginManager = new PluginManager([new ThisPlugin()])
    pluginManager.createPluggableElements()
    pluginManager.configure()
    console.warn = originalConsoleWarn
  })

  it("won't add if already added", () => {
    expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
      /JBrowse already configured, cannot add plugins/,
    )
  })

  it('adds config editor drawer widget', () => {
    const ConfigurationEditorDrawerWidget = pluginManager.getDrawerWidgetType(
      'ConfigurationEditorDrawerWidget',
    )
    const config = ConfigurationEditorDrawerWidget.configSchema.create({
      type: 'ConfigurationEditorDrawerWidget',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
  })

  it('creates proper FromConfigAdapter', () => {
    const adapter = pluginManager.getAdapterType('FromConfigAdapter')
    const config = adapter.configSchema.create({
      type: 'FromConfigAdapter',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
  })
})

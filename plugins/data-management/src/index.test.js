import PluginManager from '@jbrowse/core/PluginManager'
import Config from '@jbrowse/plugin-config'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

describe('Data management', () => {
  let pluginManager

  beforeAll(() => {
    const originalConsoleWarn = console.warn
    console.warn = jest.fn()
    pluginManager = new PluginManager([new ThisPlugin(), new Config()])
    pluginManager.createPluggableElements()
    pluginManager.configure()
    console.warn = originalConsoleWarn
  })

  it("won't add if already added", () => {
    expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
      /JBrowse already configured, cannot add plugins/,
    )
  })

  it('adds track add widget', () => {
    const AddTrackWidget = pluginManager.getWidgetType('AddTrackWidget')
    const config = AddTrackWidget.configSchema.create({
      type: 'AddTrackWidget',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
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

  it('adds connection add widget', () => {
    const AddConnectionWidget = pluginManager.getWidgetType(
      'AddConnectionWidget',
    )
    const config = AddConnectionWidget.configSchema.create({
      type: 'AddConnectionWidget',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
  })

  it('adds hierarchical track selector', () => {
    const HierarchicalTrackSelectorWidget = pluginManager.getWidgetType(
      'HierarchicalTrackSelectorWidget',
    )
    const config = HierarchicalTrackSelectorWidget.configSchema.create({
      type: 'HierarchicalTrackSelectorWidget',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
  })
})

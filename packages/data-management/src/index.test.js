import PluginManager from '@gmod/jbrowse-core/PluginManager'
import Config from '@gmod/jbrowse-plugin-config'
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
    const AddTrackDrawerWidget = pluginManager.getDrawerWidgetType(
      'AddTrackDrawerWidget',
    )
    const config = AddTrackDrawerWidget.configSchema.create({
      type: 'AddTrackDrawerWidget',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
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

  it('adds connection add widget', () => {
    const AddConnectionDrawerWidget = pluginManager.getDrawerWidgetType(
      'AddConnectionDrawerWidget',
    )
    const config = AddConnectionDrawerWidget.configSchema.create({
      type: 'AddConnectionDrawerWidget',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
  })

  it('adds hierarchical track selector', () => {
    const HierarchicalTrackSelectorDrawerWidget = pluginManager.getDrawerWidgetType(
      'HierarchicalTrackSelectorDrawerWidget',
    )
    const config = HierarchicalTrackSelectorDrawerWidget.configSchema.create({
      type: 'HierarchicalTrackSelectorDrawerWidget',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
  })
})

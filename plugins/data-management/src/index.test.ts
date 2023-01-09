import PluginManager from '@jbrowse/core/PluginManager'
import Config from '@jbrowse/plugin-config'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

let pluginManager: PluginManager

beforeAll(() => {
  pluginManager = new PluginManager([new ThisPlugin(), new Config()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
})

test("won't add if already added", () => {
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )
})

test('adds track add widget', () => {
  const AddTrackWidget = pluginManager.getWidgetType('AddTrackWidget')
  const config = AddTrackWidget.configSchema.create({
    type: 'AddTrackWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})

test('adds config editor widget', () => {
  const ConfigurationEditorWidget = pluginManager.getWidgetType(
    'ConfigurationEditorWidget',
  )
  const config = ConfigurationEditorWidget.configSchema.create({
    type: 'ConfigurationEditorWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})

test('adds connection add widget', () => {
  const AddConnectionWidget = pluginManager.getWidgetType('AddConnectionWidget')
  const config = AddConnectionWidget.configSchema.create({
    type: 'AddConnectionWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})

test('adds hierarchical track selector', () => {
  const HierarchicalTrackSelectorWidget = pluginManager.getWidgetType(
    'HierarchicalTrackSelectorWidget',
  )
  const config = HierarchicalTrackSelectorWidget.configSchema.create({
    type: 'HierarchicalTrackSelectorWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})

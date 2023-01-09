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

test('adds grid bookmark widget', () => {
  const GridBookmarkWidget = pluginManager.getWidgetType('GridBookmarkWidget')
  const config = GridBookmarkWidget.configSchema.create({
    type: 'GridBookmarkWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})

import PluginManager from '@jbrowse/core/PluginManager'
import Config from '@jbrowse/plugin-config'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

describe('Grid bookmark', () => {
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

  it('adds grid bookmark widget', () => {
    const GridBookmarkWidget = pluginManager.getWidgetType('GridBookmarkWidget')
    const config = GridBookmarkWidget.configSchema.create({
      type: 'GridBookmarkWidget',
    })
    expect(getSnapshot(config)).toMatchSnapshot()
  })
})

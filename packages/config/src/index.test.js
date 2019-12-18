import { getSnapshot } from 'mobx-state-tree'
import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import MyPlugin from '.'

describe('Config editing', () => {
  let pluginManager

  beforeAll(() => {
    ;({ pluginManager } = createTestSession({ configId: 'testing' }))
  })

  it("won't add if already added", () => {
    expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
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
    expect(getSnapshot(config)).toMatchSnapshot({
      configId: expect.any(String),
    })
  })

  it('creates proper FromConfigAdapter', () => {
    const adapter = pluginManager.getAdapterType('FromConfigAdapter')
    const config = adapter.configSchema.create({
      type: 'FromConfigAdapter',
    })
    expect(getSnapshot(config)).toMatchSnapshot({
      configId: expect.any(String),
    })
  })
})

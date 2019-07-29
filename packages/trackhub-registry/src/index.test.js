import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import MyPlugin from './index'

describe('Data management', () => {
  let pluginManager

  beforeAll(() => {
    ;({ pluginManager } = createTestSession({ configId: 'testing' }))
  })

  it("won't add if already added", () => {
    expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
      /JBrowse already configured, cannot add plugins/,
    )
  })
})

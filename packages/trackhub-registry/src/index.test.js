import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import MyPlugin from './index'

describe('Data management', () => {
  let pluginManager

  beforeAll(async () => {
    ;({ pluginManager } = await createTestEnv({ configId: 'testing' }))
  })

  it("won't add if already added", () => {
    expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
      /JBrowse already configured, cannot add plugins/,
    )
  })
})

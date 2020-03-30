import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import MyPlugin from '.'

describe('Data management', () => {
  let pluginManager

  beforeAll(() => {
    // @ts-ignore
    ;({ pluginManager } = createTestSession())
  })

  it("won't add if already added", () => {
    expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
      /JBrowse already configured, cannot add plugins/,
    )
  })
})

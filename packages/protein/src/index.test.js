import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import MyPlugin from '.'

test('plugin in a stock JBrowse', () => {
  // @ts-ignore
  const { pluginManager } = createTestSession()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )
})

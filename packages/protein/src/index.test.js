import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import MyPlugin from './index'

test('plugin in a stock JBrowse', () => {
  const { pluginManager } = createTestSession()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )
})

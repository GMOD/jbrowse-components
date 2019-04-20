import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'
// import { createTestEnv } from '../../JBrowse'

xtest('plugin in a stock JBrowse', async () => {
  function createTestEnv() {}
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const BamAdapter = pluginManager.getAdapterType('BamAdapter')
  const config = BamAdapter.configSchema.create({ type: 'BamAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot({
    configId: expect.any(String),
    index: { configId: expect.any(String) },
  })
})

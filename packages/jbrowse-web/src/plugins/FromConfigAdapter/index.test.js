import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'
import { createTestEnv } from '../../JBrowse'

test('plugin in a stock JBrowse', async () => {
  // adding this plugin should fail because it is core
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const adapter = pluginManager.getAdapterType('FromConfigAdapter')
  const config = adapter.configSchema.create({
    type: 'FromConfigAdapter',
  })
  expect(getSnapshot(config)).toMatchSnapshot({
    configId: expect.any(String),
  })
})

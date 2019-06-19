import { getSnapshot } from 'mobx-state-tree'
import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import MyPlugin from './index'

test('plugin in a stock JBrowse', async () => {
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const NCListAdapter = pluginManager.getAdapterType('NCListAdapter')
  const config = NCListAdapter.configSchema.create({ type: 'NCListAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot({
    configId: expect.any(String),
    type: 'NCListAdapter',
  })
})

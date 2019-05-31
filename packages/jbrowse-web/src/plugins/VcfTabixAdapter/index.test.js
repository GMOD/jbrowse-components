import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'
import { createTestEnv } from '../../JBrowse'

test('plugin in a stock JBrowse', async () => {
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const IndexedFastaAdapter = pluginManager.getAdapterType(
    'IndexedFastaAdapter',
  )
  const config = IndexedFastaAdapter.configSchema.create({
    type: 'IndexedFastaAdapter',
  })
  expect(getSnapshot(config)).toMatchSnapshot({
    configId: expect.any(String),
  })
})

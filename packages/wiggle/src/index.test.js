import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'

test('plugin in a stock JBrowse', async () => {
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const BigWigAdapter = pluginManager.getAdapterType('BigWigAdapter')
  const config = BigWigAdapter.configSchema.create({ type: 'BigWigAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot({
    configId: expect.any(String),
  })
})

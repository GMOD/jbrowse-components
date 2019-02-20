import MyPlugin from './index'
import { createTestEnv } from '../../JBrowse'

test('plugin in a stock JBrowse', async () => {
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const TwoBitAdapter = pluginManager.getAdapterType('TwoBitAdapter')
  const config = TwoBitAdapter.configSchema.create({ type: 'TwoBitAdapter' })
  expect(config).toMatchSnapshot({
    configId: expect.any(String),
  })
})

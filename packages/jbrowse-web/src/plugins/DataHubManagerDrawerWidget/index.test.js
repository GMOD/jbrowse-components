import { getSnapshot } from 'mobx-state-tree'
import { createTestEnv } from '../../JBrowse'
import MyPlugin from './index'

test('plugin in a stock JBrowse', async () => {
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const DataHubDrawerWidget = pluginManager.getDrawerWidgetType(
    'DataHubDrawerWidget',
  )
  const config = DataHubDrawerWidget.configSchema.create({
    type: 'DataHubDrawerWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot({ configId: expect.any(String) })
})

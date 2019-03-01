import { getSnapshot } from 'mobx-state-tree'
import { createTestEnv } from '../../JBrowse'
import MyPlugin from './index'

test('plugin in a stock JBrowse', async () => {
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const HierarchicalTrackSelectorDrawerWidget = pluginManager.getDrawerWidgetType(
    'HierarchicalTrackSelectorDrawerWidget',
  )
  const config = HierarchicalTrackSelectorDrawerWidget.configSchema.create({
    type: 'HierarchicalTrackSelectorDrawerWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot({ configId: expect.any(String) })
})

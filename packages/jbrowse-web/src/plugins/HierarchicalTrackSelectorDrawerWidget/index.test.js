import { getSnapshot } from 'mobx-state-tree'
import JBrowse from '../../JBrowse'
import MyPlugin from './index'

test('plugin in a stock JBrowse', async () => {
  // adding this plugin should fail because it is core
  await expect(
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).rejects.toThrowErrorMatchingSnapshot()

  const jbrowse = await new JBrowse().configure()
  const HierarchicalTrackSelectorDrawerWidget = jbrowse.pluginManager.getDrawerWidgetType(
    'HierarchicalTrackSelectorDrawerWidget',
  )
  const config = HierarchicalTrackSelectorDrawerWidget.configSchema.create({
    type: 'HierarchicalTrackSelectorDrawerWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot({ configId: expect.any(String) })
})

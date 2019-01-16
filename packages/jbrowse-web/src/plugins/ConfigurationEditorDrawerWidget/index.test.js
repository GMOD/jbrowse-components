import { getSnapshot } from 'mobx-state-tree'
import JBrowse from '../../JBrowse'
import MyPlugin from './index'

test.only('plugin in a stock JBrowse', () => {
  // adding this plugin should fail because it is core
  expect(() =>
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).toThrowErrorMatchingSnapshot()

  const jbrowse = new JBrowse().configure()
  const HierarchicalTrackSelectorDrawerWidget = jbrowse.pluginManager.getDrawerWidgetType(
    'HierarchicalTrackSelectorDrawerWidget',
  )
  const config = HierarchicalTrackSelectorDrawerWidget.configSchema.create({
    type: 'HierarchicalTrackSelectorDrawerWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot({ configId: expect.any(String) })
})

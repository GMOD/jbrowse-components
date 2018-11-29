import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'
import JBrowse from '../../JBrowse'

test.only('plugin in a stock JBrowse', () => {
  // adding this plugin should fail because it is core
  expect(() =>
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).toThrowErrorMatchingSnapshot()

  const jbrowse = new JBrowse().configure()
  const HierarchicalTrackSelectorDrawerWidget = jbrowse.getDrawerWidgetType(
    'HierarchicalTrackSelectorDrawerWidget',
  )
  const config = HierarchicalTrackSelectorDrawerWidget.configSchema.create({
    type: 'HierarchicalTrackSelectorDrawerWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})

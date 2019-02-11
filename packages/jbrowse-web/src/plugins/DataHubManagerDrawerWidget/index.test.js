import { getSnapshot } from 'mobx-state-tree'
import JBrowse from '../../JBrowse'
import MyPlugin from './index'

test('plugin in a stock JBrowse', () => {
  // adding this plugin should fail because it is core
  expect(() =>
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).toThrowErrorMatchingSnapshot()

  const jbrowse = new JBrowse().configure()
  const DataHubDrawerWidget = jbrowse.pluginManager.getDrawerWidgetType(
    'DataHubDrawerWidget',
  )
  const config = DataHubDrawerWidget.configSchema.create({
    type: 'DataHubDrawerWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot({ configId: expect.any(String) })
})

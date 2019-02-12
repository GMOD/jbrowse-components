import { getSnapshot } from 'mobx-state-tree'
import JBrowse from '../../JBrowse'
import MyPlugin from './index'

test('plugin in a stock JBrowse', () => {
  // adding this plugin should fail because it is core
  expect(() => new JBrowse().addPlugin(new MyPlugin()).configure()).toThrow(
    /already registered, cannot register it again/,
  )

  const jbrowse = new JBrowse().configure()
  const AddTrackDrawerWidget = jbrowse.pluginManager.getDrawerWidgetType(
    'AddTrackDrawerWidget',
  )
  const config = AddTrackDrawerWidget.configSchema.create({
    type: 'AddTrackDrawerWidget',
  })
  expect(getSnapshot(config)).toMatchSnapshot({ configId: expect.any(String) })
})

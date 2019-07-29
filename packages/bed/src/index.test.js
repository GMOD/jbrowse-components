import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'

test('plugin in a stock JBrowse', () => {
  const { pluginManager } = createTestSession()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const BigBedAdapter = pluginManager.getAdapterType('BigBedAdapter')
  const config = BigBedAdapter.configSchema.create({ type: 'BigBedAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot({
    configId: expect.any(String),
  })
})

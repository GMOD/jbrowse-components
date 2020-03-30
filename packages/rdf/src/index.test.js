import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'

test('plugin in a stock JBrowse', () => {
  // @ts-ignore
  const { pluginManager } = createTestSession()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const SPARQLAdapter = pluginManager.getAdapterType('SPARQLAdapter')
  const config = SPARQLAdapter.configSchema.create({
    type: 'SPARQLAdapter',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})

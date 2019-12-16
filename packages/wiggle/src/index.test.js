import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from '.'

test('plugin in a stock JBrowse', () => {
  const { pluginManager } = createTestSession()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const BigWigAdapter = pluginManager.getAdapterType('BigWigAdapter')
  const config = BigWigAdapter.configSchema.create({ type: 'BigWigAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()
})

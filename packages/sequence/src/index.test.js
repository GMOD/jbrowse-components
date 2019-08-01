import { createTestSession } from '@gmod/jbrowse-web/src/jbrowseModel'
import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'

test('plugin in a stock JBrowse', () => {
  const { pluginManager } = createTestSession()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const TwoBitAdapter = pluginManager.getAdapterType('TwoBitAdapter')
  const config = TwoBitAdapter.configSchema.create({ type: 'TwoBitAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot({
    configId: expect.any(String),
  })

  const IndexedFastaAdapter = pluginManager.getAdapterType(
    'IndexedFastaAdapter',
  )
  const config2 = IndexedFastaAdapter.configSchema.create({
    type: 'IndexedFastaAdapter',
  })
  expect(getSnapshot(config2)).toMatchSnapshot({
    configId: expect.any(String),
  })
})

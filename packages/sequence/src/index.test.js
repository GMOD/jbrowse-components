import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from '.'

test('plugin in a stock JBrowse', () => {
  // @ts-ignore
  const { pluginManager } = createTestSession()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const TwoBitAdapter = pluginManager.getAdapterType('TwoBitAdapter')
  const config = TwoBitAdapter.configSchema.create({ type: 'TwoBitAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()

  const IndexedFastaAdapter = pluginManager.getAdapterType(
    'IndexedFastaAdapter',
  )
  const config2 = IndexedFastaAdapter.configSchema.create({
    type: 'IndexedFastaAdapter',
  })
  expect(getSnapshot(config2)).toMatchSnapshot()
})

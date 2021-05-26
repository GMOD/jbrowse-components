import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

test('plugin in a stock JBrowse', () => {
  console.warn = jest.fn()
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
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

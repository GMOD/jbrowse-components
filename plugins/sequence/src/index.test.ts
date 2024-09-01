import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

test('plugin in a stock JBrowse', () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const TwoBitAdapter = pluginManager.getAdapterType('TwoBitAdapter')!
  const cfg = TwoBitAdapter.configSchema.create({ type: 'TwoBitAdapter' })
  expect(getSnapshot(cfg)).toMatchSnapshot()

  const FastaAdapter = pluginManager.getAdapterType('IndexedFastaAdapter')!
  const cfg2 = FastaAdapter.configSchema.create({ type: 'IndexedFastaAdapter' })
  expect(getSnapshot(cfg2)).toMatchSnapshot()
})

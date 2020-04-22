import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from './index'

test('plugin in a stock JBrowse', () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const SPARQLAdapter = pluginManager.getAdapterType('SPARQLAdapter')
  const config = SPARQLAdapter.configSchema.create({
    type: 'SPARQLAdapter',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})

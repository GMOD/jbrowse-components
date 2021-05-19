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

  const BigBedAdapter = pluginManager.getAdapterType('BigBedAdapter')
  const config = BigBedAdapter.configSchema.create({ type: 'BigBedAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()
})

import PluginManager from '@jbrowse/core/PluginManager'
import SVG from '@jbrowse/plugin-svg'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

test('plugin in a stock JBrowse', () => {
  const pluginManager = new PluginManager([new ThisPlugin(), new SVG()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const VcfTabixAdapter = pluginManager.getAdapterType('VcfTabixAdapter')!
  const config = VcfTabixAdapter.configSchema.create({
    type: 'VcfTabixAdapter',
  })
  expect(getSnapshot(config)).toMatchSnapshot()

  const VariantTrack = pluginManager.getTrackType('VariantTrack')!
  const config2 = VariantTrack.configSchema.create({
    type: 'VariantTrack',
    trackId: 'trackId0',
    adapter: { type: 'VcfTabixAdapter' },
  })
  expect(getSnapshot(config2)).toMatchSnapshot()
})

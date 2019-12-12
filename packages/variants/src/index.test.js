import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from '.'

test('plugin in a stock JBrowse', () => {
  const { pluginManager } = createTestSession()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const VcfTabixAdapter = pluginManager.getAdapterType('VcfTabixAdapter')
  const config = VcfTabixAdapter.configSchema.create({
    type: 'VcfTabixAdapter',
  })
  expect(getSnapshot(config)).toMatchSnapshot()

  const VariantTrack = pluginManager.getTrackType('VariantTrack')
  const config2 = VariantTrack.configSchema.create({
    type: 'VariantTrack',
    trackId: 'trackId0',
    adapter: { type: 'VcfTabixAdapter' },
  })
  expect(getSnapshot(config2)).toMatchSnapshot()
})

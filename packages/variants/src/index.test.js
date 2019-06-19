import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import { getSnapshot } from 'mobx-state-tree'
import MyPlugin from './index'

test('plugin in a stock JBrowse', async () => {
  const { pluginManager } = await createTestEnv()
  expect(() => pluginManager.addPlugin(new MyPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const VcfTabixAdapter = pluginManager.getAdapterType('VcfTabixAdapter')
  const config = VcfTabixAdapter.configSchema.create({
    type: 'VcfTabixAdapter',
  })
  expect(getSnapshot(config)).toMatchSnapshot({
    configId: expect.any(String),
    index: { configId: expect.any(String) },
  })

  const VariantTrack = pluginManager.getTrackType('VariantTrack')
  const config2 = VariantTrack.configSchema.create({
    type: 'VariantTrack',
    adapter: { type: 'VcfTabixAdapter' },
  })
  expect(getSnapshot(config2)).toMatchSnapshot({
    adapter: {
      configId: expect.any(String),
      index: {
        configId: expect.any(String),
      },
    },
    configId: expect.any(String),
    renderers: {
      PileupRenderer: {
        configId: expect.any(String),
      },
      SvgFeatureRenderer: {
        configId: expect.any(String),
        labels: {
          configId: expect.any(String),
        },
      },
      configId: expect.any(String),
    },
  })
})

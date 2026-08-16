import PluginManager from '@jbrowse/core/PluginManager'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

import corePlugins from './corePlugins.ts'

jest.mock('./makeWorkerInstance', () => () => {})

// `getExportData` is reached through the capability list and nothing else
// (core's fetchTrackData), so an adapter that implements it without declaring
// it is dead code: the Save-track-data dialog silently rebuilds the file out of
// rendered features instead, losing whatever the raw lines carried. That is
// what SplitVcfTabixAdapter shipped as, with a passing unit test on the method
// itself. The reverse — declaring it without implementing it — costs a worker
// round trip that always declines.
test('every adapter implementing getExportData declares the exportData capability', async () => {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mismatches = []
  for (const adapterType of pluginManager.getAdapterElements()) {
    const AdapterClass = await adapterType.getAdapterClass()
    const implemented =
      AdapterClass.prototype.getExportData !== undefined &&
      AdapterClass.prototype.getExportData !==
        BaseFeatureDataAdapter.prototype.getExportData
    const declared = adapterType.adapterCapabilities.includes('exportData')
    if (implemented !== declared) {
      mismatches.push(
        `${adapterType.name}: implements=${implemented} declares=${declared}`,
      )
    }
  }
  expect(mismatches).toEqual([])
}, 60000)

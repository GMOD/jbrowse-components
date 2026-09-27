import PluginManager from '@jbrowse/core/PluginManager'
import { DERIVES_FROM_SEQUENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'

import GCContentAdapterF from './index.ts'

// Two genomes' GC tracks are routinely one config, `{ type: 'GCContentAdapter' }`;
// without the capability the adapter cache keys them as one instance and the
// first genome to prime it answers for both
test('GCContentAdapter declares that it derives from the sequence', () => {
  const pluginManager = new PluginManager()
  GCContentAdapterF(pluginManager)
  pluginManager.createPluggableElements()
  pluginManager.configure()
  expect(
    pluginManager.getAdapterType('GCContentAdapter').adapterCapabilities,
  ).toContain(DERIVES_FROM_SEQUENCE)
})

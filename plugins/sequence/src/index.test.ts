import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { READS_REFERENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { ReferenceScanAdapter } from './ReferenceScanAdapter.ts'
import ThisPlugin from './index.ts'

test('plugin in a stock JBrowse', () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const TwoBitAdapter = pluginManager.getAdapterType('TwoBitAdapter')
  const cfg = TwoBitAdapter.configSchema.create({ type: 'TwoBitAdapter' })
  expect(getSnapshot(cfg)).toMatchSnapshot()

  const FastaAdapter = pluginManager.getAdapterType('IndexedFastaAdapter')
  const cfg2 = FastaAdapter.configSchema.create({ type: 'IndexedFastaAdapter' })
  expect(getSnapshot(cfg2)).toMatchSnapshot()
})

// MotifListPanel names this adapter by string when it builds a track config, so
// a mismatch here would only surface as a broken track at runtime
test('MotifListAdapter registers under the name the search panel uses', () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const MotifListAdapter = pluginManager.getAdapterType('MotifListAdapter')
  const cfg = MotifListAdapter.configSchema.create({
    type: 'MotifListAdapter',
    motifs: 'EcoRI G^AATTC',
  })
  expect(readConfObject(cfg, 'motifs')).toBe('EcoRI G^AATTC')
})

// The capability is the adapter type's, not the class's, so a scan subclass
// registered without it would answer every genome from the first one's
// sequence. Found by class rather than listed, so a new scan cannot miss it.
test('every reference-scan adapter declares that it derives from the sequence', async () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const scans: string[] = []
  for (const type of pluginManager.getAdapterElements()) {
    const AdapterClass = await type.getAdapterClass()
    if (AdapterClass.prototype instanceof ReferenceScanAdapter) {
      scans.push(type.name)
      expect(type.adapterCapabilities).toContain(READS_REFERENCE)
    }
  }
  expect(scans.toSorted()).toEqual([
    'CrisprGuideAdapter',
    'MotifListAdapter',
    'SequenceSearchAdapter',
  ])
})

import BgzipFastaAdapterF from './BgzipFastaAdapter/index.ts'
import ChromSizesAdapterF from './ChromSizesAdapter/index.ts'
import IndexedFastaAdapterF from './IndexedFastaAdapter/index.ts'
import TwoBitAdapterF from './TwoBitAdapter/index.ts'
import UnindexedFastaAdapterF from './UnindexedFastaAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #api
 * Registers every adapter an assembly's `sequence` can name (indexed,
 * bgzipped and plain FASTA, 2bit, chrom.sizes) on a plugin manager that wants
 * them without the rest of the plugin's tracks and displays, as a headless
 * host does.
 */
export function registerSequenceAdapters(pluginManager: PluginManager) {
  TwoBitAdapterF(pluginManager)
  BgzipFastaAdapterF(pluginManager)
  ChromSizesAdapterF(pluginManager)
  IndexedFastaAdapterF(pluginManager)
  UnindexedFastaAdapterF(pluginManager)
}

import BgzipFastaAdapterF from './BgzipFastaAdapter/index.ts'
import IndexedFastaAdapterF from './IndexedFastaAdapter/index.ts'
import TwoBitAdapterF from './TwoBitAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #api
 * Registers the reference sequence adapters (indexed and bgzipped FASTA,
 * 2bit) on a plugin manager that wants them without the rest of the plugin's
 * tracks and displays, as a headless host does.
 */
export function registerSequenceAdapters(pluginManager: PluginManager) {
  IndexedFastaAdapterF(pluginManager)
  BgzipFastaAdapterF(pluginManager)
  TwoBitAdapterF(pluginManager)
}

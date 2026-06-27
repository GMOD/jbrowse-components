import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type { MafSamplesAdapter } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * Shared prologue for the alignment + summary RPCs: resolve the MAF adapter and
 * pull its sample set + guide tree. These ship with every region response so a
 * track opened already zoomed out (or never fetched detail) still has its row
 * order + tree without a separate setup RPC.
 */
export async function loadMafSamplesAdapter(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfig: AnyConfigurationModel,
) {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const adapter = dataAdapter as MafSamplesAdapter
  const { samples, treeNewick } = await adapter.getSamples()
  return { adapter, samples, treeNewick }
}

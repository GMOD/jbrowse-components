import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { MafAdapterBase } from './MafAdapterBase.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Shared prologue for the alignment + summary RPCs: resolve the MAF adapter and
 * pull its sample set + guide tree. These ship with every region response so a
 * track opened already zoomed out (or never fetched detail) still has its row
 * order + tree without a separate setup RPC.
 *
 * The class, not a structural cast. `MafSamplesAdapter` described the same
 * three members but was satisfiable by accident, and it had drifted out of step
 * with the class it described — `getSummaryFeatures` stayed optional there long
 * after `MafAdapterBase` started implementing it for all four. A cast also
 * turns a track whose `adapter` names something else entirely into
 * `getSamples is not a function`, which names the symptom and not the config.
 */
export async function loadMafSamplesAdapter(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfig: Record<string, unknown>,
) {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  if (!(dataAdapter instanceof MafAdapterBase)) {
    throw new Error(
      `${adapterConfig.type} is not a MAF adapter — a MafTrack needs one of BigMafAdapter, MafTabixAdapter, BgzipTaffyAdapter or BgzipMafAdapter`,
    )
  }
  const { samples, treeNewick } = await dataAdapter.getSamples()
  return { adapter: dataAdapter, samples, treeNewick }
}

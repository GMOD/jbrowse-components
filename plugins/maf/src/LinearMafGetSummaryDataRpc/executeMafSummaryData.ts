import { loadMafSamplesAdapter } from '../util/loadMafSamplesAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'

import type { BaseMafRpcArgs, MafSummaryRecord, Sample } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export type LinearMafGetSummaryDataArgs = BaseMafRpcArgs

export interface LinearMafGetSummaryDataResult {
  samples: Sample[]
  treeNewick: string | undefined
  records: MafSummaryRecord[]
}

/**
 * Fetch the per-species `bigMafSummary` rows for a single region — one row per
 * alignment block × species, carrying score + gap/break status but no
 * sequence. This is the cheap zoom-out path: the summary BigBed's bedToBigBed
 * zoom-level reduction makes wide reads small, where the full alignment fetch
 * would download every species' bases.
 *
 * Only BigMafAdapter ships a summary sub-adapter; when `getSummaryFeatures` is
 * absent (tabix/TAF adapters) the records come back empty and the display
 * falls back to the byte-estimate force-load gate.
 */
export async function executeMafSummaryData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: LinearMafGetSummaryDataArgs
}): Promise<LinearMafGetSummaryDataResult> {
  const { regions, adapterConfig, sessionId, stopToken } = args
  const region = regions[0]!
  const { adapter, samples, treeNewick } = await loadMafSamplesAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )

  const records: MafSummaryRecord[] = []
  const obs = adapter.getSummaryFeatures?.(region, { stopToken })
  if (obs) {
    await subscribeToObservable(obs, record => {
      records.push(record)
    })
  }
  return { samples, treeNewick, records }
}

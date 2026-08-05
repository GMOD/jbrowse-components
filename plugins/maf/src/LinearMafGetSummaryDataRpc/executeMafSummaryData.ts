import { loadMafSamplesAdapter } from '../util/loadMafSamplesAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'

import type { BaseMafRpcArgs, MafSummaryRecord, Sample } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export interface LinearMafGetSummaryDataArgs extends BaseMafRpcArgs {
  // The display's subtree filter, as a SET — same contract as the detail path's
  // arg of the same name. Records for species outside it are dropped here
  // rather than shipped and discarded by the client's `rowIndexBySrc` lookup.
  subtreeFilter?: string[]
}

export interface LinearMafGetSummaryDataResult {
  samples: Sample[]
  treeNewick: string | undefined
  /**
   * Whether `samples` is the authoritative row set (see the alignment RPC's
   * result). This path never discovers: samples are config/tree-derived, so an
   * empty list means a sample-discovery track, whose rows only the alignment
   * path can name. Reporting it as non-canonical keeps the client from
   * replacing its discovered rows with nothing on zoom-out.
   */
  samplesCanonical: boolean
  records: MafSummaryRecord[]
}

/**
 * Fetch the per-species `bigMafSummary` rows for a single region — one row per
 * alignment block × species, carrying score + gap/break status but no
 * sequence. This is the cheap zoom-out path: the summary BigBed's bedToBigBed
 * zoom-level reduction makes wide reads small, where the full alignment fetch
 * would download every species' bases.
 *
 * BigMafAdapter and MafTabixAdapter both take a `summaryAdapter` slot; when it
 * is unset — or on BgzipTaffyAdapter, which has no slot, since TAF's `.tai`
 * already makes a read O(visible span) rather than O(alignment) — the records
 * come back empty and the display falls back to the byte-estimate force-load
 * gate.
 */
export async function executeMafSummaryData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: LinearMafGetSummaryDataArgs
}): Promise<LinearMafGetSummaryDataResult> {
  const {
    regions,
    adapterConfig,
    sessionId,
    stopToken,
    statusCallback,
    subtreeFilter,
  } = args
  const region = regions[0]!
  const { adapter, samples, treeNewick } = await loadMafSamplesAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )

  // Rows outside the active subtree are dropped here rather than shipped and
  // hidden, exactly as the detail path does. `samples` stays the full set so
  // the sidebar tree and "clear filter" still see every genome.
  const visible = subtreeFilter?.length ? new Set(subtreeFilter) : undefined
  const records: MafSummaryRecord[] = []
  const obs = adapter.getSummaryFeatures?.(region, {
    stopToken,
    statusCallback,
  })
  if (obs) {
    await subscribeToObservable(obs, record => {
      if (!visible || visible.has(record.src)) {
        records.push(record)
      }
    })
  }
  return {
    samples,
    treeNewick,
    samplesCanonical: samples.length > 0,
    records,
  }
}

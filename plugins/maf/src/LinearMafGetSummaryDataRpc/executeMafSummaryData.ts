import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'

import { loadMafSamplesAdapter } from '../util/loadMafSamplesAdapter.ts'
import { loadMafSummaryAdapter } from '../util/loadMafSummaryAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'

import type { BaseMafRpcArgs, MafSummaryRecord, Sample } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

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
   * result). True only when the set came from config or the guide tree. On a
   * sample-discovery track this path names the genomes its own summary records
   * carry, which is a per-region set like the alignment path's — so it is
   * reported non-canonical and the client unions it into the rows it already
   * has rather than replacing them.
   */
  samplesCanonical: boolean
  records: MafSummaryRecord[]
  /**
   * What the summary sub-adapter's index quoted for this region. The summary
   * tier is cheap per base — no sequence — but a `BigBedAdapter` read is still
   * a whole-feature download, and this tier covers every zoom out to the whole
   * genome, so it is measured like the detail one.
   */
  bytes?: number
}

/**
 * Fetch the per-species `bigMafSummary` rows for a single region — one row per
 * alignment block × species, carrying score + gap/break status but no
 * sequence. This is the cheap zoom-out path: the summary BigBed's bedToBigBed
 * zoom-level reduction makes wide reads small, where the full alignment fetch
 * would download every species' bases.
 *
 * All four MAF adapters take a `summaryAdapter` slot; when it is unset the
 * records come back empty and the display falls back to the byte-estimate
 * force-load gate.
 */
export async function executeMafSummaryData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'LinearMafGetSummaryData'>
}) {
  const {
    regions,
    adapterConfig,
    sessionId,
    stopToken,
    statusCallback,
    subtreeFilter,
    byteLimit,
  } = args
  const region = regions[0]!
  const {
    adapter,
    samples: configSamples,
    treeNewick,
  } = await loadMafSamplesAdapter(pluginManager, sessionId, adapterConfig)
  const hasConfiguredSamples = configSamples.length > 0

  // The gate, on the file THIS tier reads — the `summaryAdapter` sub-adapter,
  // not the alignment. Measuring the alignment here would quote a download
  // nobody is doing, which at genome scale blocks the cheap tier on the
  // expensive one's cost. It is the same file `byteGateAdapterPath` names while
  // `showSummary` holds, so the banner and the worker agree by construction.
  const summaryAdapter =
    byteLimit === undefined ? undefined : await loadMafSummaryAdapter(adapter)
  const { bytes, tooLarge } = summaryAdapter
    ? await measureRegionBytes({
        dataAdapter: summaryAdapter,
        region,
        byteLimit,
        stopToken,
        statusCallback,
      })
    : { bytes: undefined, tooLarge: undefined }
  if (tooLarge) {
    return tooLarge
  }

  // Rows outside the active subtree are dropped here rather than shipped and
  // hidden, exactly as the detail path does. `samples` stays the full set so
  // the sidebar tree and "clear filter" still see every genome — so discovery
  // reads every record's `src`, before the filter, as the alignment path
  // discovers from every block row before narrowing `blocks`.
  const visible = subtreeFilter?.length ? new Set(subtreeFilter) : undefined
  const records: MafSummaryRecord[] = []
  // Insertion-ordered, so a discovered row set has a stable order the way the
  // alignment path's `discoveredOrder` does.
  const discovered = new Set<string>()
  const obs = adapter.getSummaryFeatures?.(region, {
    stopToken,
    statusCallback,
  })
  if (obs) {
    await subscribeToObservable(obs, record => {
      if (!hasConfiguredSamples) {
        discovered.add(record.src)
      }
      if (!visible || visible.has(record.src)) {
        records.push(record)
      }
    })
  }
  return {
    // A sample-discovery track (no `samples`, no `nhLocation`) has no row set
    // until something names one, and only the alignment path used to. A track
    // opened already zoomed out past the summary threshold therefore resolved
    // zero sources, so `rowIndexBySrc` matched no `src` and the summary overlay
    // drew nothing at all — a blank, fully-"loaded" track until the user zoomed
    // in far enough to fetch detail. The records name their species, so this
    // path can answer for itself.
    samples: hasConfiguredSamples
      ? configSamples
      : [...discovered].map(id => ({ id, label: id })),
    treeNewick,
    samplesCanonical: hasConfiguredSamples,
    records,
    bytes,
  }
}

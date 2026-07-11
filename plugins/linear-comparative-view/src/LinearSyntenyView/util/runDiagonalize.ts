import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  getAdapterToCanonicalRefNameMap,
  renameRegionsForAdapter,
} from '@jbrowse/synteny-core'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearSyntenyViewModel } from '../model.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

type Level = LinearSyntenyViewModel['levels'][number]

export interface RunDiagonalizeResult {
  totalReordered: number
  totalReversed: number
}

export interface RunDiagonalizeOpts {
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

// Runs the DiagonalizeSynteny RPC (one call per level — the worker fetches the
// alignments and runs the algorithm off the main thread, mirroring the dotplot
// path) and applies the resulting region reorderings/reversals.
// Shared by the menu dialog (UI wrapper) and the init autorun (autoDiagonalize
// flag).
//
// Levels run top-down and each result is applied before the next level, so a
// stacked N-way view cascades the diagonal down the whole stack: the worker
// orders each query chromosome by its best-hit's *index* in referenceRegions,
// so level i+1 must diagonalize against the row that level i just reordered —
// not its original order. Running the levels concurrently would race on that
// shared middle row and leave the lower band undiagonalized (a single downward
// Sugiyama layer-sweep, focus row pinned at the top).
export async function runDiagonalize(
  model: LinearSyntenyViewModel,
  opts: RunDiagonalizeOpts = {},
): Promise<RunDiagonalizeResult | undefined> {
  if (model.views.length < 2) {
    return undefined
  }
  const { assemblyManager, rpcManager } = getSession(model)
  let totalReversed = 0
  let totalReordered = 0
  for (let i = 0; i < model.levels.length; i++) {
    const level: Level = model.levels[i]
    const displays = level.linearSyntenyDisplays
    if (displays.length > 0) {
      // Route to the same rpcSessionId the track renders with (it lives on the
      // track) so the call lands on that track's sticky worker and hits the
      // already-parsed adapter instead of re-parsing into a fresh cache.
      const sessionId = getRpcSessionId(displays[0])
      // referenceRegions/currentRegions stay canonical; the worker matches
      // against them and reorders currentRegions back into the view. Each
      // adapter may use its own refName namespace, so refName reconciliation is
      // resolved per-adapter here on the main thread (the worker has no
      // assemblyManager): the reference regions are renamed for the fetch, and
      // per-axis adapter->canonical maps let the worker translate fetched
      // alignments back to canonical.
      const referenceRegions = model.views[i]!.displayedRegions
      const currentRegions = model.views[i + 1]!.displayedRegions
      // The assembly being reordered (the query axis / row below). A
      // multi-genome adapter (MCScanBlocksAdapter, AllVsAllPAFAdapter) draws N-1
      // pairs from one track, so the fetch must name which pair this level is —
      // otherwise the adapter defaults the mate to the first other assembly and
      // fetches the wrong band's alignments (whose query refNames match no
      // currentRegions, leaving this row un-reordered). Mirrors the render
      // path's `targetAssemblyName: v2.displayedRegions[0]?.assemblyName`.
      const targetAssemblyName = currentRegions[0]?.assemblyName
      const adapters = await Promise.all(
        displays.map(async (d: LinearSyntenyDisplayModel) => {
          const { adapterConfig } = d
          const [fetchRegions, refRefNameMap, queryRefNameMap] =
            await Promise.all([
              renameRegionsForAdapter({
                assemblyManager,
                sessionId,
                adapterConfig,
                regions: referenceRegions,
              }),
              getAdapterToCanonicalRefNameMap({
                assemblyManager,
                sessionId,
                adapterConfig,
                regions: referenceRegions,
              }),
              getAdapterToCanonicalRefNameMap({
                assemblyManager,
                sessionId,
                adapterConfig,
                regions: currentRegions,
              }),
            ])
          return { adapterConfig, fetchRegions, refRefNameMap, queryRefNameMap }
        }),
      )
      const result = await rpcManager.call(sessionId, 'DiagonalizeSynteny', {
        adapters,
        referenceRegions,
        currentRegions,
        targetAssemblyName,
        bpPerPx: model.views[i]!.bpPerPx,
        stopToken: opts.stopToken,
        statusCallback: opts.statusCallback,
      })
      if (result) {
        model.views[i + 1]!.setDisplayedRegions(result.newRegions)
        totalReversed += result.stats.regionsReversed
        totalReordered += result.stats.regionsReordered
      }
    }
  }
  return { totalReordered, totalReversed }
}

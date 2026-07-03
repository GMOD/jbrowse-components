import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  getAdapterToCanonicalRefNameMap,
  renameRegionsForAdapter,
} from '@jbrowse/synteny-core'
import { transaction } from 'mobx'

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

// Runs the DiagonalizeSynteny RPC (one entry per level — the worker fetches the
// alignments and runs the algorithm off the main thread, mirroring the dotplot
// path) and applies the resulting region reorderings/reversals atomically.
// Shared by the menu dialog (UI wrapper) and the init autorun (autoDiagonalize
// flag).
export async function runDiagonalize(
  model: LinearSyntenyViewModel,
  opts: RunDiagonalizeOpts = {},
): Promise<RunDiagonalizeResult | undefined> {
  if (model.views.length < 2) {
    return undefined
  }
  // One RPC call per level, each routed to the same rpcSessionId its track
  // renders with (rpcSessionId lives on the track), so it lands on that track's
  // sticky worker and hits the already-set-up (parsed) adapter instead of
  // re-parsing into a fresh adapter cache. Results align to `levels`; a level
  // returns null when it has nothing to reorder (no displays / no alignments).
  const { assemblyManager, rpcManager } = getSession(model)
  const results = await Promise.all(
    model.levels.map(async (level: Level, i: number) => {
      const displays = level.linearSyntenyDisplays
      if (displays.length === 0) {
        return null
      }
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
      return rpcManager.call(sessionId, 'DiagonalizeSynteny', {
        adapters,
        referenceRegions,
        currentRegions,
        bpPerPx: model.views[i]!.bpPerPx,
        stopToken: opts.stopToken,
        statusCallback: opts.statusCallback,
      })
    }),
  )

  let totalReversed = 0
  let totalReordered = 0
  transaction(() => {
    results.forEach((result, i) => {
      if (result) {
        model.views[i + 1]!.setDisplayedRegions(result.newRegions)
        totalReversed += result.stats.regionsReversed
        totalReordered += result.stats.regionsReordered
      }
    })
  })
  return { totalReordered, totalReversed }
}

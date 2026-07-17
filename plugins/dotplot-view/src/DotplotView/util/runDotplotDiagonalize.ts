import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { prepareDiagonalizeAdapter } from '@jbrowse/synteny-core'

import type { DotplotViewModel } from '../model.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface RunDotplotDiagonalizeResult {
  totalReordered: number
  totalReversed: number
}

export interface RunDotplotDiagonalizeOpts {
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

// Wraps the DiagonalizeDotplot RPC + region apply step in a shape both the
// menu dialog and the init autorun can call. Caller is responsible for
// gating the canvas / loading UI; this just runs.
export async function runDotplotDiagonalize(
  model: DotplotViewModel,
  opts: RunDotplotDiagonalizeOpts = {},
): Promise<RunDotplotDiagonalizeResult | undefined> {
  const display = model.tracks[0]?.displays[0]
  if (display) {
    // Reuse the same rpcSessionId the display renders with (it lives on the
    // track), so this lands on the same sticky worker and hits its
    // already-parsed adapter instead of re-parsing the file into a fresh cache.
    const sessionId = getRpcSessionId(display)
    const { adapterConfig } = display
    const { assemblyManager, rpcManager } = getSession(model)

    // Both axes stay canonical: the worker matches against them and reorders
    // currentRegions back into the view. RefName reconciliation (the renamed
    // fetch regions + the per-axis adapter->canonical maps) is resolved here on
    // the main thread, since the worker has no assemblyManager.
    const referenceRegions = model.hview.displayedRegions
    const currentRegions = model.vview.displayedRegions
    const adapter = await prepareDiagonalizeAdapter({
      assemblyManager,
      sessionId,
      adapterConfig,
      referenceRegions,
      currentRegions,
    })
    const result = await rpcManager.call(sessionId, 'DiagonalizeDotplot', {
      adapters: [adapter],
      referenceRegions,
      currentRegions,
      stopToken: opts.stopToken,
      statusCallback: opts.statusCallback,
    })
    if (result) {
      model.vview.setDisplayedRegions(result.newRegions)
      return {
        totalReordered: result.stats.regionsReordered,
        totalReversed: result.stats.regionsReversed,
      }
    }
  }
  return undefined
}

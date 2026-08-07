import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { prepareDiagonalizeAdapter } from '@jbrowse/synteny-core'

import type { DotplotViewModel } from '../model.ts'
import type {
  DiagonalizeRunOpts,
  DiagonalizeStats,
} from '@jbrowse/synteny-core'

// Wraps the DiagonalizeDotplot RPC + region apply step in a shape both the
// menu dialog and the init autorun can call. Caller is responsible for
// gating the canvas / loading UI; this just runs.
export async function runDotplotDiagonalize(
  model: DotplotViewModel,
  opts: DiagonalizeRunOpts = {},
): Promise<DiagonalizeStats | undefined> {
  // Every dotplot display, not `tracks[0].displays[0]`. Two reasons, and the
  // reorder is silently wrong rather than broken under both: a plot can show
  // several synteny tracks at once (the import form says so), and an ordering
  // computed from one of them ignores the alignments the others contribute —
  // the shared RPC takes an adapter list for exactly this, which is what the
  // synteny level passes. `displays[0]` is also whatever a hand-written or
  // legacy session snapshot happened to list first, which need not be the
  // DotplotDisplay, or anything at all; `dotplotDisplays` is the type-filtered
  // list the rest of the view already reads.
  const displays = model.dotplotDisplays
  const first = displays[0]
  if (first) {
    // Reuse the same rpcSessionId the displays render with (it lives on the
    // track), so this lands on the same sticky worker and hits its
    // already-parsed adapter instead of re-parsing the file into a fresh cache.
    const sessionId = getRpcSessionId(first)
    const { assemblyManager, rpcManager } = getSession(model)

    // Both axes stay canonical: the worker matches against them and reorders
    // currentRegions back into the view. RefName reconciliation (the renamed
    // fetch regions + the per-axis adapter->canonical maps) is resolved here on
    // the main thread, since the worker has no assemblyManager — and per
    // adapter, since each has its own refName namespace.
    const referenceRegions = model.hview.displayedRegions
    const currentRegions = model.vview.displayedRegions
    const adapters = await Promise.all(
      displays.map(d =>
        prepareDiagonalizeAdapter({
          assemblyManager,
          sessionId,
          adapterConfig: d.adapterConfig,
          referenceRegions,
          currentRegions,
        }),
      ),
    )
    const result = await rpcManager.call(sessionId, 'DiagonalizeDotplot', {
      adapters,
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

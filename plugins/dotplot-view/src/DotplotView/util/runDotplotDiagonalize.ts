import { getSession } from '@jbrowse/core/util'
import { prepareDiagonalizeAdapters } from '@jbrowse/synteny-core'

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
  // Every dotplot display: a plot can overlay several synteny tracks, and an
  // ordering computed from one ignores the alignments the others contribute
  const [first, ...rest] = model.dotplotDisplays
  if (first) {
    const { assemblyManager, rpcManager } = getSession(model)
    const referenceRegions = model.hview.displayedRegions
    const currentRegions = model.vview.displayedRegions
    const { sessionId, adapters } = await prepareDiagonalizeAdapters({
      assemblyManager,
      displays: [first, ...rest],
      referenceRegions,
      currentRegions,
    })
    const result = await rpcManager.call(sessionId, 'DiagonalizeDotplot', {
      adapters,
      referenceRegions,
      currentRegions,
      signal: opts.signal,
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

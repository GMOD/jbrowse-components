import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { prepareDiagonalizeAdapter } from '@jbrowse/synteny-core'

import { mirrorRegionsForCircle } from './mirrorRegions.ts'

import type { CircularViewModel } from '../model.ts'
import type {
  DiagonalizeRunOpts,
  DiagonalizeStats,
} from '@jbrowse/synteny-core'

/**
 * Reorder the second genome's chromosomes so the ribbons between the two arcs
 * read as a band, in the shape both the menu dialog and the init autorun can
 * call. The caller gates the figure and the loading UI; this just runs.
 *
 * The reorder is the one a synteny row and a dotplot run. What the circle adds
 * is the mirror, applied on the way out and undone on the way in — which is also
 * what makes the pass idempotent. ADR-121.
 */
export async function runCircularDiagonalize(
  model: CircularViewModel,
  opts: DiagonalizeRunOpts = {},
): Promise<DiagonalizeStats | undefined> {
  const displays = model.chordSyntenyDisplays
  const first = displays[0]
  const [referenceAssembly, currentAssembly] = model.assemblyNames
  // Exactly two genomes, which is what a mirror is defined for — see
  // `canDiagonalize`.
  if (!first || model.assemblyNames.length !== 2 || !currentAssembly) {
    return undefined
  }
  // the same rpcSessionId the ribbons fetch with, so this lands on that worker
  // and hits its already-parsed adapter
  const sessionId = getRpcSessionId(first)
  const { assemblyManager, rpcManager } = getSession(model)
  const referenceRegions = model.displayedRegions.filter(
    r => r.assemblyName === referenceAssembly,
  )
  const currentRegions = mirrorRegionsForCircle(
    model.displayedRegions.filter(r => r.assemblyName === currentAssembly),
  )
  // Every ribbon display, for the reason the dotplot's runner gives. RefName
  // reconciliation resolves here, per adapter: the worker has no assemblyManager
  // and each adapter has its own namespace.
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
  const result = await rpcManager.call(sessionId, 'DiagonalizeCircular', {
    adapters,
    referenceRegions,
    currentRegions,
    stopToken: opts.stopToken,
    statusCallback: opts.statusCallback,
  })
  if (!result) {
    return undefined
  }
  model.setDisplayedRegions([
    ...referenceRegions,
    ...mirrorRegionsForCircle(result.newRegions),
  ])
  return {
    totalReordered: result.stats.regionsReordered,
    totalReversed: result.stats.regionsReversed,
  }
}

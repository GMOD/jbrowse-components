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
 * read as a band rather than a hairball, in the shape both the menu dialog and
 * the init autorun can call. The caller gates the figure and the loading UI;
 * this just runs.
 *
 * The circle's own contribution is the mirror. Everything else is the reorder a
 * synteny row and a dotplot run: the second assembly's regions go into
 * `diagonalizeRegions` as the axis being ordered and the first assembly's as the
 * reference. The regions on the circle are mirrored BACK into linear order on the
 * way in and the answer mirrored forward on the way out, which is also what
 * makes the pass idempotent — re-running an already-diagonalized circle reports
 * that it moved nothing.
 *
 * Every ribbon display, not `tracks[0].displays[0]`: a circle can carry several
 * synteny tracks over the one pair of genomes, and an order computed from one of
 * them ignores the alignments the others contribute. The shared RPC takes an
 * adapter list for exactly that.
 */
export async function runCircularDiagonalize(
  model: CircularViewModel,
  opts: DiagonalizeRunOpts = {},
): Promise<DiagonalizeStats | undefined> {
  const displays = model.chordSyntenyDisplays
  const first = displays[0]
  const [referenceAssembly, currentAssembly] = model.assemblyNames
  // Exactly two genomes, which is what a mirror is defined for. One is a
  // self-alignment, where there is no second arc to reorder; three or more have
  // no layout in which every pair reads as a band, so the circle says nothing
  // rather than picking one pair's answer and calling it the figure.
  if (!first || model.assemblyNames.length !== 2 || !currentAssembly) {
    return undefined
  }
  // the same rpcSessionId the ribbons fetch with (it lives on the track), so
  // this lands on that worker and hits its already-parsed adapter
  const sessionId = getRpcSessionId(first)
  const { assemblyManager, rpcManager } = getSession(model)
  const referenceRegions = model.displayedRegions.filter(
    r => r.assemblyName === referenceAssembly,
  )
  const currentRegions = mirrorRegionsForCircle(
    model.displayedRegions.filter(r => r.assemblyName === currentAssembly),
  )
  // RefName reconciliation is resolved here on the main thread, since the worker
  // has no assemblyManager — and per adapter, since each has its own namespace
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

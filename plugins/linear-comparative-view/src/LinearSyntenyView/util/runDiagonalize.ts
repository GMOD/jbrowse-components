import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { prepareDiagonalizeAdapter } from '@jbrowse/synteny-core'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type {
  DiagonalizeRunOpts,
  DiagonalizeStats,
} from '@jbrowse/synteny-core'

// Levels run one after another, each restarting the RPC's phase labels from
// "Fetching features". On a stacked N-way view that reads as a bar looping
// forever, so each level's messages say which level they belong to. A single
// level (the ordinary two-row view) is left unprefixed.
function levelStatusCallback(
  statusCallback: StatusCallback | undefined,
  level: number,
  levelCount: number,
): StatusCallback | undefined {
  if (statusCallback === undefined || levelCount < 2) {
    return statusCallback
  }
  const prefix = `Level ${level + 1}/${levelCount}: `
  return status => {
    // `''` is the phase-over sentinel, not a label, so it goes through
    // unprefixed — a retire that carries the failed flag as well as the sentinel
    // included. Prefixed it becomes `"Level 1/3: "` — a status every consumer
    // reads as a phase still running, which left the reordering spinner showing
    // a bare level number between one level's last phase and the next level's
    // first.
    if (typeof status === 'string') {
      statusCallback(status === '' ? status : `${prefix}${status}`)
    } else if (status.message === '') {
      statusCallback(status)
    } else {
      statusCallback({ ...status, message: `${prefix}${status.message}` })
    }
  }
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
  opts: DiagonalizeRunOpts = {},
): Promise<DiagonalizeStats | undefined> {
  if (model.views.length < 2) {
    return undefined
  }
  const { assemblyManager, rpcManager } = getSession(model)
  let totalReversed = 0
  let totalReordered = 0
  for (let i = 0; i < model.levels.length; i++) {
    const level = model.levels[i]!
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
      const result = await rpcManager.call(sessionId, 'DiagonalizeSynteny', {
        adapters,
        referenceRegions,
        currentRegions,
        bpPerPx: model.views[i]!.bpPerPx,
        stopToken: opts.stopToken,
        statusCallback: levelStatusCallback(
          opts.statusCallback,
          i,
          model.levels.length,
        ),
      })
      if (result) {
        model.views[i + 1]!.setDisplayedRegions(result.newRegions)
        totalReversed += result.stats.regionsReversed
        totalReordered += result.stats.regionsReordered
        // committed, not merely computed: the next level diagonalizes against
        // the row this one just reordered, so anything reported here survives
        // a stop on a later level
        opts.onProgress?.({ totalReordered, totalReversed })
      }
    }
  }
  return { totalReordered, totalReversed }
}

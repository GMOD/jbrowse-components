import { getSession } from '@jbrowse/core/util'
import { prepareDiagonalizeAdapters } from '@jbrowse/synteny-core'

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
// Levels run OUTWARD FROM THE ANCHOR ROW and each result is applied before the
// next, so a stacked N-way view cascades the diagonal away from the one row
// whose order is left alone: the worker orders each query chromosome by its
// best-hit's *index* in referenceRegions, so a level must diagonalize against
// the row the previous level just reordered — not its original order. Running
// the levels concurrently would race on that shared middle row and leave the
// far band undiagonalized (a Sugiyama layer-sweep, focus row pinned at the
// anchor).
//
// The pair is symmetric, so a row above the anchor is ordered by handing the
// RPC the row BELOW it as the reference: same level, same adapters, the two
// axes the other way round.
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
  const anchor = Math.min(
    Math.max(opts.anchorRow ?? 0, 0),
    model.views.length - 1,
  )
  // levels below the anchor, top-down; then levels above it, bottom-up
  const levelIndices = model.levels.map((_, i) => i)
  const order = [
    ...levelIndices.slice(anchor),
    ...levelIndices.slice(0, anchor).reverse(),
  ]
  for (const i of order) {
    const downward = i >= anchor
    const level = model.levels[i]!
    const [first, ...rest] = level.linearSyntenyDisplays
    if (first) {
      const referenceIndex = downward ? i : i + 1
      const currentIndex = downward ? i + 1 : i
      const referenceRegions = model.views[referenceIndex]!.displayedRegions
      const currentRegions = model.views[currentIndex]!.displayedRegions
      const { sessionId, adapters } = await prepareDiagonalizeAdapters({
        assemblyManager,
        displays: [first, ...rest],
        referenceRegions,
        currentRegions,
      })
      const result = await rpcManager.call(sessionId, 'DiagonalizeSynteny', {
        adapters,
        referenceRegions,
        currentRegions,
        bpPerPx: model.views[referenceIndex]!.bpPerPx,
        signal: opts.signal,
        statusCallback: levelStatusCallback(
          opts.statusCallback,
          i,
          model.levels.length,
        ),
      })
      if (result) {
        model.views[currentIndex]!.setDisplayedRegions(result.newRegions)
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

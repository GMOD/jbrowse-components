import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { transaction } from 'mobx'

import type { DiagonalizeSyntenyArgs } from '../../DiagonalizeSyntenyRpc.ts'
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

// Whether every synteny display across every level has either populated
// its featureData or surfaced an error. Used by the init autoDiagonalize
// gate to wait for the first RPC round-trip without deadlocking on stuck
// or minimized displays (the caller pairs this with a wall-clock timeout).
// for-of (not .every) because mobx-state-tree's observable arrays widen
// the .every callback parameter to `any`.
export function displaysReady(model: LinearSyntenyViewModel): boolean {
  for (const level of model.levels) {
    for (const track of level.tracks) {
      for (const display of track.displays) {
        const d = display as { featureData?: unknown; error?: unknown }
        if (!d.featureData && !d.error) {
          return false
        }
      }
    }
  }
  return true
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
  const results = await Promise.all(
    model.levels.map((level: Level, i: number) => {
      const displays = level.linearSyntenyDisplays
      if (displays.length === 0) {
        return Promise.resolve(null)
      }
      const sessionId = getRpcSessionId(displays[0])
      return getSession(model).rpcManager.call(
        sessionId,
        'DiagonalizeSynteny',
        {
          sessionId,
          adapterConfigs: displays.map(
            (d: LinearSyntenyDisplayModel) => d.adapterConfig,
          ),
          referenceRegions: model.views[i]!.displayedRegions,
          currentRegions: model.views[i + 1]!.displayedRegions,
          bpPerPx: model.views[i]!.bpPerPx,
          stopToken: opts.stopToken,
          statusCallback: opts.statusCallback,
        } satisfies DiagonalizeSyntenyArgs,
      )
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

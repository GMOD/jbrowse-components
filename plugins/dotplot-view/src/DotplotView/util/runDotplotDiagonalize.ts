import { getSession } from '@jbrowse/core/util'
import { transaction } from 'mobx'

import type { DiagonalizeDotplotArgs } from '../../DiagonalizeDotplotRpc.ts'
import type { DotplotViewModel } from '../model.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface RunDotplotDiagonalizeResult {
  totalReordered: number
  totalReversed: number
}

export interface RunDotplotDiagonalizeOpts {
  stopToken?: StopToken
  statusCallback?: (message: string) => void
}

// Wraps the DiagonalizeDotplot RPC + region apply step in a shape both the
// menu dialog and the init autorun can call. Caller is responsible for
// gating the canvas / loading UI; this just runs.
export async function runDotplotDiagonalize(
  model: DotplotViewModel,
  opts: RunDotplotDiagonalizeOpts = {},
): Promise<RunDotplotDiagonalizeResult | undefined> {
  const track = model.tracks[0]
  if (!track) {
    return undefined
  }
  const display = track.displays[0]
  if (!display) {
    return undefined
  }
  const session = getSession(model)
  const result = await session.rpcManager.call(model.id, 'DiagonalizeDotplot', {
    sessionId: `diagonalize-${Date.now()}`,
    view: { hview: model.hview, vview: model.vview },
    adapterConfig: display.adapterConfig,
    stopToken: opts.stopToken,
    statusCallback: opts.statusCallback,
  } satisfies DiagonalizeDotplotArgs)
  if (result.newRegions.length === 0) {
    return undefined
  }
  transaction(() => {
    model.vview.setDisplayedRegions(result.newRegions)
  })
  return {
    totalReordered: result.stats.regionsReordered,
    totalReversed: result.stats.regionsReversed,
  }
}

// Whether the first display on the first track has produced its first
// rpcData payload (or has surfaced an error). The init autorun pairs this
// with a wall-clock race so a stuck display can't deadlock startup.
export function dotplotDisplaysReady(model: DotplotViewModel): boolean {
  for (const track of model.tracks) {
    for (const display of track.displays) {
      const d = display as { rpcData?: unknown; error?: unknown }
      if (!d.rpcData && !d.error) {
        return false
      }
    }
  }
  return true
}

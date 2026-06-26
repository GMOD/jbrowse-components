import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { transaction } from 'mobx'

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
  const track = model.tracks[0]
  if (!track) {
    return undefined
  }
  const display = track.displays[0]
  if (!display) {
    return undefined
  }
  // Reuse the same rpcSessionId the display renders with (it lives on the
  // track), so this lands on the same sticky worker and hits its already-set-up
  // (parsed) adapter instead of re-parsing the file into a fresh adapter cache.
  const sessionId = getRpcSessionId(display)
  const result = await getSession(model).rpcManager.call(
    sessionId,
    'DiagonalizeDotplot',
    {
      view: { hview: model.hview, vview: model.vview },
      adapterConfig: display.adapterConfig,
      stopToken: opts.stopToken,
      statusCallback: opts.statusCallback,
    },
  )
  transaction(() => {
    model.vview.setDisplayedRegions(result.newRegions)
  })
  return {
    totalReordered: result.stats.regionsReordered,
    totalReversed: result.stats.regionsReversed,
  }
}

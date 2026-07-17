import { DiagonalizeRpcBase } from '@jbrowse/synteny-core'

import type { DiagonalizationResult } from '@jbrowse/core/util/diagonalizeRegions'
import type { DiagonalizeArgs } from '@jbrowse/synteny-core'

// One synteny level (the gap between two adjacent views): the alignment
// adapters drawn there, the region set of the reference view (above), and the
// region set of the view being reordered (below). Called once per level so each
// routes to the same worker its track renders on (rpcSessionId is per-track),
// reusing that worker's already-parsed adapters.
export type DiagonalizeSyntenyArgs = DiagonalizeArgs

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    DiagonalizeSynteny: {
      args: DiagonalizeSyntenyArgs
      // null when the level has no alignments to reorder
      return: DiagonalizationResult | null
    }
  }
}

// Body lives in @jbrowse/synteny-core's executeDiagonalize, shared with
// DiagonalizeDotplot — a dotplot is the single-adapter case of a level.
export default class DiagonalizeSyntenyRpc extends DiagonalizeRpcBase {
  name = 'DiagonalizeSynteny'
}

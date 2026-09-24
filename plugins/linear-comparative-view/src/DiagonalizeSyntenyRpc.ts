import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { runDiagonalize } from '@jbrowse/synteny-core'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { DiagonalizationResult } from '@jbrowse/core/util/diagonalizeRegions'
import type { DiagonalizeArgs } from '@jbrowse/synteny-core'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    // one level: the reference view's regions (above) and the reordered view's
    // (below), called per level so each lands on its track's worker
    DiagonalizeSynteny: {
      args: DiagonalizeArgs
      // null when the level has no alignments to reorder
      return: DiagonalizationResult | null
    }
  }
}

// Body lives in @jbrowse/synteny-core's runDiagonalize, shared with
// DiagonalizeDotplot — a dotplot is the single-adapter case of a level. That
// function's comment says why the two are separate methods rather than a shared
// base class.
export default class DiagonalizeSyntenyRpc extends RpcMethodType<'DiagonalizeSynteny'> {
  name = 'DiagonalizeSynteny' as const

  async execute(args: RpcExecuteArgs<'DiagonalizeSynteny'>) {
    return runDiagonalize(this.pluginManager, args)
  }
}

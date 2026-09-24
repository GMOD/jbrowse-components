import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { runDiagonalize } from '@jbrowse/synteny-core'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { DiagonalizationResult } from '@jbrowse/core/util/diagonalizeRegions'
import type { DiagonalizeArgs } from '@jbrowse/synteny-core'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    // `referenceRegions` is the horizontal axis, which supplies the ordering;
    // `currentRegions` the vertical axis, which gets reordered
    DiagonalizeDotplot: {
      args: DiagonalizeArgs
      // null when there are no alignments to reorder
      return: DiagonalizationResult | null
    }
  }
}

// Body lives in @jbrowse/synteny-core's runDiagonalize, shared with
// DiagonalizeSynteny. Registered separately because an RPC method is only
// callable if the plugin registering it is loaded, dotplot-view can be
// installed without linear-comparative-view, and a name registers once.
export default class DiagonalizeDotplotRpc extends RpcMethodType<'DiagonalizeDotplot'> {
  name = 'DiagonalizeDotplot' as const

  async execute(args: RpcExecuteArgs<'DiagonalizeDotplot'>) {
    return runDiagonalize(this.pluginManager, args)
  }
}

import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { runDiagonalize } from '@jbrowse/synteny-core'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { DiagonalizationResult } from '@jbrowse/core/util/diagonalizeRegions'
import type { DiagonalizeArgs } from '@jbrowse/synteny-core'

// The two genomes on a circle: `referenceRegions` is the first assembly's arc
// (which supplies the ordering), `currentRegions` the second's (which gets
// reordered). Both canonical, and both in LINEAR order — the circle mirrors the
// second genome on the way in and on the way out, so the algorithm sees the same
// question a synteny row asks. See `runCircularDiagonalize`.
export type DiagonalizeCircularArgs = DiagonalizeArgs

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    DiagonalizeCircular: {
      args: DiagonalizeCircularArgs
      // null when the pair has no alignments to reorder
      return: DiagonalizationResult | null
    }
  }
}

// Body lives in @jbrowse/synteny-core's runDiagonalize, shared with
// DiagonalizeSynteny and DiagonalizeDotplot. Registered separately because an
// RPC method is only callable if the plugin registering it is loaded, and
// circular-view ships in products that carry neither of the other two.
export default class DiagonalizeCircularRpc extends RpcMethodType<'DiagonalizeCircular'> {
  name = 'DiagonalizeCircular' as const

  async execute(args: RpcExecuteArgs<'DiagonalizeCircular'>) {
    return runDiagonalize(this.pluginManager, args)
  }
}

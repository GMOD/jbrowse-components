import { DiagonalizeRpcBase } from '@jbrowse/synteny-core'

import type { DiagonalizationResult } from '@jbrowse/core/util/diagonalizeRegions'
import type { DiagonalizeArgs } from '@jbrowse/synteny-core'

// A dotplot's two axes: `referenceRegions` is the horizontal axis (which
// supplies the ordering), `currentRegions` the vertical axis (which gets
// reordered). Both canonical; the worker translates fetched alignments back via
// each adapter spec's refName maps.
export type DiagonalizeDotplotArgs = DiagonalizeArgs

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    DiagonalizeDotplot: {
      args: DiagonalizeDotplotArgs
      // null when there are no alignments to reorder
      return: DiagonalizationResult | null
    }
  }
}

// Body lives in @jbrowse/synteny-core's executeDiagonalize, shared with
// DiagonalizeSynteny. Registered separately because an RPC method is only
// callable if the plugin registering it is loaded, and dotplot-view can be
// installed without linear-comparative-view.
export default class DiagonalizeDotplotRpc extends DiagonalizeRpcBase {
  name = 'DiagonalizeDotplot'
}

export { type DiagonalizationResult } from '@jbrowse/core/util/diagonalizeRegions'

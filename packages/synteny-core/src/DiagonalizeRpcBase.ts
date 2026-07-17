import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { executeDiagonalize } from './executeDiagonalize.ts'

import type { DiagonalizeArgs } from './executeDiagonalize.ts'

/**
 * Worker-side diagonalize RPC, minus its name. The linear-synteny and dotplot
 * views each register their own method (an RPC method is only callable if the
 * plugin that registers it is loaded, and either view can be installed without
 * the other), but the body is identical — so subclass this and set `name`
 * rather than copying the implementation:
 *
 * ```ts
 * export default class DiagonalizeDotplotRpc extends DiagonalizeRpcBase {
 *   name = 'DiagonalizeDotplot'
 * }
 * ```
 *
 * Declare the method's args/return in the RpcRegistry from the plugin, so the
 * registry entry lives next to the registration.
 */
export default abstract class DiagonalizeRpcBase extends RpcMethodTypeWithFiltersAndRenameRegions {
  async execute(args: DiagonalizeArgs, rpcDriverClassName: string) {
    return executeDiagonalize(
      this.pluginManager,
      await this.deserializeArguments(args, rpcDriverClassName),
    )
  }
}

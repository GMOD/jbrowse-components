import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

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
 *
 * Extends the plain RpcMethodType rather than
 * RpcMethodTypeWithFiltersAndRenameRegions, which is what a comparative RPC
 * normally reaches for. These args carry no `filters`, and no top-level
 * `regions` either — a diagonalize call renames per adapter on the main thread
 * (see prepareDiagonalizeAdapter), because each of a level's adapters has its
 * own refName namespace and one shared `regions` key cannot express that. The
 * rename base class only ever renames a top-level `regions` array, so for these
 * args its work was a no-op, while its `serializeArguments` type demanded a
 * top-level `adapterConfig` that per-adapter args have no place to put. The
 * pieces that do matter -- location/blob augmentation on the wire and blobMap
 * rehydration in the worker, which is what lets a local-file track diagonalize
 * -- live in RpcMethodType itself and are inherited here. Location handling
 * walks the whole args tree, so each `adapters[].adapterConfig` is still
 * augmented at its nested position.
 */
export default abstract class DiagonalizeRpcBase extends RpcMethodType {
  async execute(args: DiagonalizeArgs, rpcDriverClassName: string) {
    return executeDiagonalize(
      this.pluginManager,
      await this.deserializeArguments(args, rpcDriverClassName),
    )
  }
}

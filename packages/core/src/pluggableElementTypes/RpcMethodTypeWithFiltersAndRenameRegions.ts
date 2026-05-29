import RpcMethodType from './RpcMethodType.ts'
import { renameRegionsIfNeeded } from '../util/index.ts'
import SerializableFilterChain from './renderers/util/serializableFilterChain.ts'

import type { StopToken } from '../util/stopToken.ts'
import type { SerializedFilterChain } from './renderers/util/serializableFilterChain.ts'
import type { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'

export default abstract class RpcMethodTypeWithFiltersAndRenameRegions extends RpcMethodType {
  async deserializeArguments<T>(
    // filters is `unknown` rather than SerializedFilterChain: callers' T types
    // it as the deserialized SerializableFilterChain, so a string[] intersection
    // would collapse to `never` and reject every call
    args: T & { filters?: unknown },
    rpcDriverClassName: string,
  ): Promise<T> {
    const l = await super.deserializeArguments(args, rpcDriverClassName)
    return {
      ...l,
      // on the wire filters is the serialized string[] (see serializeArguments),
      // even though T statically types it as the deserialized chain
      filters: args.filters
        ? new SerializableFilterChain({
            filters: args.filters as SerializedFilterChain,
            jexl: this.pluginManager.jexl,
          })
        : undefined,
    }
  }

  async serializeArguments(
    args: RenderArgs & {
      stopToken?: StopToken
      statusCallback?: (arg: string) => void
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const assemblyManager = pm.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, {
      ...args,
      filters: args.filters?.toJSON().filters,
    })

    return super.serializeArguments(renamedArgs, rpcDriverClassName)
  }
}

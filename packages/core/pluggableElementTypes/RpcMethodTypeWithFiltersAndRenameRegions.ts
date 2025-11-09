import RpcMethodType from './RpcMethodType'
import { renameRegionsIfNeeded } from '../util'
import SerializableFilterChain from './renderers/util/serializableFilterChain'

import type { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'

export default abstract class RpcMethodTypeWithFiltersAndRenameRegions extends RpcMethodType {
  async deserializeArguments<T>(
    args: T & { filters?: any },
    rpcDriverClassName: string,
  ): Promise<T> {
    const l = await super.deserializeArguments(args, rpcDriverClassName)
    return {
      ...l,
      filters: args.filters
        ? new SerializableFilterChain({
            filters: args.filters,
          })
        : undefined,
    }
  }

  async serializeArguments(
    args: RenderArgs & {
      stopToken?: string
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

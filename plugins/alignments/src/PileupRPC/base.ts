import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import type { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'

// specialized get features to return limited data about alignments
export default abstract class PileupBaseRPC extends RpcMethodType {
  async serializeArguments(
    args: RenderArgs & {
      stopToken?: string
      statusCallback?: (arg: string) => void
    },
    rpcDriver: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager available')
    }

    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)

    return super.serializeArguments(renamedArgs, rpcDriver)
  }
}

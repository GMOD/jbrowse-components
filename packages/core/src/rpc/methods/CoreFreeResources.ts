import { freeAdapterResources } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

/**
 * Drop cached data adapters associated with the given session.
 */
export default class CoreFreeResources extends RpcMethodType {
  name = 'CoreFreeResources'

  async execute(args: { sessionId?: string }) {
    await freeAdapterResources(args)
  }

  async serializeArguments(args: Record<string, unknown>, _rpcDriver: string) {
    return args
  }
}

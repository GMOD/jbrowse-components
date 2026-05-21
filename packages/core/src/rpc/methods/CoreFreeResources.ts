import { freeAdapterResources } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

/**
 * Drop cached data adapters associated with the given session, and tell each
 * renderer type to free per-render-session resources (layouts, etc).
 */
export default class CoreFreeResources extends RpcMethodType {
  name = 'CoreFreeResources'

  async execute(args: { sessionId?: string }) {
    await freeAdapterResources(args)
    for (const renderer of this.pluginManager.getRendererTypes()) {
      renderer.freeResources(args)
    }
  }

  async serializeArguments(args: Record<string, unknown>, _rpcDriver: string) {
    return args
  }
}

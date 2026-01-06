import { freeAdapterResources } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

/**
 * free up any resources (e.g. cached adapter objects)
 * that are only associated with the given track ID.
 *
 * returns number of objects deleted
 */
export default class CoreFreeResources extends RpcMethodType {
  name = 'CoreFreeResources'

  async execute(args: Record<string, unknown>) {
    await freeAdapterResources(args)
    for (const renderer of this.pluginManager.getRendererTypes()) {
      renderer.freeResources(args)
    }
  }

  async serializeArguments(args: Record<string, unknown>, _rpcDriver: string) {
    return args
  }
}

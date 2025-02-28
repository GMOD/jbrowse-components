import { freeAdapterResources } from '../../data_adapters/dataAdapterCache'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'

/**
 * free up any resources (e.g. cached adapter objects)
 * that are only associated with the given track ID.
 *
 * returns number of objects deleted
 */
export default class CoreFreeResources extends RpcMethodType {
  name = 'CoreFreeResources'

  async execute(args: Record<string, unknown>) {
    freeAdapterResources(args)
    this.pluginManager.getRendererTypes().forEach(renderer => {
      renderer.freeResources(args)
    })
  }

  async serializeArguments(args: Record<string, unknown>, _rpcDriver: string) {
    return args
  }
}

import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'
import { freeAdapterResources } from '../../data_adapters/dataAdapterCache'

/**
 * free up any resources (e.g. cached adapter objects)
 * that are only associated with the given track ID.
 *
 * returns number of objects deleted
 */
export default class CoreFreeResources extends RpcMethodType {
  name = 'CoreFreeResources'

  async execute(specification: {}) {
    let deleteCount = 0

    deleteCount += freeAdapterResources(specification)

    // pass the freeResources hint along to all the renderers as well
    this.pluginManager.getRendererTypes().forEach(renderer => {
      const count = renderer.freeResources(/* specification */)
      if (count) {
        deleteCount += count
      }
    })

    return deleteCount
  }
  async serializeArguments(args: {}, _rpcDriver: string): Promise<{}> {
    return args
  }
}

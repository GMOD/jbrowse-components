import { getRegions, renderRegion, freeResources } from '../render'

const funcs = { getRegions, renderRegion, freeResources }

export default class MainThreadRpcDriver {
  call(pluginManager, stateGroupName, functionName, args) {
    const func = funcs[functionName]
    if (!func)
      throw new Error(
        `MainThreadRpcDriver has no RPC function "${functionName}"`,
      )

    const clonedArgs = JSON.parse(JSON.stringify(args))
    return func.call(this, pluginManager, ...clonedArgs)
  }
}

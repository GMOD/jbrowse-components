export default class MainThreadRpcDriver {
  /**
   * Stub RPC driver class that runs RPC functions in-band in the main thread.
   *
   * @param {Object} rpcFuncs object containing runnable rpc functions
   */
  constructor(pluginManager, { rpcFuncs }) {
    this.rpcFuncs = rpcFuncs
    if (!rpcFuncs) throw new TypeError('rpcFuncs argument required')
  }

  call(pluginManager, stateGroupName, functionName, args) {
    const func = this.rpcFuncs[functionName]
    if (!func) {
      debugger
      throw new Error(
        `MainThreadRpcDriver has no RPC function "${functionName}"`,
      )
    }

    const clonedArgs = JSON.parse(JSON.stringify(args))
    return func.call(this, pluginManager, ...clonedArgs)
  }
}

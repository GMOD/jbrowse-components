import BaseRpcDriver, { RpcDriverConstructorArgs } from './BaseRpcDriver'
import PluginManager from '../PluginManager'

class DummyHandle {
  destroy(): void {}

  async call(
    _functionName: string,
    _filteredArgs?: {},
    _options = {},
  ): Promise<unknown> {
    return undefined
  }
}

/**
 * Stub RPC driver class that runs RPC functions in-band in the main thread.
 *
 * @param rpcFuncs - object containing runnable rpc functions
 */
export default class MainThreadRpcDriver extends BaseRpcDriver {
  name = 'MainThreadRpcDriver'

  makeWorker: () => DummyHandle

  constructor(args: RpcDriverConstructorArgs) {
    super(args)
    this.makeWorker = (): DummyHandle => new DummyHandle()
  }

  async call(
    pluginManager: PluginManager,
    sessionId: string,
    functionName: string,
    args: {},
  ): Promise<unknown> {
    if (!sessionId) {
      throw new TypeError('sessionId is required')
    }
    const rpcMethod = pluginManager.getRpcMethodType(functionName)
    const serializedArgs = await rpcMethod.serializeArguments(args, this.name)
    const result = await rpcMethod.execute(serializedArgs, this.name)
    return rpcMethod.deserializeReturn(result, args, this.name)
  }
}

import BaseRpcDriver from './BaseRpcDriver'
import type { RpcDriverConstructorArgs } from './BaseRpcDriver'
import type PluginManager from '../PluginManager'

class DummyHandle {
  destroy(): void {}

  async call(
    _functionName: string,
    _filteredArgs?: Record<string, unknown>,
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

  makeWorker: () => Promise<DummyHandle>

  constructor(args: RpcDriverConstructorArgs) {
    super(args)
    this.makeWorker = async (): Promise<DummyHandle> => new DummyHandle()
  }

  async call(
    pm: PluginManager,
    sessionId: string,
    funcName: string,
    args: Record<string, unknown>,
  ) {
    if (!sessionId) {
      throw new TypeError('sessionId is required')
    }
    const rpcMethod = pm.getRpcMethodType(funcName)
    if (!rpcMethod) {
      throw new Error(`unknown RPC method ${funcName}`)
    }
    const serializedArgs = await rpcMethod.serializeArguments(args, this.name)
    const result = await rpcMethod.execute(serializedArgs, this.name)
    return rpcMethod.deserializeReturn(result, args, this.name)
  }
}

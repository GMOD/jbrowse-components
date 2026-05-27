import BaseRpcDriver from './BaseRpcDriver.ts'

import type { RpcDriverConstructorArgs } from './BaseRpcDriver.ts'
import type PluginManager from '../PluginManager.ts'

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
 * RPC driver that runs RPC functions in-band in the main thread.
 * Supports direct execution for methods that implement executeDirect(),
 * bypassing serialization overhead entirely.
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

    // Use direct execution if the method supports it (avoids serialization)
    if (rpcMethod.supportsDirectExecution()) {
      return rpcMethod.executeDirect(args)
    }

    const serializedArgs = await rpcMethod.serializeArguments(args, this.name)
    const result = await rpcMethod.execute(serializedArgs, this.name)
    return rpcMethod.deserializeReturn(result, args, this.name)
  }
}

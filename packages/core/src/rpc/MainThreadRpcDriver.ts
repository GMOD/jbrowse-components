import BaseRpcDriver from './BaseRpcDriver.ts'

import type { WorkerHandle } from './BaseRpcDriver.ts'
import type PluginManager from '../PluginManager.ts'

/**
 * RPC driver that runs RPC functions in-band in the main thread.
 * Supports direct execution for methods that implement executeDirect(),
 * bypassing serialization overhead entirely.
 */
export default class MainThreadRpcDriver extends BaseRpcDriver {
  name = 'MainThreadRpcDriver'

  // call() runs methods in-band and never touches the worker pool, so this is
  // unreachable; defined only to satisfy the abstract base
  async makeWorker(): Promise<WorkerHandle> {
    throw new Error('MainThreadRpcDriver does not use workers')
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

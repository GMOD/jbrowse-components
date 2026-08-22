import BaseRpcDriver from './BaseRpcDriver.ts'

import type PluginManager from '../PluginManager.ts'
import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { StatusCallback } from '../util/progress.ts'

/**
 * RPC driver that runs RPC functions in-band on the main thread. It owns no
 * worker pool, so `destroy` stays the BaseRpcDriver no-op and `freeSession`
 * stays that class's in-realm free — the adapter cache this driver fills is the
 * main thread's own.
 */
export default class MainThreadRpcDriver extends BaseRpcDriver {
  name = 'MainThreadRpcDriver'

  protected async transport(
    _pluginManager: PluginManager,
    _sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    statusCallback: StatusCallback | undefined,
  ) {
    // re-attach the out-of-band statusCallback that BaseRpcDriver.call split off,
    // mirroring how the worker re-wires it on the far side of postMessage —
    // including the case where there is none, which `wrapForRpc` answers by
    // adding no key at all. Spreading `statusCallback: undefined` in would leave
    // the two drivers handing `execute` bags that differ by a key, which is the
    // kind of difference nothing tests and something eventually reads.
    //
    // `invoke`, not `execute` — it is the entry point that deserializes the
    // arguments first, and the worker binds the same one
    return rpcMethod.invoke(
      statusCallback ? { ...serializedArgs, statusCallback } : serializedArgs,
    )
  }
}

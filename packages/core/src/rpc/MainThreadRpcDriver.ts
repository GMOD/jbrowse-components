import BaseRpcDriver from './BaseRpcDriver.ts'

import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { StatusCallback } from '../util/progress.ts'

/**
 * RPC driver that runs RPC functions in-band on the main thread. It owns no
 * worker pool, so the per-session lifecycle hooks (freeSession/destroy) stay as
 * the BaseRpcDriver no-ops.
 */
export default class MainThreadRpcDriver extends BaseRpcDriver {
  name = 'MainThreadRpcDriver'

  protected async transport(
    _pluginManager: unknown,
    _sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    statusCallback: StatusCallback | undefined,
  ) {
    // re-attach the out-of-band statusCallback that BaseRpcDriver.call split off,
    // mirroring how the worker re-wires it on the far side of postMessage
    return rpcMethod.execute({ ...serializedArgs, statusCallback }, this.name)
  }
}

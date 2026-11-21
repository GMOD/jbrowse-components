import BaseRpcDriver from './BaseRpcDriver.ts'

import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { RpcHandles } from './RpcRegistry.ts'

/**
 * RPC driver that runs RPC functions in-band on the main thread, filling the
 * page's one adapter cache. It has no worker to terminate, so `destroy` frees
 * every session it ran, and each call still running frees its session again
 * when it settles. ADR-086.
 */
export default class MainThreadRpcDriver extends BaseRpcDriver {
  name = 'MainThreadRpcDriver'

  private sessions = new Set<string>()

  private destroyed = false

  override async freeSession(sessionId: string) {
    this.sessions.delete(sessionId)
    await super.freeSession(sessionId)
  }

  override destroy() {
    this.destroyed = true
    for (const sessionId of this.sessions) {
      this.freeAfterDestroy(sessionId)
    }
  }

  private freeAfterDestroy(sessionId: string) {
    super.freeSession(sessionId).catch((error: unknown) => {
      console.error(error)
    })
  }

  private refuseAfterDestroy() {
    if (this.destroyed) {
      throw new Error('MainThreadRpcDriver was destroyed')
    }
  }

  protected async transport(
    sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    { statusCallback, signal }: RpcHandles,
  ) {
    this.refuseAfterDestroy()
    this.sessions.add(sessionId)
    try {
      // re-attach the out-of-band handles that BaseRpcDriver.call split off,
      // mirroring how the worker re-wires them on the far side of postMessage
      // — including the case where there is none, which `wrapForRpc` and
      // `RpcServer` answer by adding no key at all. Spreading `statusCallback:
      // undefined` in would leave the two drivers handing `execute` bags that
      // differ by a key, which is the kind of difference nothing tests and
      // something eventually reads.
      //
      // `invoke`, not `execute` — it is the entry point that deserializes the
      // arguments first, and the worker binds the same one
      return await rpcMethod.invoke({
        ...serializedArgs,
        ...(statusCallback ? { statusCallback } : {}),
        ...(signal ? { signal } : {}),
      })
    } finally {
      if (this.destroyed) {
        this.freeAfterDestroy(sessionId)
      }
    }
  }
}

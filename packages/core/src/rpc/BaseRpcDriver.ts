import { checkAbortSignal, withAbortCheck } from '../util/aborting.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { RpcHandles } from './RpcRegistry.ts'

/**
 * The method that drops a session's cached adapters, named once because
 * {@link BaseRpcDriver.freeSession} is the only thing that dispatches it.
 */
export const CORE_FREE_RESOURCES = 'CoreFreeResources'

export default abstract class BaseRpcDriver {
  abstract name: string

  // Held, not threaded. `call`, `transport` and `freeSession` each took one as
  // their first parameter and `RpcManager` passed the same object to all of
  // them on every RPC — a driver is built by the manager that owns it, so it
  // can just have one. Holding it is also what lets `Core-extendWorker` fire
  // where a worker boots rather than on the dispatch path. ADR-086.
  constructor(
    protected pluginManager: PluginManager,
    public config: AnyConfigurationModel,
  ) {}

  /**
   * Drop everything this driver holds for a session — the worker-side adapter
   * cache, and whatever bookkeeping the transport keeps alongside it.
   *
   * A driver operation rather than a `call`, because a free has nothing to do on
   * a transport that never ran this session and must not outlive `destroy`;
   * routing it through `call` did both. ADR-086.
   *
   * The base behavior is the main-thread one: run the method in this realm,
   * where `dataAdapterCache` lives. `invoke`, not `execute`, for the reason
   * `MainThreadRpcDriver.transport` uses it.
   */
  async freeSession(sessionId: string) {
    await this.pluginManager
      .getRpcMethodType(CORE_FREE_RESOURCES)
      .invoke({ sessionId })
  }

  destroy() {}

  // start whatever a first call would otherwise wait for; nothing, here
  warmUp() {}

  async call(
    sessionId: string,
    functionName: string,
    args: Record<string, unknown> & RpcHandles,
  ) {
    if (!sessionId) {
      throw new TypeError('sessionId is required')
    }

    // An RPC method is addressed by string, so a removed or renamed one is not
    // a type error anywhere — it fails here. It fails WELL: `TypeRecord.get`
    // throws naming the method and listing what is registered, which is the
    // "which plugin is missing" answer. No `undefined` check belongs here; one
    // was added and lint called it dead, correctly.
    const rpcMethod = this.pluginManager.getRpcMethodType(functionName)

    // The two handles are out of band, not data: each transport wires its own
    // channel for them, and neither survives structured clone. The worker
    // postMessage throws on anything that isn't cloneable, surfacing bad data
    // at the boundary instead of silently dropping it.
    //
    // The callback is stripped on the way OUT rather than on the way in, so
    // `serializeArguments` can see it. That is not cosmetic: serialization is
    // where the refName map is resolved, and resolving one downloads the
    // adapter's index (and for an in-memory adapter, the whole file).
    // Destructuring the callback off first left that download with nothing to
    // report through — `loadRefNameMap` forwards a `statusCallback` for exactly
    // this and, for every RPC, was handed undefined.
    //
    // Serialization is the one long await here, and it is wrapped rather than
    // fenced by hand-placed checks so the check on the FAR side comes with the
    // near one. A call already aborted has nothing to deliver to, so refuse it
    // rather than serializing args and waking a worker; an abort landing DURING
    // serialization used to go unseen and the worker ground the fetch to
    // completion. Callers already treat an abort as the ordinary outcome of a
    // superseded fetch.
    const { signal, ...rest } = args
    checkAbortSignal(signal)
    const { statusCallback: _outOfBand, ...serializedArgs } =
      await withAbortCheck(signal, () => rpcMethod.serializeArguments(rest))

    const result = await this.transport(sessionId, rpcMethod, serializedArgs, {
      statusCallback: rest.statusCallback,
      signal,
    })

    return rpcMethod.deserializeReturn(result, args)
  }

  // Dispatch already-serialized args to wherever this driver runs the method
  // (a pooled worker, or in-band on the main thread). The base class owns the
  // serialize/deserialize envelope around this.
  protected abstract transport(
    sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    handles: RpcHandles,
  ): Promise<unknown>
}

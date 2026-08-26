import { isStopToken, withStopTokenCheck } from '../util/stopToken.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { StatusCallback } from '../util/progress.ts'
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

    // statusCallback is an out-of-band progress handle, not data: each transport
    // wires up its own channel for it, so it must not reach the serialized
    // payload. Everything that does must be structured-cloneable; the worker
    // postMessage clones it and throws on anything that isn't, surfacing bad data
    // at the boundary instead of silently dropping it.
    //
    // Stripped on the way OUT rather than on the way in, so `serializeArguments`
    // can see it. That is not cosmetic: serialization is where the refName map
    // is resolved, and resolving one downloads the adapter's index (and for an
    // in-memory adapter, the whole file). Destructuring the callback off first
    // left that download with nothing to report through — `loadRefNameMap`
    // forwards a `statusCallback` for exactly this and, for every RPC, was
    // handed undefined. The wire payload is identical either way.
    //
    // Serialization is the one long await here, and it is wrapped rather than
    // fenced by hand-placed checks so the check on the FAR side comes with the
    // near one — that is the whole point of `withStopTokenCheck`, and the far
    // one is what was missing. A call whose token was already stopped has
    // nothing to deliver to, so refuse it rather than serializing args, waking a
    // worker and racing a stop notification against the call it means to cancel;
    // and a stop landing DURING serialization had nowhere to be seen at all,
    // because the broadcast it fires reaches only *booted* workers and on a
    // driver's first call `LazyWorker.workerP` is undefined until `transport`
    // reaches `getWorker`. The worker never learned the token was stopped and
    // ground the fetch to completion. SharedArrayBuffer tokens see the stop
    // through shared memory regardless; this is the string-token path, which is
    // every deployment we ship — `stopToken.ts`, "Which path runs where".
    //
    // Callers already treat an abort as the ordinary outcome of a superseded
    // fetch.
    const stopToken = isStopToken(args.stopToken) ? args.stopToken : undefined
    const { statusCallback } = args
    const { statusCallback: _outOfBand, ...serializedArgs } =
      await withStopTokenCheck(stopToken, () =>
        rpcMethod.serializeArguments(args),
      )

    const result = await this.transport(
      sessionId,
      rpcMethod,
      serializedArgs,
      statusCallback,
    )

    return rpcMethod.deserializeReturn(result, args)
  }

  // Dispatch already-serialized args to wherever this driver runs the method
  // (a pooled worker, or in-band on the main thread). The base class owns the
  // serialize/deserialize envelope around this.
  protected abstract transport(
    sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    statusCallback: StatusCallback | undefined,
  ): Promise<unknown>
}

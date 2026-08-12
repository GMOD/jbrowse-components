import { checkStopToken, isStopToken } from '../util/stopToken.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { StatusCallback } from '../util/progress.ts'

export interface RpcDriverConstructorArgs {
  config: AnyConfigurationModel
}

export default abstract class BaseRpcDriver {
  abstract name: string

  config: AnyConfigurationModel

  constructor(args: RpcDriverConstructorArgs) {
    this.config = args.config
  }

  // overridden by drivers that own per-session resources (e.g. a worker pool);
  // a driver with no such state (main thread) keeps these as no-ops
  freeSession(_sessionId: string) {}

  destroy() {}

  async call(
    pluginManager: PluginManager,
    sessionId: string,
    functionName: string,
    args: Record<string, unknown> & {
      statusCallback?: StatusCallback
    },
    options: Record<string, unknown> = {},
  ) {
    if (!sessionId) {
      throw new TypeError('sessionId is required')
    }

    // A call whose token was already stopped has nothing to deliver to: refuse
    // it here rather than serializing args, waking a worker and racing a stop
    // notification against the call it means to cancel. Callers already treat
    // an abort as the ordinary outcome of a superseded fetch.
    if (isStopToken(args.stopToken)) {
      checkStopToken(args.stopToken)
    }

    const rpcMethod = pluginManager.getRpcMethodType(functionName)

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
    const { statusCallback } = args
    const { statusCallback: _outOfBand, ...serializedArgs } =
      await rpcMethod.serializeArguments(args, this.name)

    const result = await this.transport(
      pluginManager,
      sessionId,
      rpcMethod,
      serializedArgs,
      statusCallback,
      options,
    )

    return rpcMethod.deserializeReturn(result, args, this.name)
  }

  // Dispatch already-serialized args to wherever this driver runs the method
  // (a pooled worker, or in-band on the main thread). The base class owns the
  // serialize/deserialize envelope around this.
  protected abstract transport(
    pluginManager: PluginManager,
    sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    statusCallback: StatusCallback | undefined,
    options: Record<string, unknown>,
  ): Promise<unknown>
}

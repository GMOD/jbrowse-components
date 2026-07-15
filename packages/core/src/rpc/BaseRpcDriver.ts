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

    const rpcMethod = pluginManager.getRpcMethodType(functionName)

    // statusCallback is an out-of-band progress handle, not data: each transport
    // wires up its own channel for it, so keep it out of the serialized payload
    // entirely. Everything that remains must be structured-cloneable; the worker
    // postMessage clones it and throws on anything that isn't, surfacing bad data
    // at the boundary instead of silently dropping it.
    const { statusCallback, ...rest } = args
    const serializedArgs = await rpcMethod.serializeArguments(rest, this.name)

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

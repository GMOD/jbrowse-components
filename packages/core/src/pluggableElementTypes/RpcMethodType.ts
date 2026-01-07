import PluggableElementBase from './PluggableElementBase.ts'
import mapObject from '../util/map-obj/index.ts'
import { isRpcResult } from '../util/rpc.ts'
import { getBlobMap, setBlobMap } from '../util/tracks.ts'
import {
  RetryError,
  isAppRootModel,
  isAuthNeededException,
  isUriLocation,
} from '../util/types/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { UriLocation } from '../util/types/index.ts'

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

export default abstract class RpcMethodType extends PluggableElementBase {
  pluginManager: PluginManager

  constructor(pluginManager: PluginManager) {
    super()
    this.pluginManager = pluginManager
  }

  async serializeArguments(
    args: Record<string, unknown>,
    rpcDriverClassName: string,
  ): Promise<Record<string, unknown>> {
    await this.augmentLocationObjects(args, rpcDriverClassName)
    return {
      ...args,
      blobMap: getBlobMap(),
    }
  }

  async serializeNewAuthArguments(
    loc: UriLocation,
    _rpcDriverClassName: string,
  ) {
    const rootModel = this.pluginManager.rootModel

    // args dont need auth or already have auth
    if (!isAppRootModel(rootModel) || loc.internetAccountPreAuthorization) {
      return loc
    }

    const account = rootModel.findAppropriateInternetAccount(loc)

    if (account) {
      loc.internetAccountPreAuthorization =
        await account.getPreAuthorizationInformation(loc)
    }
    return loc
  }

  async deserializeArguments<T>(
    args: T & { blobMap?: Record<string, File> },
    _rpcDriverClassName: string,
  ): Promise<T> {
    if (args.blobMap) {
      setBlobMap(args.blobMap)
    }

    return args
  }

  abstract execute(
    serializedArgs: unknown,
    rpcDriverClassName: string,
  ): Promise<unknown>

  /**
   * Execute directly without serialization. Override in subclasses that support
   * direct execution (e.g., CoreRender). Returns undefined by default, signaling
   * that the driver should fall back to serialized execution.
   */
  async executeDirect(_args: Record<string, unknown>): Promise<unknown> {
    return undefined
  }

  supportsDirectExecution(): boolean {
    return this.executeDirect !== RpcMethodType.prototype.executeDirect
  }

  async serializeReturn(
    originalReturn: unknown,
    _args: unknown,
    _rpcDriverClassName: string,
  ) {
    return originalReturn
  }

  async deserializeReturn(
    serializedReturn: unknown,
    _args: unknown,
    _rpcDriverClassName: string,
  ) {
    let r: unknown
    try {
      r = await serializedReturn
    } catch (error) {
      if (isAuthNeededException(error)) {
        const retryAccount = // @ts-expect-error
          this.pluginManager.rootModel?.createEphemeralInternetAccount(
            `HTTPBasicInternetAccount-${new URL(error.url).origin}`,
            {},
            error.url,
          )
        throw new RetryError(
          'Retrying with created internet account',
          retryAccount.internetAccountId,
        )
      }
      throw error
    }
    // Unwrap rpcResult if present (needed for MainThreadRpcDriver where the
    // rpcResult wrapper isn't stripped by the worker message handler)
    if (isRpcResult(r)) {
      return r.value
    }
    return r
  }

  private async augmentLocationObjects(
    thing: Record<string, unknown>,
    rpcDriverClassName: string,
  ) {
    const rootModel = this.pluginManager.rootModel

    // Skip expensive deep traversal only if we have a valid root model with no internet accounts
    // (Don't skip if rootModel isn't set up - let serializeNewAuthArguments handle that case)
    if (isAppRootModel(rootModel) && rootModel.internetAccounts.length === 0) {
      return thing
    }

    const uris = [] as UriLocation[]

    // exclude renderingProps from deep traversal - it is only needed
    // client-side for React components and can contain circular references
    // (e.g. d3 hierarchy nodes) or non-serializable objects like callbacks
    const { renderingProps, ...rest } = thing

    // using map-obj avoids cycles, seen in circular view svg export
    mapObject(
      rest,
      (key, val: unknown) => {
        if (isUriLocation(val)) {
          uris.push(val)
        }
        if (Array.isArray(val)) {
          for (const item of val) {
            if (isUriLocation(item)) {
              uris.push(item)
            }
          }
        }
        return [key, val]
      },
      { deep: true },
    )
    for (const uri of uris) {
      await this.serializeNewAuthArguments(uri, rpcDriverClassName)
    }
    return thing
  }
}

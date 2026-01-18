import PluggableElementBase from './PluggableElementBase.ts'
import mapObject from '../util/map-obj/index.ts'
import { isRpcResult } from '../util/rpc.ts'
import {
  getBlobMap,
  getFileFromCache,
  getFileHandleCache,
  setBlobMap,
  setFileHandleCache,
} from '../util/tracks.ts'
import {
  RetryError,
  isAppRootModel,
  isAuthNeededException,
  isFileHandleLocation,
  isUriLocation,
} from '../util/types/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { FileHandleLocation, UriLocation } from '../util/types/index.ts'

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

    const uris = [] as UriLocation[]
    const fileHandleLocations = [] as {
      location: FileHandleLocation
      parent: Record<string, unknown>
      key: string
    }[]

    // exclude renderingProps from deep traversal - it is only needed
    // client-side for React components and can contain circular references
    // (e.g. d3 hierarchy nodes) or non-serializable objects like callbacks
    const { renderingProps, ...rest } = thing

    // using map-obj avoids cycles, seen in circular view svg export
    mapObject(
      rest,
      (key, val: unknown, source) => {
        if (isUriLocation(val)) {
          uris.push(val)
        }
        if (isFileHandleLocation(val)) {
          fileHandleLocations.push({
            location: val,
            parent: source as Record<string, unknown>,
            key,
          })
        }
        if (Array.isArray(val)) {
          for (let i = 0; i < val.length; i++) {
            const item = val[i]
            if (isUriLocation(item)) {
              uris.push(item)
            }
            if (isFileHandleLocation(item)) {
              fileHandleLocations.push({
                location: item,
                parent: val as unknown as Record<string, unknown>,
                key: String(i),
              })
            }
          }
        }
        return [key, val]
      },
      { deep: true },
    )

    // Convert FileHandleLocation to BlobLocation for worker transfer
    // FileSystemFileHandle cannot be transferred, but File objects can
    const blobMap = getBlobMap()
    let counter = 0
    for (const { location, parent, key } of fileHandleLocations) {
      const file = getFileFromCache(location.handleId)
      if (file) {
        const blobId = `fh-rpc-${Date.now()}-${counter++}`
        blobMap[blobId] = file
        // Replace FileHandleLocation with BlobLocation in parent
        parent[key] = {
          locationType: 'BlobLocation',
          name: location.name,
          blobId,
        }
      }
    }

    // Skip URI auth augmentation if we have a valid root model with no internet accounts
    if (isAppRootModel(rootModel) && rootModel.internetAccounts.length === 0) {
      return thing
    }

    for (const uri of uris) {
      await this.serializeNewAuthArguments(uri, rpcDriverClassName)
    }
    return thing
  }
}

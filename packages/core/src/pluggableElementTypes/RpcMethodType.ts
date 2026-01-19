import PluggableElementBase from './PluggableElementBase.ts'
import mapObject from '../util/map-obj/index.ts'
import { isRpcResult } from '../util/rpc.ts'
import { getBlobMap, getFileFromCache, setBlobMap } from '../util/tracks.ts'
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

// Note: We use custom recursion instead of mapObject here because mapObject's
// mapper function only receives object properties, not array items directly.
// FileHandleLocation objects can appear as array elements (e.g., in adapter
// configs with multiple file locations), so we need direct array item access.
export function convertFileHandleLocations(
  obj: unknown,
  blobMap: Record<string, File>,
  seen = new WeakSet<object>(),
) {
  const convertLocation = (loc: FileHandleLocation) => {
    const file = getFileFromCache(loc.handleId)
    if (!file) {
      throw new Error(
        `File not in cache for handleId: ${loc.handleId}. ` +
          `The file "${loc.name}" may need to be reopened.`,
      )
    }
    // Use deterministic blobId based on handleId so the same FileHandleLocation
    // always converts to the same BlobLocation. This ensures adapter config
    // hashes remain stable across render calls.
    const blobId = `fh-blob-${loc.handleId}`
    blobMap[blobId] = file
    return { locationType: 'BlobLocation' as const, name: loc.name, blobId }
  }

  const convert = (current: unknown): void => {
    if (!current || typeof current !== 'object' || seen.has(current)) {
      return
    }
    seen.add(current)

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        const item = current[i]
        if (isFileHandleLocation(item)) {
          current[i] = convertLocation(item)
        } else {
          convert(item)
        }
      }
    } else {
      const record = current as Record<string, unknown>
      for (const key of Object.keys(record)) {
        const val = record[key]
        if (isFileHandleLocation(val)) {
          record[key] = convertLocation(val)
        } else {
          convert(val)
        }
      }
    }
  }

  convert(obj)
}

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
    const blobMap = getBlobMap()

    // Convert FileHandleLocation to BlobLocation in-place
    // Skip renderingProps as it may have circular references
    const { renderingProps, ...rest } = thing
    convertFileHandleLocations(rest, blobMap)

    // Collect UriLocations for auth augmentation using map-obj (handles cycles)
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

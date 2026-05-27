import PluggableElementBase from './PluggableElementBase.ts'
import { renameRegionsIfNeeded } from '../util/index.ts'
import { isRpcResult } from '../util/rpc.ts'
import {
  getBlobMap,
  getFileFromCache,
  hasFileHandlesInCache,
  setBlobMap,
} from '../util/tracks.ts'
import {
  RetryError,
  isAppRootModel,
  isAuthNeededException,
  isFileHandleLocation,
  isUriLocation,
} from '../util/types/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { Region } from '../util/index.ts'
import type { StopToken } from '../util/stopToken.ts'
import type { FileHandleLocation, UriLocation } from '../util/types/index.ts'

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

function convertFileHandleToBlob(
  loc: FileHandleLocation,
  blobMap: Record<string, File>,
) {
  const file = getFileFromCache(loc.handleId)
  if (!file) {
    throw new Error(
      `File not in cache for handleId: ${loc.handleId}. ` +
        `The file "${loc.name}" may need to be reopened.`,
    )
  }
  // Deterministic blobId from handleId so the same FileHandleLocation always
  // produces the same BlobLocation — keeps adapter config hashes stable.
  const blobId = `fh-blob-${loc.handleId}`
  blobMap[blobId] = file
  return { locationType: 'BlobLocation' as const, name: loc.name, blobId }
}

/**
 * Single recursive walker that handles both FileHandleLocation → BlobLocation
 * conversion and UriLocation collection for auth augmentation. Either side can
 * be disabled by omitting the corresponding option; if both are omitted the
 * walk is a no-op and the caller should skip it entirely.
 */
function walkLocationObjects(
  obj: unknown,
  opts: { blobMap?: Record<string, File>; uris?: UriLocation[] },
  seen = new WeakSet<object>(),
): void {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) {
    return
  }
  seen.add(obj)

  const visit = (val: unknown, write: (next: unknown) => void) => {
    if (opts.blobMap && isFileHandleLocation(val)) {
      write(convertFileHandleToBlob(val, opts.blobMap))
    } else {
      if (opts.uris && isUriLocation(val)) {
        opts.uris.push(val)
      }
      walkLocationObjects(val, opts, seen)
    }
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      visit(obj[i], next => {
        obj[i] = next
      })
    }
  } else {
    const record = obj as Record<string, unknown>
    for (const key of Object.keys(record)) {
      visit(record[key], next => {
        record[key] = next
      })
    }
  }
}

// Back-compat wrapper around the combined walker; some tests and external
// callers import this directly.
export function convertFileHandleLocations(
  obj: unknown,
  blobMap: Record<string, File>,
) {
  walkLocationObjects(obj, { blobMap })
}

export default abstract class RpcMethodType extends PluggableElementBase {
  pluginManager: PluginManager

  constructor(pluginManager: PluginManager) {
    super()
    this.pluginManager = pluginManager
  }

  async serializeArguments(
    args: object,
    rpcDriverClassName: string,
  ): Promise<Record<string, unknown>> {
    await this.augmentLocationObjects(
      args as Record<string, unknown>,
      rpcDriverClassName,
    )
    return {
      ...args,
      blobMap: getBlobMap(),
    }
  }

  protected async renameRegions<
    T extends {
      assemblyName?: string
      regions?: Region[]
      stopToken?: StopToken
      adapterConfig: Record<string, unknown>
      sessionId: string
      statusCallback?: (arg: string) => void
    },
  >(args: T): Promise<T> {
    const { rootModel } = this.pluginManager
    return renameRegionsIfNeeded(rootModel!.session!.assemblyManager, args)
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
    const needsFileHandles = hasFileHandlesInCache()
    const needsUris =
      isAppRootModel(rootModel) && rootModel.internetAccounts.length > 0

    // Common case (web users with no internet accounts and no desktop file
    // handles): nothing to do, skip the tree walk entirely.
    if (!needsFileHandles && !needsUris) {
      return thing
    }

    // Skip renderingProps — it may contain circular references and never has
    // FileHandleLocations or UriLocations inside.
    const uris: UriLocation[] = []
    const { renderingProps, ...rest } = thing
    walkLocationObjects(rest, {
      blobMap: needsFileHandles ? getBlobMap() : undefined,
      uris: needsUris ? uris : undefined,
    })

    for (const uri of uris) {
      await this.serializeNewAuthArguments(uri, rpcDriverClassName)
    }
    return thing
  }
}

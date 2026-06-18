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
  isAppRootModel,
  isFileHandleLocation,
  isUriLocation,
} from '../util/types/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { Region } from '../util/index.ts'
import type { StatusCallback } from '../util/progress.ts'
import type { StopToken } from '../util/stopToken.ts'
import type { FileHandleLocation, UriLocation } from '../util/types/index.ts'

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

// the arg shape renameRegions (and RpcMethodTypeWithRenameRegions) operate on
export interface RenameRegionsArgs {
  assemblyName?: string
  regions?: Region[]
  stopToken?: StopToken
  adapterConfig: Record<string, unknown>
  sessionId: string
  statusCallback?: StatusCallback
}

// singular-region counterpart, for RpcMethodTypeWithRenameRegion
export interface RenameRegionArgs {
  region: Region
  adapterConfig: Record<string, unknown>
  sessionId: string
}

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

// Whether structuredClone (and the worker postMessage boundary) can carry this
// value. Functions and Errors cannot; ownArgs passes them through by reference
// rather than recursing, and a genuine one leaking through surfaces at the
// worker postMessage boundary in production.
function isCloneable(thing: unknown) {
  return !(typeof thing === 'function') && !(thing instanceof Error)
}

// Values that structuredClone handles natively and that must pass through
// ownArgs unchanged: `Object.entries` on them yields `[]`, so naive cloning
// would collapse them to plain `{}` (e.g. a SharedArrayBuffer-backed stop token
// would silently stop working, a typed array would lose its data).
function isStructuredClonePassthrough(thing: object): boolean {
  return (
    thing instanceof File ||
    thing instanceof Blob ||
    thing instanceof ArrayBuffer ||
    // SharedArrayBuffer is not an ArrayBuffer subclass; without this it
    // collapses to {} and SAB-based stop tokens silently stop working
    (typeof SharedArrayBuffer !== 'undefined' &&
      thing instanceof SharedArrayBuffer) ||
    ArrayBuffer.isView(thing) ||
    thing instanceof Date ||
    thing instanceof Map ||
    thing instanceof Set ||
    thing instanceof RegExp
  )
}

// Deep-clone the object/array spine of the RPC args so blob conversion and auth
// augmentation mutate owned data, never the read-only config snapshots that flow
// in via readConfObject. A plain structuredClone can't be used here: the test
// environment's structuredClone collapses typed arrays and the SharedArrayBuffer
// stop token to plain objects, and it would reject any stray function. Non-
// cloneable leaves (functions, Errors) and structured-clone natives (typed
// arrays, Blobs, the SAB stop token...) pass through by reference unchanged; a
// genuinely non-cloneable value that leaked in by mistake is surfaced at the
// worker postMessage boundary (real structuredClone) in production.
function ownArgs(
  thing: unknown,
  seen = new WeakMap<object, unknown>(),
): unknown {
  if (!thing || typeof thing !== 'object') {
    return thing
  }
  if (isStructuredClonePassthrough(thing) || !isCloneable(thing)) {
    return thing
  }
  const existing = seen.get(thing)
  if (existing) {
    return existing
  }
  if (Array.isArray(thing)) {
    const clone: unknown[] = []
    seen.set(thing, clone)
    for (const item of thing) {
      clone.push(ownArgs(item, seen))
    }
    return clone
  }
  const clone: Record<string, unknown> = {}
  seen.set(thing, clone)
  for (const [key, value] of Object.entries(thing)) {
    clone[key] = ownArgs(value, seen)
  }
  return clone
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
    const augmented = await this.augmentLocationObjects(
      args as Record<string, unknown>,
      rpcDriverClassName,
    )
    return {
      ...augmented,
      blobMap: getBlobMap(),
    }
  }

  protected async renameRegions<T extends RenameRegionsArgs>(
    args: T,
  ): Promise<T> {
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
    // Unwrap rpcResult if present (needed for MainThreadRpcDriver where the
    // rpcResult wrapper isn't stripped by the worker message handler)
    return isRpcResult(serializedReturn)
      ? serializedReturn.value
      : serializedReturn
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
    // FileHandleLocations or UriLocations inside. Own the rest of the tree (see
    // ownArgs) so blob conversion and auth augmentation mutate owned data, never
    // the read-only config snapshots that flow in through readConfObject.
    const { renderingProps, ...rest } = thing
    const owned = ownArgs(rest) as Record<string, unknown>

    const uris: UriLocation[] = []
    walkLocationObjects(owned, {
      blobMap: needsFileHandles ? getBlobMap() : undefined,
      uris: needsUris ? uris : undefined,
    })

    for (const uri of uris) {
      await this.serializeNewAuthArguments(uri, rpcDriverClassName)
    }

    if ('renderingProps' in thing) {
      owned.renderingProps = renderingProps
    }
    return owned
  }
}

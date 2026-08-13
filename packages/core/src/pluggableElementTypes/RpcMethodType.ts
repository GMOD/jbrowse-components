import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { renameRegionsIfNeeded } from '../util/index.ts'
import { resolveUriLocation } from '../util/io/index.ts'
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
import PluggableElementBase from './PluggableElementBase.ts'

import type PluginManager from '../PluginManager.ts'
import type { RpcExecuteReturn } from '../rpc/RpcRegistry.ts'
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

/**
 * Base for an RPC method. Parameterize with the method's own registry name —
 * `class CoreGetRegions extends RpcMethodType<'CoreGetRegions'>` — and `execute`
 * is then checked against that entry's declared `return` (bare or wrapped in
 * rpcResult), so the registry stays an assertion about the worker rather than a
 * hand-maintained guess. Left unparameterized, `execute` resolves to `unknown`
 * as before; that's the escape hatch for a method whose worker-side shape
 * intentionally differs from what the client sees because `deserializeReturn`
 * transforms it (CoreGetFeatures, BreakpointGetFeatures).
 */
export default abstract class RpcMethodType<
  MethodName extends string = string,
> extends PluggableElementBase {
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

  /**
   * The root model to resolve internet accounts against, but only while it is
   * still attached to its tree. An RPC's promise can settle after the session it
   * belongs to is gone — jbrowse-web loading a new session, or a headless
   * renderer (jbrowse-img) destroying its model once the SVG is out — and
   * reading `internetAccounts` off a destroyed node logs an MST dead-node
   * warning for work whose result is already discarded. A torn-down root has no
   * accounts to consult, so it reads as "none" rather than as an error.
   */
  private get authRootModel() {
    const rootModel = this.pluginManager.rootModel
    // a non-node root (an embedded host's duck-typed object, a test fake) can't
    // be dead, so only real nodes get the liveness check
    const alive = !isStateTreeNode(rootModel) || isAlive(rootModel)
    return isAppRootModel(rootModel) && alive ? rootModel : undefined
  }

  async serializeNewAuthArguments(
    loc: UriLocation,
    _rpcDriverClassName: string,
  ) {
    const rootModel = this.authRootModel

    // args dont need auth or already have auth
    if (!rootModel || loc.internetAccountPreAuthorization) {
      return loc
    }

    // Resolved, because both halves below read the uri as a URL: the account is
    // matched on host or URL prefix, and validating the token means probing the
    // resource. A uri relative to a baseUri is neither until it is resolved.
    // The pre-authorization still lands on `loc` as it stands — the worker
    // resolves against the same baseUri when it opens the location.
    const resolved = resolveUriLocation(loc)
    const account = rootModel.findAppropriateInternetAccount(resolved)

    if (account) {
      loc.internetAccountPreAuthorization =
        await account.getPreAuthorizationInformation(resolved)
    }
    return loc
  }

  /**
   * The far side of `serializeArguments`, and **every `execute` must call it**
   * — `rpcDeserializeArguments.test.ts` fails for one that doesn't.
   *
   * Nothing calls it for you: the worker entry point invokes `execute` directly
   * (`product-core/src/rpcWorker.ts`), so an `execute` that reads `args`
   * straight through simply skips this step. What it skips is the blob map,
   * which is how a `BlobLocation` — a file the user opened from their disk —
   * resolves to a `File` in the worker realm. Subclasses add to it: the
   * filters-and-regions base turns the on-wire `string[]` back into a
   * `SerializableFilterChain` here.
   *
   * Skipping it *looks* harmless, which is the problem. The blob map is a
   * module global in the worker, so whichever RPC deserialized last leaves one
   * behind and the next method to skip this reads that one — right, usually, by
   * accident. It goes wrong when the map it inherits is not the current one:
   * `setBlobMap` replaces wholesale, and a worker that died and re-booted (the
   * pool drops and re-boots the slot) starts with none at all.
   *
   * The only methods exempt are the ones with no adapter config and no
   * locations in their arguments at all — `CoreFreeResources` frees caches by
   * session id and has nothing to resolve — and that exemption is declared in
   * the test rather than inferred.
   */
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
  ): Promise<RpcExecuteReturn<MethodName>>

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
    const needsFileHandles = hasFileHandlesInCache()
    const needsUris = !!this.authRootModel?.internetAccounts.length

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

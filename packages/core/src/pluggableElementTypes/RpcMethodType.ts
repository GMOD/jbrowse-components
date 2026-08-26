import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { renameRegionsIfNeeded } from '../util/index.ts'
import { resolveUriLocation } from '../util/io/index.ts'
import { unwrapRpcResult } from '../util/rpc.ts'
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
import type {
  RpcCallContext,
  RpcCallReturn,
  RpcExecuteArgs,
  RpcSession,
  RpcWireReturn,
} from '../rpc/RpcRegistry.ts'
import type { Region } from '../util/index.ts'
import type { FileHandleLocation, UriLocation } from '../util/types/index.ts'

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

// the arg shape renameRegions (and RpcMethodTypeWithRenameRegions) operate on —
// the serialize-side twin of RpcExecuteArgs, so composed from the same
// RpcCallContext rather than restating its three fields
export type RenameRegionsArgs = RpcCallContext & {
  assemblyName?: string
  regions?: Region[]
  adapterConfig: Record<string, unknown>
}

// singular-region counterpart, for RpcMethodTypeWithRenameRegion
export type RenameRegionArgs = RpcSession & {
  region: Region
  adapterConfig: Record<string, unknown>
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
    // collapses to {} and SAB-based stop tokens silently stop working. Nothing
    // we ship mints one (see `stopToken.ts`, "Which path runs where"), so this
    // arm is correctness for an isolated embedding host and nothing else —
    // keep it, but it is not a hot path and never was.
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
// in via readConfObject.
//
// **`structuredClone` is not the simplification it looks like, and the reason is
// production rather than the test realm.** These args still carry the
// `statusCallback`: `BaseRpcDriver.call` strips it from serialization's OUTPUT,
// deliberately and with its own comment saying so, because resolving a refName
// map downloads an index and that download has to have somewhere to report. A
// function is not cloneable, so a real structuredClone would throw
// DataCloneError on every call a display makes.
//
// So: non-cloneable leaves (functions, Errors) and structured-clone natives
// (typed arrays, Blobs, the SAB stop token...) pass through by reference
// unchanged. A genuinely non-cloneable value that leaked in by mistake is still
// caught — at the worker postMessage boundary, which is a real structuredClone.
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
 * as before; that's the escape hatch, and it should be rare.
 *
 * The name is checked twice over, because parameterizing used to be a claim
 * rather than a fact: it must be a key of the registry (a miss lands on
 * {@link NotInRpcRegistry} instead of quietly on `unknown`), and it must be the
 * key this class sets as its {@link name}. Both are compile errors, so the
 * escape hatch is the only way to end up unchecked, and taking it is visible.
 *
 * A method whose worker sends something other than the registry `return` — a
 * result wrapped in `rpcResult` to hand its buffers to postMessage, or one
 * `deserializeReturn` rebuilds — says so in the registry entry, beside the
 * `return` it has to be read against. There is deliberately no second type
 * parameter for it. As one it was a copy of the registry rather than a
 * reference to it, and fifteen classes kept the copy in step by hand.
 *
 * The name is the ONLY parameter, and that is what makes this shape uniform:
 * a second one survives only where a base is still GENERIC over its name, since
 * `RpcWireReturn<MethodName>` is then a conditional TypeScript will not resolve
 * and the shared body has nothing to check against. Such a base has to pin the
 * wire return by hand and constrain `MethodName` to keep the pin honest — which
 * is a mechanism, and the last one that needed it was sharing a three-line
 * delegation two subclasses could each just write (see `runDiagonalize` in
 * @jbrowse/synteny-core). Share an RPC body as a FUNCTION, not as a base
 * generic over the key.
 *
 * The way back is {@link deserializeReturn}, checked against the same entry's
 * `return`.
 */
export default abstract class RpcMethodType<
  MethodName extends string = string,
> extends PluggableElementBase {
  /**
   * The key this method is registered under, and the same one the class is
   * parameterized with — `pluginManager.getRpcMethodType` looks it up by this
   * string, so it is what a caller's `rpcManager.call` names.
   *
   * Narrowed to `MethodName` because the parameter was otherwise a claim about
   * a method that nothing checked was this one: `RpcMethodType<'A'>` with
   * `name = 'B'` type-checked, and then `execute` was checked against B's
   * registry entry while the worker ran it for A. Not hypothetical here —
   * `GetPileupFeatureDetails` and `GetCanvasFeatureDetails` are two registry
   * keys held by two same-bodied classes both called `GetFeatureDetails`.
   *
   * A class field initializer is not contextually typed by the base property,
   * so a parameterized subclass writes `name = 'CoreGetRegions' as const`.
   * Omitting the `as const` is a compile error on `name`, which is the point:
   * the tie is either made or reported, never silently absent. Unparameterized
   * subclasses keep plain `string` and need nothing.
   */
  declare name: MethodName

  pluginManager: PluginManager

  constructor(pluginManager: PluginManager) {
    super()
    this.pluginManager = pluginManager
  }

  async serializeArguments(args: object): Promise<Record<string, unknown>> {
    const augmented = await this.augmentLocationObjects(
      args as Record<string, unknown>,
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

  async serializeNewAuthArguments(loc: UriLocation) {
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
   * What both drivers call: deserialize, then `execute`.
   *
   * Each `execute` used to open with the deserialize call itself, and eleven
   * methods across seven plugins had silently drifted off it. `RpcExecuteArgs`
   * describes the DESERIALIZED shape — an entry declares `filters?:
   * SerializableFilterChain` where the wire carries a `string[]` — so skipping
   * it made the declared type false rather than erroring. Here it is true by
   * construction.
   */
  async invoke(
    serializedArgs: RpcExecuteArgs<MethodName>,
  ): Promise<RpcWireReturn<MethodName>> {
    return this.execute(await this.deserializeArguments(serializedArgs))
  }

  /**
   * The far side of `serializeArguments`; {@link invoke} calls it. Override to
   * add to the step, not to call it — and **an override must tolerate running
   * twice on the same object**, since an external plugin written against the
   * older contract still calls it from its own `execute`.
   */
  async deserializeArguments<T>(args: T): Promise<T> {
    // read off rather than named in the parameter type: for a driver holding an
    // unparameterized RpcMethodType, RpcExecuteArgs<string> is `unknown`, and
    // intersecting a blobMap into that rejects everything else
    const { blobMap } = args as { blobMap?: Record<string, File> }
    if (blobMap) {
      setBlobMap(blobMap)
    }

    return args
  }

  /**
   * The args are {@link RpcExecuteArgs} rather than `unknown` so that a method
   * parameterized with its own name has BOTH ends checked against the registry.
   * The return has been checked for a while; the args were hand-written in each
   * of 45 subclasses, which is the asymmetry that let them drift — and the drift
   * is not cosmetic, because the two handles every method receives are the two
   * an author who did not write them down never forwards.
   *
   * `CoreGetExportData` is the worked example: the stop token and status
   * callback arrived on every call and its `execute` destructured neither, so
   * the Save-track-data dialog's cancel did nothing and its progress never moved
   * on the adapter-export branch. Nothing was mistyped — the fields simply were
   * not in a signature anyone read.
   */
  abstract execute(
    serializedArgs: RpcExecuteArgs<MethodName>,
  ): Promise<RpcWireReturn<MethodName>>

  /**
   * The wire shape, rebuilt into what the caller of `rpcManager.call` holds —
   * the registry entry's `return`. Overridden by the three methods whose two
   * differ (features travel serialized and arrive as `SimpleFeature`s); for
   * everyone else the whole job is taking off the `rpcResult` envelope, which
   * MainThreadRpcDriver needs because nothing stripped it on that path.
   *
   * The registry `return` is checked against `execute` on the way in (through
   * {@link RpcWireReturn}) and this is what checks it on the way back out. It
   * checks covariantly, so unlike the arguments it cannot be widened past.
   *
   * An override calls {@link unwrapRpcResult} rather than `super`, because the
   * envelope is all it wants and `super` now promises the rebuilt value it is
   * the one rebuilding. The cast below is the claim that stands for every
   * method that does NOT override: unwrapped wire is the declared `return`.
   * True by construction for a `transferables: true` or bare entry, since both
   * derive their wire from that `return`; an explicit `wire:` restates, so it
   * is the one that has to override or agree.
   */
  async deserializeReturn(
    serializedReturn: RpcWireReturn<MethodName>,
    _args: unknown,
  ): Promise<RpcCallReturn<MethodName>> {
    return unwrapRpcResult(serializedReturn) as RpcCallReturn<MethodName>
  }

  private async augmentLocationObjects(thing: Record<string, unknown>) {
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
      await this.serializeNewAuthArguments(uri)
    }

    if ('renderingProps' in thing) {
      owned.renderingProps = renderingProps
    }
    return owned
  }
}

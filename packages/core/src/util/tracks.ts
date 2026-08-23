// Re-exported because `@jbrowse/core/util/tracks` is the path plugins import it
// from. It must come first: `../configuration` imports the util barrel, which
// imports this module back, and a re-export declared after that cycle has a
// getter that fires before its own require has run.
export { getFileName } from './getFileName.ts'

import {
  getParent,
  getSnapshot,
  isRoot,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'
import { observable, runInAction, untracked } from 'mobx'

import {
  isConfigurationSlot,
  preProcessSlotValues,
  readConfObject,
} from '../configuration/index.ts'
import {
  getFileHandle,
  storeFileHandle,
  verifyPermission,
} from './fileHandleStore.ts'
import { getFileName } from './getFileName.ts'
import {
  getContainingView,
  getEnv,
  getSession,
  objectHash,
} from './mstUtils.ts'
import { isViewModel } from './types/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  BlobLocation,
  FileHandleLocation,
  FileLocation,
  PreFileLocation,
} from './types/data.ts'
import type {
  IAnyStateTreeNode,
  IAnyType,
  IStateTreeNode,
  Instance,
  types,
} from '@jbrowse/mobx-state-tree'

// Deliberately uncached. This used to memoize on a permanent WeakMap keyed by
// track, but every caller reads it from inside a reactive getter or autorun: the
// memo meant the reaction never subscribed to the config, so editing
// assemblyNames in the config editor did not invalidate it. The reads are
// per-view-change, not per-feature, so MobX's own computed caching is enough.
export function getTrackAssemblyNames(
  track: IStateTreeNode & { configuration: AnyConfigurationModel },
) {
  return getConfAssemblyNames(track.configuration)
}

/**
 * What {@link canonicalAssemblyNames} needs of an assembly manager — the one
 * method — so a picker that only resolves names says so in its signature and a
 * test can stand in for it without building a session.
 */
export interface AssemblyNameResolver {
  getCanonicalAssemblyName: (name: string) => string | undefined
}

/**
 * {@link AssemblyNameResolver} plus the presence test, for a picker that also
 * has to screen out names the session cannot open at all.
 *
 * The screen is `has`, deliberately, and not
 * `getCanonicalAssemblyName(name) !== undefined`: that reads `assemblyNameMap`,
 * which is built from assembly *models*, so it answers no during the window
 * where a config exists and the manager's afterAttach autorun hasn't built its
 * model yet — which is exactly when an import form first renders. `has` also
 * consults `assemblyNamesList`, read off the configs, so it covers both. See
 * assemblyManager's own note on the pair.
 */
export interface SessionAssemblies extends AssemblyNameResolver {
  has: (assemblyName: string) => boolean
}

/**
 * Assembly names as the aliases resolve them, so a track configured against
 * `hg38` compares equal to a view on `GRCh38`. Every "does this track belong to
 * these assemblies" test should run both sides through this, or the same track
 * is offered by one picker and hidden by another.
 *
 * A name the assembly manager doesn't know is kept **as written**, not dropped.
 * Dropping it means "matches nothing" on the track side but "no constraint at
 * all" on the list side, and those disagree; kept, both sides compare the same
 * raw string and matching degrades to the exact name — which is also the right
 * answer in the window before the assembly manager has built its models. Empty
 * names are dropped: a half-initialized view pads its assembly list with them.
 */
export function canonicalAssemblyNames(
  names: string[],
  assemblyManager: AssemblyNameResolver,
) {
  return names
    .filter(name => !!name)
    .map(name => assemblyManager.getCanonicalAssemblyName(name) ?? name)
}

/**
 * Whether two names name the same assembly, resolving aliases on both sides.
 *
 * The pairwise counterpart to {@link canonicalAssemblyNames}, for the two
 * places a list cannot be mapped: an index-aligned array, which that function's
 * empty-name filter would desync, and a comparison where one side must come
 * back in the caller's own spelling rather than the canonical one.
 *
 * **Both sides, or it buys nothing.** The names meeting at these comparisons
 * come from different places — a view holds what the session opened it on, a
 * track config holds what its author wrote, and a synteny mate holds whatever
 * the adapter resolved a PanSN prefix to. Any two of those can be aliases of
 * one assembly, and `===` says no.
 *
 * A name the assembly manager doesn't know compares as written, the same
 * degradation {@link canonicalAssemblyNames} makes and for the same reason: an
 * all-vs-all file carries sample names no config declares, and those still have
 * to compare equal to themselves.
 */
export function isSameAssemblyName(
  a: string | undefined,
  b: string | undefined,
  assemblyManager: AssemblyNameResolver,
) {
  if (!a || !b) {
    return false
  }
  return (
    a === b ||
    (assemblyManager.getCanonicalAssemblyName(a) ?? a) ===
      (assemblyManager.getCanonicalAssemblyName(b) ?? b)
  )
}

export function getConfAssemblyNames(conf: AnyConfigurationModel) {
  const trackAssemblyNames = readConfObject(conf, 'assemblyNames') as
    | string[]
    | undefined
  if (!trackAssemblyNames) {
    const parent = getParent<AnyConfigurationModel & { sequence?: unknown }>(
      conf,
    )
    if ('sequence' in parent) {
      return [readConfObject(parent, 'name') as string]
    } else {
      throw new Error('unknown assembly names')
    }
  }
  return trackAssemblyNames
}

/**
 * The `rpcSessionId` of the highest node at or above `thisNode` that declares
 * one — which webworker its work is routed to.
 *
 * The walk includes the root. It used to stop *before* it (`!isRoot(node)` as
 * the loop condition), which silently made a tree whose only rpcSessionId-
 * bearing node was the root throw "no parent node in the state tree has an
 * `rpcSessionId`". Nothing in the app hit that — the id lives on a track, deep
 * in the tree — but a test building a minimal session had to wrap it in a
 * throwaway root purely to dodge this.
 */
export function getRpcSessionId(thisNode: IAnyStateTreeNode) {
  interface NodeWithRpcSessionId extends IStateTreeNode {
    rpcSessionId: string
  }
  let highestRpcSessionId: string | undefined

  for (let node = thisNode; ; node = getParent<IAnyStateTreeNode>(node)) {
    if ('rpcSessionId' in node) {
      highestRpcSessionId = (node as NodeWithRpcSessionId).rpcSessionId
    }
    if (isRoot(node)) {
      break
    }
  }
  if (!highestRpcSessionId) {
    throw new Error(
      'getRpcSessionId failed, no parent node in the state tree has an `rpcSessionId` attribute',
    )
  }
  return highestRpcSessionId
}

export const UNKNOWN = 'UNKNOWN'
export const UNSUPPORTED = 'UNSUPPORTED'

let blobMap: Record<string, File> = {}

export function getBlob(id: string) {
  return blobMap[id]
}

export function getBlobMap() {
  return blobMap
}

// Populates the blobMap in a fresh JS realm (e.g. a web worker, which starts
// with an empty module-level blobMap). RPC args are the only channel into the
// worker, so the main thread ships its full blobMap and the worker replaces its
// own here before adapters call the synchronous getBlob() during openLocation.
export function setBlobMap(map: Record<string, File>) {
  blobMap = map
}

let counter = 0

// blob files are stored in a global map. the blobId is based on a combination
// of timestamp plus counter to be unique across sessions and fast repeated
// calls
export function storeBlobLocation(
  location: PreFileLocation,
): BlobLocation | PreFileLocation {
  if ('blob' in location) {
    const blobId = `b${Date.now()}-${counter++}`
    blobMap[blobId] = location.blob
    return {
      name: location.blob.name,
      blobId,
      locationType: 'BlobLocation' as const,
    }
  }
  return location
}

// openLocation is synchronous, so File objects are cached here after async handle
// resolution. Observable so an open LocalFileChooser reactively clears its "needs
// reload" notice once a restore (afterAttach / "Restore access") populates the
// cache; the worker/RPC readers run outside any reaction so nothing else
// subscribes.
const fileHandleCache = observable.map<string, File>()

export function getFileFromCache(handleId: string) {
  return fileHandleCache.get(handleId)
}

export function setFileInCache(handleId: string, file: File) {
  runInAction(() => {
    fileHandleCache.set(handleId, file)
  })
}

export function clearFileFromCache(handleId: string) {
  runInAction(() => {
    fileHandleCache.delete(handleId)
  })
}

export function hasFileHandlesInCache() {
  // read in RpcMethodType.serializeArguments, which an RPC-fetch autorun can
  // reach; untracked so populating the cache never re-triggers that autorun
  return untracked(() => fileHandleCache.size > 0)
}

export async function ensureFileHandleReady(
  handleId: string,
  requestPermission = true,
) {
  const cached = fileHandleCache.get(handleId)
  if (cached) {
    return cached
  }

  const handle = await getFileHandle(handleId)
  if (!handle) {
    throw new Error(
      `File handle not found for handleId: ${handleId}. The file may have been opened in a different browser or the IndexedDB was cleared.`,
    )
  }

  const hasPermission = await verifyPermission(handle, requestPermission)
  if (!hasPermission) {
    throw new Error(
      `Permission denied for file "${handle.name}". Click "Restore access" to grant permission.`,
    )
  }

  const file = await handle.getFile()
  setFileInCache(handleId, file)
  return file
}

export async function storeFileHandleLocation(
  handle: FileSystemFileHandle,
): Promise<FileHandleLocation> {
  const handleId = await storeFileHandle(handle)
  const file = await handle.getFile()
  setFileInCache(handleId, file)
  return {
    locationType: 'FileHandleLocation',
    name: handle.name,
    handleId,
  }
}

async function settleFileHandle(handleId: string, requestPermission: boolean) {
  try {
    await ensureFileHandleReady(handleId, requestPermission)
    return { handleId, success: true as const }
  } catch (error) {
    return { handleId, success: false as const, error }
  }
}

/**
 * Resolves a batch of stored file handles, one result per id.
 *
 * With `requestPermission` set these run ONE AT A TIME, and that is the whole
 * point of the branch. `requestPermission()` needs transient user activation and
 * the browser puts a single file-access prompt on screen at a time, so N of them
 * fired off one "Restore access" click means the first call takes the prompt and
 * the rest are refused without the user ever seeing a dialog — files reported
 * back as permission failures that nobody was asked about. Taking turns, each
 * prompt waits for the one before it to be answered, and whatever the activation
 * window no longer covers is simply still pending for the next click instead of
 * being spent.
 *
 * Without it nothing can prompt, so there is nothing to take turns over and the
 * batch runs at once.
 */
export async function restoreFileHandles(
  handleIds: string[],
  requestPermission = false,
) {
  if (!requestPermission) {
    return Promise.all(handleIds.map(id => settleFileHandle(id, false)))
  }
  const results: Awaited<ReturnType<typeof settleFileHandle>>[] = []
  for (const handleId of handleIds) {
    results.push(await settleFileHandle(handleId, true))
  }
  return results
}

export function findFileHandleIds(obj: unknown) {
  const handleIds = new Set<string>()
  const seen = new WeakSet<object>()
  function walk(o: unknown) {
    if (!o || typeof o !== 'object' || seen.has(o)) {
      return
    }
    seen.add(o)
    if (Array.isArray(o)) {
      for (const item of o) {
        walk(item)
      }
    } else {
      const record = o as Record<string, unknown>
      if (
        record.locationType === 'FileHandleLocation' &&
        typeof record.handleId === 'string'
      ) {
        handleIds.add(record.handleId)
      }
      for (const value of Object.values(record)) {
        walk(value)
      }
    }
  }
  walk(obj)
  return handleIds
}

export async function restoreFileHandlesFromSnapshot(
  sessionSnapshot: unknown,
  requestPermission = false,
) {
  return restoreFileHandles(
    [...findFileHandleIds(sessionSnapshot)],
    requestPermission,
  )
}

/**
 * creates a new location from the provided location including the appropriate
 * suffix and location type
 *
 * @param location - the FileLocation
 * @param suffix - the file suffix (e.g. .bam)
 * @returns the constructed location object from the provided parameters
 */
export function makeIndex(location: FileLocation, suffix: string) {
  if ('uri' in location) {
    return {
      uri: location.uri + suffix,
      locationType: 'UriLocation',
      // carry the parent's baseUri so a derived sibling index resolves against
      // the same config location as the file it indexes
      ...(location.baseUri ? { baseUri: location.baseUri } : {}),
    }
  } else if ('localPath' in location) {
    return {
      localPath: location.localPath + suffix,
      locationType: 'LocalPathLocation',
    }
  } else {
    return location
  }
}

/**
 * constructs a potential index file (with suffix) from the provided file name
 *
 * @param name - the name of the index file
 * @param typeA - one option of a potential two file suffix (e.g. CSI, BAI)
 * @param typeB - the second option of a potential two file suffix (e.g. CSI, BAI)
 * @returns a likely name of the index file for a given filename
 */
export function makeIndexType(
  name: string | undefined,
  typeA: string,
  typeB: string,
) {
  return name?.toUpperCase().endsWith(typeA) ? typeA : typeB
}

/**
 * The `index` block a tabix-indexed adapter's guess writes: where the index is,
 * and which of the two kinds it is.
 *
 * Eight guessers spelled this pair out by hand, which is the crossed-pair hazard
 * `tabixIndexSnapshot` was extracted for on the config side: a `.csi` location
 * filed under `indexType: 'TBI'` is a valid-looking config that opens no index
 * at all, and nothing downstream can tell it from a correct one.
 *
 * BAM is deliberately not here, for the reason `tabixIndexFields` gives: BAI/CSI
 * is a different enumeration over a different default, and folding the two would
 * mean a slot whose vocabulary depends on its adapter.
 */
export function guessTabixIndex(
  file: FileLocation,
  index: FileLocation | undefined,
) {
  return {
    location: index ?? makeIndex(file, '.tbi'),
    indexType: makeIndexType(index && getFileName(index), 'CSI', 'TBI'),
  }
}

export interface AdapterConfig {
  type: string
  [key: string]: unknown
}

export type AdapterGuesser = (
  file: FileLocation,
  index?: FileLocation,
  adapterHint?: string,
) => AdapterConfig | undefined

export type TrackTypeGuesser = (
  adapterName: string,
  file?: FileLocation,
) => string | undefined

// Both guess points are accumulator-of-functions: each callback receives the
// previously-registered guesser and returns a new one that either matches the
// file itself or delegates to its predecessor (chain of responsibility). Typing
// them here removes the `as AdapterGuesser`/`as TrackTypeGuesser` casts at every
// fire site and gives plugin callbacks a checked signature.
declare module '../PluginManager.ts' {
  interface ExtensionPointRegistry {
    'Core-guessAdapterForLocation': {
      args: AdapterGuesser
      result: AdapterGuesser
    }
    'Core-guessTrackTypeForLocation': {
      args: TrackTypeGuesser
      result: TrackTypeGuesser
    }
  }
}

/**
 * Register a guess on `Core-guessAdapterForLocation`. Return an adapter config
 * to claim the file, or `undefined` to defer to the plugins registered before
 * this one.
 *
 * Prefer this over calling `addToExtensionPoint` directly: the chaining is done
 * once here, so a plugin cannot break the chain by forgetting to delegate, nor
 * drop an argument on the way through.
 */
export function addAdapterGuesser(
  pluginManager: PluginManager,
  guess: AdapterGuesser,
) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    next => (file, index, adapterHint) =>
      guess(file, index, adapterHint) ?? next(file, index, adapterHint),
  )
}

/**
 * Register a guess on `Core-guessTrackTypeForLocation`. Return a track type
 * name to claim the adapter, or `undefined` to defer. See `addAdapterGuesser`
 * for why this wrapper exists — hand-written delegates here used to drop the
 * optional `file`, which hid it from every guesser registered earlier in the
 * chain.
 */
export function addTrackTypeGuesser(
  pluginManager: PluginManager,
  guess: TrackTypeGuesser,
) {
  pluginManager.addToExtensionPoint(
    'Core-guessTrackTypeForLocation',
    next => (adapterName, file) =>
      guess(adapterName, file) ?? next(adapterName, file),
  )
}

const COMPRESSION_SUFFIXES = ['.gz', '.bgz', '.bz2', '.zst']

/**
 * Drop the format extension from a filename, plus any compression suffix, so
 * `volvox.vcf.gz` becomes `volvox` rather than `volvox.vcf`. Names with no
 * extension, and dotfiles, are returned unchanged.
 */
export function stripFileExtension(name: string) {
  const lower = name.toLowerCase()
  const base = COMPRESSION_SUFFIXES.some(suffix => lower.endsWith(suffix))
    ? name.slice(0, name.lastIndexOf('.'))
    : name
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

export function guessAdapter(
  file: FileLocation,
  index: FileLocation | undefined,
  adapterHint?: string,
  model?: IAnyStateTreeNode,
) {
  if (model) {
    const { pluginManager } = getEnv(model)
    const adapterGuesser = pluginManager.evaluateExtensionPoint(
      /** #extensionPoint Core-guessAdapterForLocation | sync | Guess an adapter config from a file location */
      'Core-guessAdapterForLocation',
      () => undefined,
    )

    const adapter = adapterGuesser(file, index, adapterHint)
    if (adapter) {
      return adapter
    }
  }

  return {
    type: UNKNOWN,
  }
}

export function guessTrackType(
  adapterType: string,
  model?: IAnyStateTreeNode,
  file?: FileLocation,
): string {
  if (model) {
    const session = getSession(model)

    const trackTypeGuesser = getEnv(
      session,
    ).pluginManager.evaluateExtensionPoint(
      /** #extensionPoint Core-guessTrackTypeForLocation | sync | Guess a track type from a file location */
      'Core-guessTrackTypeForLocation',
      () => undefined,
    )

    const trackType = trackTypeGuesser(adapterType, file)
    if (trackType) {
      return trackType
    }
  }
  return 'FeatureTrack'
}

export interface LooseTrackInput {
  uri: string
  index?: string
  [key: string]: unknown
}

/**
 * Expand a loose track description — a bare data-file URI, or an object with
 * `uri` (and optional `index`) plus any extra config keys — into a full track
 * config, the same inference the "Add track" flow does: the adapter and track
 * type are guessed from the file via the format plugins, a stable `trackId` and
 * a `name` are derived from the filename, and the assembly is stamped on. Extra
 * keys on the input (`name`, `category`, `displays`, ...) override the inferred
 * defaults. Takes a `pluginManager` (not a model) so it runs headlessly — in a
 * worker/Node export as well as the browser. Throws when no format matches, so
 * the caller can ask for a full config instead.
 */
export function guessTrackConf(
  input: string | LooseTrackInput,
  pluginManager: PluginManager,
  assemblyName?: string,
) {
  const { uri, index, ...extra } =
    typeof input === 'string' ? { uri: input } : input
  const file = { uri, locationType: 'UriLocation' } as const
  const indexLocation = index
    ? ({ uri: index, locationType: 'UriLocation' } as const)
    : undefined
  const adapterGuesser = pluginManager.evaluateExtensionPoint(
    'Core-guessAdapterForLocation',
    () => undefined,
  )
  const adapter = adapterGuesser(file, indexLocation, undefined)
  if (!adapter || adapter.type === UNKNOWN) {
    throw new Error(
      `could not infer a track type from "${uri}"; pass a full track config instead`,
    )
  }
  const trackTypeGuesser = pluginManager.evaluateExtensionPoint(
    'Core-guessTrackTypeForLocation',
    () => undefined,
  )
  const name = getFileName(file)
  return {
    trackId: `${name}-${objectHash(adapter).slice(0, 8)}`,
    type: trackTypeGuesser(adapter.type, file) ?? 'FeatureTrack',
    name,
    assemblyNames: assemblyName ? [assemblyName] : [],
    adapter,
    ...extra,
  }
}

function generateProblemTrackConf(
  trackName: string,
  categories: string[] | undefined,
  label: string,
  description: string,
) {
  const conf = {
    type: 'FeatureTrack',
    name: `${trackName} (${label})`,
    description,
    category: categories,
    trackId: '',
  }
  conf.trackId = objectHash(conf)
  return conf
}

export function generateUnsupportedTrackConf(
  trackName: string,
  trackUrl: string,
  categories: string[] | undefined,
) {
  return generateProblemTrackConf(
    trackName,
    categories,
    'Unsupported',
    `Support not yet implemented for "${trackUrl}"`,
  )
}

export function generateUnknownTrackConf(
  trackName: string,
  trackUrl: string,
  categories?: string[],
) {
  return generateProblemTrackConf(
    trackName,
    categories,
    'Unknown',
    `Could not determine track type for "${trackUrl}"`,
  )
}

export function getTrackName(
  conf:
    | AnyConfigurationModel
    | { name?: string; type?: string; trackId?: string },
  session: { assemblies: AnyConfigurationModel[] },
): string {
  const isMst = isStateTreeNode(conf)
  const trackName = isMst
    ? (readConfObject(conf, 'name') as string)
    : (conf.name ?? '')
  const trackType = isMst ? (readConfObject(conf, 'type') as string) : conf.type
  if (!trackName && trackType === 'ReferenceSequenceTrack') {
    const asm = session.assemblies.find(a => a.sequence === conf)
    return asm
      ? `Reference sequence (${
          readConfObject(asm, 'displayName') || readConfObject(asm, 'name')
        })`
      : 'Reference sequence'
  }
  const trackId = isMst
    ? (readConfObject(conf, 'trackId') as string)
    : (conf.trackId ?? '')
  return trackName || trackId
}

type MSTArray<T extends IAnyType> = Instance<ReturnType<typeof types.array<T>>>

interface MinimalTrack extends IAnyType {
  configuration: { trackId: string }
}

interface GenericView {
  type: string
  tracks: MSTArray<MinimalTrack>
}

/**
 * The display-snapshot argument of `showTrackGeneric`, exported so a view's own
 * `showTrack` can annotate its parameter with it rather than approximate it.
 * `Record<string, unknown>` is the approximation that reads as equivalent and is
 * not: it rejects the precise snapshot interfaces callers legitimately pass,
 * which have no index signature — the same hazard the `initialSnapshot`
 * parameter's `object` annotation exists to avoid.
 */
export interface DisplayInitialSnapshot {
  type?: string
  [key: string]: unknown
}

interface DisplayConfSnapshot {
  type: string
  displayId?: string
}

/**
 * Which display a track opens with in a given view, and the display config that
 * display must use: `{ type, conf }`, or undefined when the view supports none
 * of the track's displays.
 *
 * Two decisions, in this order, and the order is the point. The **type** is what
 * the caller asked for, else the track's first declared display the view
 * supports, else the track type's first supported display. The **config** is
 * then whichever declared entry has that type — never "the first supported one",
 * which is what let a display be created wearing another display's config node
 * (a multi-sample VCF declares both the matrix and the regular display, so the
 * regular one inherited the matrix's 20px connector-line zone and drew its
 * clustering tree offset from the rows it labels). `display.type ===
 * display.configuration.type` is the invariant `DisplayConfigurationReference`
 * already assumes when it falls back to resolving a display config by type; this
 * is where it has to hold.
 *
 * `conf` is undefined when the track config declares no entry of that type;
 * `baseTrackConfig.preProcessSnapshot` injects one for every registered display
 * type, so the caller's `${trackId}-${type}` id resolves to it.
 */
/**
 * The display type names a view can render, as a lookup set. Built once per
 * view and handed to {@link viewCanDisplayTrack} for every track, rather than
 * rebuilt per track.
 */
export function viewDisplayNames(
  pluginManager: PluginManager,
  viewType: string,
) {
  return new Set(
    pluginManager.getViewType(viewType).displayTypes.map(d => d.name),
  )
}

/**
 * Whether a view rendering `viewDisplays` can open a track of this type at all
 * — does the track type declare a display the view draws. The coarse half of
 * the question {@link pickDisplayForView} answers precisely: a picker that
 * offers a track this says no to is offering one `showTrackGeneric` will
 * refuse.
 *
 * Reads the *track type's* registered displays rather than a config's own
 * `displays` array, which is both cheaper and the only form available on an
 * un-hydrated frozen track config (ADR-032). The two agree, since
 * `preprocessTrackConfigSnapshot` injects a stub display for every display the
 * track type registers.
 *
 * Two answers that are easy to get wrong, and both have been:
 *
 * - A type **no plugin registered** answers false rather than throwing.
 *   `getTrackType` throws on an unknown name, and a frozen track config never
 *   passes the schema that would have rejected it at load — so a config naming
 *   a plugin that failed to load put that throw inside whatever loop was
 *   filtering tracks, and one unopenable track took out the entire list. The
 *   track selector and jb2export's circular-view filter met this separately.
 * - A view type registering **no displays at all** constrains nothing, so
 *   every track passes. That is a policy rather than a fact, and it lives here
 *   so the pickers agree on it.
 */
export function viewCanDisplayTrack(
  pluginManager: PluginManager,
  viewDisplays: Set<string>,
  trackType: string,
) {
  if (!pluginManager.trackTypes.has(trackType)) {
    return false
  }
  return (
    viewDisplays.size === 0 ||
    pluginManager
      .getTrackType(trackType)
      .displayTypes.some(d => viewDisplays.has(d.name))
  )
}

export function pickDisplayForView({
  declaredDisplays,
  requestedType,
  trackDisplayTypes,
  viewDisplayTypes,
}: {
  declaredDisplays: DisplayConfSnapshot[]
  requestedType: string | undefined
  trackDisplayTypes: string[]
  viewDisplayTypes: string[]
}) {
  const supported = new Set(viewDisplayTypes)
  const type =
    requestedType ??
    declaredDisplays.find(d => supported.has(d.type))?.type ??
    trackDisplayTypes.find(name => supported.has(name))
  return type === undefined
    ? undefined
    : { type, conf: declaredDisplays.find(d => d.type === type) }
}

// #region trackInit
export type TrackInit =
  | string
  | {
      trackId: string
      // rarely-needed escape hatches: `trackSnapshot` applies to the track
      // config node, `displaySnapshot` explicitly to the display node. Any
      // OTHER key on this object is treated as a display-snapshot prop, so the
      // common case sets display options inline with no nesting:
      // `{ trackId, showDescriptions: false }` rather than
      // `{ trackId, displaySnapshot: { showDescriptions: false } }`.
      trackSnapshot?: Record<string, unknown>
      displaySnapshot?: Record<string, unknown>
      [key: string]: unknown
    }
// #endregion

// Resolve a session-spec `TrackInit` into the (trackId, trackSnapshot,
// displaySnapshot) triple that `showTrackGeneric` expects. Display props written
// inline on the track object (everything except trackId/trackSnapshot/
// displaySnapshot) fold into the display snapshot, so a spec can write
// `{ trackId, showDescriptions: false }` instead of nesting under
// `displaySnapshot`. An explicit `displaySnapshot` still wins over an inline
// key of the same name, and the older nested form keeps working unchanged.
// `showTrackGeneric` then routes any inline key that is a real config slot (e.g.
// `forceLoad`) onto the display config, so a session spec can declaratively
// force-load a track with `{ trackId, forceLoad: true }`.
export function normalizeTrackInit(t: TrackInit) {
  if (typeof t === 'string') {
    return { trackId: t, trackSnapshot: {}, displaySnapshot: {} }
  } else {
    const { trackId, trackSnapshot, displaySnapshot, ...rest } = t
    return {
      trackId,
      trackSnapshot: trackSnapshot ?? {},
      displaySnapshot: { ...rest, ...displaySnapshot },
    }
  }
}

export function showTrackGeneric(
  self: GenericView,
  trackId: string,
  // `object`, annotated, rather than inferred from the default. A bare `{}`
  // accepts every non-nullish value, numbers included, which is how a synteny
  // level index typechecked its way into a track snapshot — see the dotplot and
  // comparative views' own `showTrack`, whose second parameter is this one.
  //
  // `object` and not `Record<string, unknown>`: the hazard is a primitive, and
  // an index signature additionally rejects the precise snapshot interfaces
  // callers legitimately pass (jbrowse-img's `DisplaySnapshot` is one).
  initialSnapshot: object = {},
  displayInitialSnapshot: DisplayInitialSnapshot = {},
  // The config itself, for a track no session list holds: a view that
  // synthesizes a track only it can draw passes the config here and it lives on
  // the track node, so closing the track takes the config with it. Without it
  // such a config has to be parked in a session list that outlives the view.
  inlineConf?: Record<string, unknown>,
) {
  const { pluginManager } = getEnv(self)
  const session = getSession(self)

  const found = self.tracks.find(t => t.configuration.trackId === trackId)
  if (found) {
    return found
  }

  // Single choke point for all "open a track" paths — errors surface as
  // snackbars. Config is validated before the push so the open set never holds
  // a broken track.
  try {
    const rawConf = inlineConf ?? session.getTrackById(trackId)
    if (!rawConf) {
      throw new Error(`Could not resolve identifier "${trackId}"`)
    }

    const confSnapshot = structuredClone(
      isStateTreeNode(rawConf) ? getSnapshot(rawConf) : rawConf,
    )
    const conf = pluginManager.evaluateExtensionPoint(
      'Core-preProcessTrackConfig',
      confSnapshot,
    ) as typeof rawConf

    const trackType = pluginManager.getTrackType(conf.type)
    // Validate only a conf that is not already in the tree. `configSchema.create`
    // here builds an entire config node and throws it away purely to surface a
    // nice error; its preProcessSnapshot also re-runs Core-preProcessTrackConfig
    // on a snapshot this function just preprocessed. A conf that is a state tree
    // node was validated when MST created it, so all of that is pure waste on
    // the common showTrack path.
    if (!isStateTreeNode(rawConf)) {
      try {
        trackType.configSchema.create(conf, getEnv(self))
      } catch (e) {
        throw new Error(
          `Track "${trackId}" has an invalid configuration: ${e}`,
          { cause: e },
        )
      }
    }

    // A track container that isn't itself a view — a synteny level, which owns
    // a track list but has no width and no registered view type — takes the
    // display choice from the view it sits in, which is the same node
    // getContainingView already resolves to for everything else beneath it.
    const view = isViewModel(self) ? self : getContainingView(self)
    const viewType = pluginManager.getViewType(view.type)
    const picked = pickDisplayForView({
      declaredDisplays: conf.displays ?? [],
      requestedType: displayInitialSnapshot.type,
      trackDisplayTypes: trackType.displayTypes.map(d => d.name),
      viewDisplayTypes: viewType.displayTypes.map(d => d.name),
    })

    if (!picked) {
      throw new Error(
        `Could not find a compatible display for view type ${view.type}`,
      )
    }

    const { type: displayType, conf: displayConf } = picked
    const displayId = displayConf?.displayId ?? `${trackId}-${displayType}`

    const track = trackType.stateModel.create({
      ...initialSnapshot,
      type: conf.type,
      configuration: inlineConf ?? trackId,
      displays: [
        {
          ...displayConf,
          type: displayType,
          configuration: displayId,
          ...displayInitialSnapshot,
        },
      ],
    })
    self.tracks.push(track)

    // Display settings (height, color, …) are config slots now, not display
    // instance props — passed in the display snapshot they'd be dropped as
    // unknown MST keys. Route the ones that are real slots onto the persistent
    // display config so they take effect and survive hide/retick (#5591). Runs
    // after the push so the display's config reference can resolve.
    //
    // preProcessSlotValues first, so a display schema's shorthand expansions
    // and legacy-key migrations reach this path too: a session spec, share
    // link, or embed writes slots here rather than creating a config from a
    // snapshot, and those two surfaces are meant to speak the same vocabulary.
    const display = track.displays[0] as {
      configuration: AnyConfigurationModel
    }
    const displaySlots = preProcessSlotValues(
      display.configuration,
      displayInitialSnapshot,
    )
    for (const [key, value] of Object.entries(displaySlots)) {
      if (key !== 'type' && isConfigurationSlot(display.configuration, key)) {
        // the key comes from a snapshot at runtime, and setConf's slot name is
        // a compile-time type
        // eslint-disable-next-line no-restricted-syntax
        display.configuration.setSlot(key, value)
      }
    }
    // if this track came from a connection, persist its config so it survives
    // reload without re-establishing the connection (no-op otherwise)
    session.captureConnectionTrack?.(trackId)
    return track
  } catch (e) {
    session.notifyError(`${e}`, e)
    return undefined
  }
}

// The shape stripTrackIds walks, exported because a caller that TRANSFORMS the
// same track snapshots before handing them over needs to name it too (the
// collapsed-intron launch seeds a display's solo set on the way past).
export interface DisplaySnapshot {
  id: string
  [key: string]: unknown
}
export interface TrackSnapshot {
  id: string
  displays: DisplaySnapshot[]
  [key: string]: unknown
}

// Strip a track's identifier and its nested display identifiers (both are
// types.identifier) so a duplicated/copied snapshot doesn't collide with the
// source's ids when added back into the same session tree.
export function stripTrackIds(tracks: TrackSnapshot[]) {
  return tracks.map(({ id, displays, ...rest }) => ({
    ...rest,
    displays: displays.map(({ id, ...d }) => d),
  }))
}

export function hideTrackGeneric(self: GenericView, trackId: string) {
  const t = self.tracks.find(t => t.configuration.trackId === trackId)
  if (t) {
    self.tracks.remove(t)
    // drop the persisted connection-track config if no other view holds it
    // (persisted → guards saved-session size; the volatile working-copy cache
    // in SessionTracks is deliberately not pruned, see editableTrackConfigs)
    getSession(self).pruneConnectionTrackConfig?.(trackId)
    return true
  }
  return false
}

// Returns true if the track is now shown, false if it was hidden or failed to
// open (callers use this to e.g. record only newly-opened tracks as recent).
export function toggleTrackGeneric(self: GenericView, trackId: string) {
  return hideTrackGeneric(self, trackId)
    ? false
    : !!showTrackGeneric(self, trackId)
}

/**
 * Every track config the session can show, connection-supplied ones included.
 *
 * `session.tracks` is only sessionTracks plus the admin config (see
 * product-core's SessionTracks), so a track that arrived from a hub or registry
 * connection is absent from it while still being toggleable from the track
 * selector, which unions the same two sources. Anything answering "what tracks
 * exist for X" wants this, or a feature silently can't see connection tracks.
 *
 * Note `session.tracks` already contains `sessionTracks` — unioning those two
 * yields every session track twice.
 */
export function allSessionTracks(session: {
  tracks: AnyConfigurationModel[]
  connectionInstances?: { tracks: AnyConfigurationModel[] }[]
}) {
  const connectionTracks = (session.connectionInstances ?? []).flatMap(
    conn => conn.tracks,
  )
  return connectionTracks.length
    ? [...session.tracks, ...connectionTracks]
    : session.tracks
}

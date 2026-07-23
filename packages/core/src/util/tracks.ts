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
import { getEnv, getSession, objectHash } from './mstUtils.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  BlobLocation,
  FileHandleLocation,
  FileLocation,
  PreFileLocation,
} from './types/index.ts'
import type {
  IAnyStateTreeNode,
  IAnyType,
  Instance,
  types,
} from '@jbrowse/mobx-state-tree'

// Cache for track assembly names - keyed by track object to avoid
// repeated track.configuration access which triggers MobX machinery
const trackAssemblyNamesCache = new WeakMap<IAnyStateTreeNode, string[]>()

export function getTrackAssemblyNames(
  track: IAnyStateTreeNode & { configuration: AnyConfigurationModel },
) {
  let cached = trackAssemblyNamesCache.get(track)
  if (!cached) {
    cached = getConfAssemblyNames(track.configuration)
    trackAssemblyNamesCache.set(track, cached)
  }
  return cached
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
 * return the rpcSessionId of the highest parent node in the tree that has an
 * rpcSessionId */

export function getRpcSessionId(thisNode: IAnyStateTreeNode) {
  interface NodeWithRpcSessionId extends IAnyStateTreeNode {
    rpcSessionId: string
  }
  let highestRpcSessionId: string | undefined

  for (
    let node = thisNode;
    !isRoot(node);
    node = getParent<IAnyStateTreeNode>(node)
  ) {
    if ('rpcSessionId' in node) {
      highestRpcSessionId = (node as NodeWithRpcSessionId).rpcSessionId
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

export async function restoreFileHandles(
  handleIds: string[],
  requestPermission = false,
) {
  const settled = await Promise.allSettled(
    handleIds.map(handleId =>
      ensureFileHandleReady(handleId, requestPermission),
    ),
  )
  return settled.map((result, i) =>
    result.status === 'fulfilled'
      ? { handleId: handleIds[i]!, success: true as const }
      : {
          handleId: handleIds[i]!,
          success: false as const,
          error: result.reason,
        },
  )
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

// Handles both forward slashes and Windows backslashes in file:// URLs
function filenameFromPath(path: string) {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? ''
}

export function getFileName(track: FileLocation) {
  switch (track.locationType) {
    case 'BlobLocation':
    case 'FileHandleLocation':
      return track.name
    case 'UriLocation':
      return filenameFromPath(track.uri)
    case 'LocalPathLocation':
      return filenameFromPath(track.localPath)
    default:
      return ''
  }
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

interface DisplayInitialSnapshot {
  type?: string
  [key: string]: unknown
}

export function showTrackGeneric(
  self: GenericView,
  trackId: string,
  initialSnapshot = {},
  displayInitialSnapshot: DisplayInitialSnapshot = {},
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
    try {
      trackType.configSchema.create(conf, getEnv(self))
    } catch (e) {
      throw new Error(`Track "${trackId}" has an invalid configuration: ${e}`, {
        cause: e,
      })
    }

    const viewType = pluginManager.getViewType(self.type)
    const supportedDisplays = new Set(viewType.displayTypes.map(d => d.name))
    const displays = conf.displays ?? []
    const displayConf = displays.find((d: { type: string }) =>
      supportedDisplays.has(d.type),
    )

    const displayType =
      displayInitialSnapshot.type ??
      displayConf?.type ??
      trackType.displayTypes.find(d => supportedDisplays.has(d.name))?.name

    if (!displayType) {
      throw new Error(
        `Could not find a compatible display for view type ${self.type}`,
      )
    }

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

interface DisplaySnapshot {
  id: string
  [key: string]: unknown
}
interface TrackSnapshot {
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

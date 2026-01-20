import { getParent, isRoot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import {
  getFileHandle,
  storeFileHandle,
  verifyPermission,
} from './fileHandleStore.ts'
import { getEnv, getSession, objectHash } from './index.ts'
import { readConfObject } from '../configuration/index.ts'

import type {
  BlobLocation,
  FileHandleLocation,
  FileLocation,
  PreFileLocation,
} from './types/index.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  IAnyStateTreeNode,
  IAnyType,
  Instance,
  types,
} from '@jbrowse/mobx-state-tree'

/* utility functions for use by track models and so forth */

// Cache for track assembly names - keyed by track object to avoid
// repeated track.configuration access which triggers MobX machinery
const trackAssemblyNamesCache = new WeakMap<IAnyStateTreeNode, string[]>()

export function getTrackAssemblyNames(
  track: IAnyStateTreeNode & { configuration: AnyConfigurationModel },
) {
  let cached = trackAssemblyNamesCache.get(track)
  if (!cached) {
    // Only access track.configuration on cache miss
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
    // Check if it's an assembly sequence track
    const parent = getParent<any>(conf)
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

  for (let node = thisNode; !isRoot(node); node = getParent<any>(node)) {
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

/**
 * given an MST node, get the renderprops of the first parent container that
 * has renderProps
 * @param node -
 * @returns renderprops, or empty object if none found
 */
export function getParentRenderProps(node: IAnyStateTreeNode) {
  for (
    let currentNode = getParent<any>(node);
    !isRoot(currentNode);
    currentNode = getParent<any>(currentNode)
  ) {
    if ('renderProps' in currentNode) {
      return currentNode.renderProps()
    }
  }

  return {}
}

export const UNKNOWN = 'UNKNOWN'
export const UNSUPPORTED = 'UNSUPPORTED'

let blobMap: Record<string, File> = {}

// get a specific blob
export function getBlob(id: string) {
  return blobMap[id]
}

// used to export entire context to webworker
export function getBlobMap() {
  return blobMap
}

// TODO:IS THIS BAD?
// used in new contexts like webworkers
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

// In-memory cache of File objects from FileSystemFileHandles
// This allows openLocation to remain synchronous while FileHandle access is async
let fileHandleCache: Record<string, File> = {}

export function getFileFromCache(handleId: string) {
  return fileHandleCache[handleId]
}

export function setFileInCache(handleId: string, file: File) {
  fileHandleCache[handleId] = file
}

export function clearFileFromCache(handleId: string) {
  delete fileHandleCache[handleId]
}

export function getFileHandleCache() {
  return fileHandleCache
}

export function setFileHandleCache(cache: Record<string, File>) {
  fileHandleCache = cache
}

// Async function to resolve handle and populate cache
// Returns the File if permission is granted, throws if not
export async function ensureFileHandleReady(
  handleId: string,
  requestPermission = true,
) {
  const cached = fileHandleCache[handleId]
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
  fileHandleCache[handleId] = file
  return file
}

export async function storeFileHandleLocation(
  handle: FileSystemFileHandle,
): Promise<FileHandleLocation> {
  const handleId = await storeFileHandle(handle)
  const file = await handle.getFile()
  fileHandleCache[handleId] = file
  return {
    locationType: 'FileHandleLocation',
    name: handle.name,
    handleId,
  }
}

// Helper to restore file handles from a list of handleIds
// Call this on app startup or when restoring a session
// Returns an array of { handleId, success, error? } results
export async function restoreFileHandles(
  handleIds: string[],
  requestPermission = false,
) {
  const results = []
  for (const handleId of handleIds) {
    try {
      await ensureFileHandleReady(handleId, requestPermission)
      results.push({ handleId, success: true })
    } catch (e) {
      results.push({ handleId, success: false, error: e })
    }
  }
  return results
}

// Recursively find all FileHandleLocation handleIds in a session snapshot
export function findFileHandleIds(
  obj: unknown,
  handleIds = new Set<string>(),
  seen = new WeakSet<object>(),
) {
  if (!obj || typeof obj !== 'object') {
    return handleIds
  }

  if (seen.has(obj)) {
    return handleIds
  }
  seen.add(obj)

  if (Array.isArray(obj)) {
    for (const item of obj) {
      findFileHandleIds(item, handleIds, seen)
    }
  } else {
    const record = obj as Record<string, unknown>
    if (
      record.locationType === 'FileHandleLocation' &&
      typeof record.handleId === 'string'
    ) {
      handleIds.add(record.handleId)
    }
    for (const value of Object.values(record)) {
      findFileHandleIds(value, handleIds, seen)
    }
  }
  return handleIds
}

// Restore all file handles found in a session snapshot
// Call this before setSession to ensure files are available
export async function restoreFileHandlesFromSnapshot(
  sessionSnapshot: unknown,
  requestPermission = false,
) {
  const handleIds = findFileHandleIds(sessionSnapshot)
  if (handleIds.size > 0) {
    return restoreFileHandles([...handleIds], requestPermission)
  }
  return []
}

// Track pending file handle IDs that failed to restore and need user gesture
let pendingFileHandleIds: string[] = []

export function getPendingFileHandleIds() {
  return pendingFileHandleIds
}

export function setPendingFileHandleIds(ids: string[]) {
  pendingFileHandleIds = ids
}

export function clearPendingFileHandleIds() {
  pendingFileHandleIds = []
}

// Call this from a user gesture (button click) to restore pending file handles
export async function restorePendingFileHandles() {
  if (pendingFileHandleIds.length === 0) {
    return []
  }
  const results = await restoreFileHandles(pendingFileHandleIds, true)
  const stillFailed = results.filter(r => !r.success).map(r => r.handleId)
  pendingFileHandleIds = stillFailed
  return results
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

export type TrackTypeGuesser = (adapterName: string) => string | undefined

export function getFileName(track: FileLocation) {
  const uri = 'uri' in track ? track.uri : undefined
  const localPath = 'localPath' in track ? track.localPath : undefined
  const blob = 'blobId' in track ? track : undefined
  const fileHandle = 'handleId' in track ? track : undefined

  if (blob?.name) {
    return blob.name
  }

  if (fileHandle?.name) {
    return fileHandle.name
  }

  if (uri) {
    // Normalize path separators and find the last one
    // This handles both forward slashes and Windows backslashes in file:// URLs
    const normalized = uri.replace(/\\/g, '/')
    return normalized.slice(normalized.lastIndexOf('/') + 1)
  }

  if (localPath) {
    const normalized = localPath.replace(/\\/g, '/')
    return normalized.slice(normalized.lastIndexOf('/') + 1)
  }

  return ''
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
      'Core-guessAdapterForLocation',
      (
        _file: FileLocation,
        _index?: FileLocation,
        _adapterHint?: string,
      ): AdapterConfig | undefined => {
        return undefined
      },
    ) as AdapterGuesser

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
): string {
  if (model) {
    const session = getSession(model)

    const trackTypeGuesser = getEnv(
      session,
    ).pluginManager.evaluateExtensionPoint(
      'Core-guessTrackTypeForLocation',
      (_adapterName: string): AdapterConfig | undefined => {
        return undefined
      },
    ) as TrackTypeGuesser

    const trackType = trackTypeGuesser(adapterType)
    if (trackType) {
      return trackType
    }
  }
  return 'FeatureTrack'
}

export function generateUnsupportedTrackConf(
  trackName: string,
  trackUrl: string,
  categories: string[] | undefined,
) {
  const conf = {
    type: 'FeatureTrack',
    name: `${trackName} (Unsupported)`,
    description: `Support not yet implemented for "${trackUrl}"`,
    category: categories,
    trackId: '',
  }
  conf.trackId = objectHash(conf)
  return conf
}

export function generateUnknownTrackConf(
  trackName: string,
  trackUrl: string,
  categories?: string[],
) {
  const conf = {
    type: 'FeatureTrack',
    name: `${trackName} (Unknown)`,
    description: `Could not determine track type for "${trackUrl}"`,
    category: categories,
    trackId: '',
  }
  conf.trackId = objectHash(conf)
  return conf
}

export function getTrackName(
  conf: AnyConfigurationModel | { name?: string; type?: string },
  session: { assemblies: AnyConfigurationModel[] },
): string {
  // Handle both MST models and plain objects
  const trackName = isStateTreeNode(conf)
    ? (readConfObject(conf, 'name') as string)
    : (conf.name ?? '')
  const trackType = isStateTreeNode(conf)
    ? (readConfObject(conf, 'type') as string)
    : conf.type
  if (!trackName && trackType === 'ReferenceSequenceTrack') {
    const asm = session.assemblies.find(a => a.sequence === conf)
    return asm
      ? `Reference sequence (${
          readConfObject(asm, 'displayName') || readConfObject(asm, 'name')
        })`
      : 'Reference sequence'
  }
  return trackName
}

type MSTArray<T extends IAnyType> = Instance<ReturnType<typeof types.array<T>>>

interface MinimalTrack extends IAnyType {
  configuration: { trackId: string }
}

interface GenericView {
  type: string
  tracks: MSTArray<MinimalTrack>
}

export function showTrackGeneric(
  self: GenericView,
  trackId: string,
  initialSnapshot = {},
  displayInitialSnapshot = {},
) {
  const { pluginManager } = getEnv(self)
  const session = getSession(self)

  // Check if track is already shown
  const found = self.tracks.find(t => t.configuration.trackId === trackId)
  if (found) {
    return found
  }

  const conf = session.getTracksById()[trackId]
  if (!conf) {
    throw new Error(`Could not resolve identifier "${trackId}"`)
  }

  const trackType = pluginManager.getTrackType(conf.type)
  if (!trackType) {
    throw new Error(`Unknown track type ${conf.type}`)
  }

  // Find a compatible display for this view type
  const viewType = pluginManager.getViewType(self.type)!
  const supportedDisplays = new Set(viewType.displayTypes.map(d => d.name))
  const displays = conf.displays ?? []
  const displayConf = displays.find((d: { type: string }) =>
    supportedDisplays.has(d.type),
  )

  // Find a compatible display type for this view
  // If displayInitialSnapshot specifies a type, use that instead
  const snapshotType = (displayInitialSnapshot as { type?: string }).type
  const defaultDisplayType =
    displayConf?.type ??
    trackType.displayTypes.find(d => supportedDisplays.has(d.name))?.name
  const displayType = snapshotType ?? defaultDisplayType

  if (!displayType) {
    throw new Error(
      `Could not find a compatible display for view type ${self.type}`,
    )
  }

  // Generate displayId based on the actual display type being used
  const displayId = displayConf?.displayId ?? `${trackId}-${displayType}`

  // Create track with just the trackId - the ConfigurationReference will resolve it
  const track = trackType.stateModel.create({
    ...initialSnapshot,
    type: conf.type,
    configuration: trackId,
    displays: [
      {
        type: displayType,
        configuration: displayId,
        ...displayInitialSnapshot,
      },
    ],
  })
  self.tracks.push(track)
  return track
}

export function hideTrackGeneric(self: GenericView, trackId: string) {
  const t = self.tracks.find(t => t.configuration.trackId === trackId)
  if (t) {
    self.tracks.remove(t)
    return 1
  }
  return 0
}

export function toggleTrackGeneric(self: GenericView, trackId: string) {
  const hiddenCount = hideTrackGeneric(self, trackId)
  if (!hiddenCount) {
    showTrackGeneric(self, trackId)
  }
}

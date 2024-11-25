import { getParent, isRoot } from 'mobx-state-tree'
import { getSession, objectHash, getEnv } from './index'
import { readConfObject } from '../configuration'
import type { PreFileLocation, FileLocation } from './types'
import type { AnyConfigurationModel } from '../configuration'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

/* utility functions for use by track models and so forth */

export function getTrackAssemblyNames(
  track: IAnyStateTreeNode & { configuration: AnyConfigurationModel },
) {
  return getConfAssemblyNames(track.configuration)
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
export function storeBlobLocation(location: PreFileLocation) {
  if ('blob' in location) {
    const blobId = `b${+Date.now()}-${counter++}`
    blobMap[blobId] = location.blob
    return { name: location.blob.name, blobId, locationType: 'BlobLocation' }
  }
  return location
}

/**
 * creates a new location from the provided location including the appropriate suffix and location type
 * @param location - the FileLocation
 * @param suffix - the file suffix (e.g. .bam)
 * @returns the constructed location object from the provided parameters
 */
export function makeIndex(location: FileLocation, suffix: string) {
  if ('uri' in location) {
    return { uri: location.uri + suffix, locationType: 'UriLocation' }
  }

  if ('localPath' in location) {
    return {
      localPath: location.localPath + suffix,
      locationType: 'LocalPathLocation',
    }
  }

  return location
}

/**
 * constructs a potential index file (with suffix) from the provided file name
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
  return (
    blob?.name ||
    uri?.slice(uri.lastIndexOf('/') + 1) ||
    localPath?.slice(localPath.replace(/\\/g, '/').lastIndexOf('/') + 1) ||
    ''
  )
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
  categories: string[] | undefined,
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
  conf: AnyConfigurationModel,
  session: { assemblies: AnyConfigurationModel[] },
) {
  const trackName = readConfObject(conf, 'name') as string
  if (!trackName && readConfObject(conf, 'type') === 'ReferenceSequenceTrack') {
    const asm = session.assemblies.find(a => a.sequence === conf)
    return asm
      ? `Reference sequence (${
          readConfObject(asm, 'displayName') || readConfObject(asm, 'name')
        })`
      : 'Reference sequence'
  }
  return trackName
}

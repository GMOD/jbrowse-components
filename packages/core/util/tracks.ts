import { getParent, isRoot, IAnyStateTreeNode } from 'mobx-state-tree'
import { getSession, objectHash } from './index'
import { PreFileLocation, FileLocation } from './types'
import { AnyConfigurationModel } from '../configuration/configurationSchema'
import { readConfObject } from '../configuration'
import { getEnv } from 'mobx-state-tree'
import AddTrackModel from '@jbrowse/plugin-data-management'

/* utility functions for use by track models and so forth */

export function getTrackAssemblyNames(
  track: IAnyStateTreeNode & { configuration: AnyConfigurationModel },
) {
  const trackConf = track.configuration
  const trackAssemblyNames = readConfObject(trackConf, 'assemblyNames')
  if (!trackAssemblyNames) {
    // Check if it's an assembly sequence track
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent = getParent<any>(track.configuration)
    if ('sequence' in parent) {
      return [readConfObject(parent, 'name')]
    }
  }
  return trackAssemblyNames as string[]
}

/** return the rpcSessionId of the highest parent node in the tree that has an rpcSessionId */

export function getRpcSessionId(thisNode: IAnyStateTreeNode) {
  interface NodeWithRpcSessionId extends IAnyStateTreeNode {
    rpcSessionId: string
  }
  let highestRpcSessionId
  for (let node = thisNode; !isRoot(node); node = getParent(node)) {
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
 * given an MST node, get the renderprops of the first parent container that has
 * renderProps
 * @param node -
 * @returns renderprops, or empty object if none found
 */
export function getParentRenderProps(node: IAnyStateTreeNode) {
  for (
    let currentNode = getParent(node);
    !isRoot(currentNode);
    currentNode = getParent(currentNode)
  ) {
    if ('renderProps' in currentNode) {
      return currentNode.renderProps()
    }
  }

  return {}
}

export const UNKNOWN = 'UNKNOWN'
export const UNSUPPORTED = 'UNSUPPORTED'

let blobMap: { [key: string]: File } = {}

// get a specific blob
export function getBlob(id: string) {
  return blobMap[id]
}

// used to export entire context to webworker
export function getBlobMap() {
  return blobMap
}

// used in new contexts like webworkers
export function setBlobMap(map: { [key: string]: File }) {
  blobMap = map
}

// blob files are stored in a global map
export function storeBlobLocation(location: PreFileLocation) {
  if (location && 'blob' in location) {
    // possibly we should be more clear about when this is not undefined, and
    // also allow mix of blob and url for index and file
    // @ts-ignore
    const blobId = `b${+Date.now()}`
    blobMap[blobId] = location.blob
    return { name: location?.blob.name, blobId, locationType: 'BlobLocation' }
  }
  return location
}

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

export function makeIndexType(
  name: string | undefined,
  typeA: string,
  typeB: string,
) {
  return name?.toUpperCase().endsWith(typeA) ? typeA : typeB
}

export function guessAdapter(
  file: FileLocation,
  index: FileLocation | undefined,
  getFileName: (f: FileLocation) => string,
  model?: AddTrackModel,
  adapterHint?: string,
) {
  const fileName = getFileName(file)
  const indexName = index && getFileName(index)

  if (model) {
    // @ts-ignore
    const session = getSession(model)

    const adapter = getEnv(session)
      .pluginManager.getElementTypesInGroup('adapter guess')
      .find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (adapter: any) =>
          (adapter.regexGuess && adapter.regexGuess.test(fileName)) ||
          adapterHint === adapter.name,
      )

    if (adapter) {
      return adapter.fetchConfig(file, index, indexName)
    }
  }

  return {
    type: UNKNOWN,
  }
}

export function guessTrackType(
  adapterType: string,
  model?: AddTrackModel,
): string {
  if (model) {
    // @ts-ignore
    const session = getSession(model)

    const adapter = getEnv(session)
      .pluginManager.getElementTypesInGroup('adapter guess')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .find((adapter: any) => adapterType === adapter.name)

    if (adapter) {
      return adapter.trackGuess
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

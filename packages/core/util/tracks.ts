import { getParent, isRoot, IAnyStateTreeNode } from 'mobx-state-tree'
import { objectHash } from './index'
import { PreFileLocation, FileLocation } from './types'
import { AnyConfigurationModel } from '../configuration/configurationSchema'
import { readConfObject } from '../configuration'

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
      return currentNode.renderProps
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
    return { name: location?.blob.name, blobId }
  }
  return location
}

export function guessAdapter(
  file: FileLocation,
  index: FileLocation | undefined,
  getFileName: (f: FileLocation) => string,
  adapterHint?: string,
) {
  function makeIndex(location: FileLocation, suffix: string) {
    if ('uri' in location) {
      return { uri: location.uri + suffix }
    }
    if ('localPath' in location) {
      return { localPath: location.localPath + suffix }
    }
    return location
  }

  const fileName = getFileName(file)
  const indexName = index && getFileName(index)
  function makeIndexType(
    name: string | undefined,
    typeA: string,
    typeB: string,
  ) {
    return name?.toUpperCase().endsWith(typeA) ? typeA : typeB
  }

  if (/\.bam$/i.test(fileName) || adapterHint === 'BamAdapter') {
    return {
      type: 'BamAdapter',
      bamLocation: file,
      index: {
        location: index || makeIndex(file, '.bai'),
        indexType: makeIndexType(indexName, 'CSI', 'BAI'),
      },
    }
  }

  if (/\.cram$/i.test(fileName) || adapterHint === 'CramAdapter') {
    return {
      type: 'CramAdapter',
      cramLocation: file,
      craiLocation: index || makeIndex(file, '.crai'),
    }
  }

  if (/\.gff3?$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.gff3?\.b?gz$/i.test(fileName) || adapterHint === 'Gff3TabixAdapter') {
    return {
      type: 'Gff3TabixAdapter',
      gffGzLocation: file,
      index: {
        location: index || makeIndex(file, '.tbi'),
        indexType: makeIndexType(indexName, 'CSI', 'TBI'),
      },
    }
  }

  if (/\.gtf?$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.vcf$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.vcf\.b?gz$/i.test(fileName) || adapterHint === 'VcfTabixAdapter') {
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: file,
      index: {
        location: index || makeIndex(file, 'tbi'),
        indexType: makeIndexType(indexName, 'CSI', 'TBI'),
      },
    }
  }

  if (/\.vcf\.idx$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.bed$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.bed\.b?gz$/i.test(fileName) || adapterHint === 'BedTabixAdapter') {
    return {
      type: 'BedTabixAdapter',
      bedGzLocation: file,
      index: {
        location: index || makeIndex(file, '.tbi'),
        indexType: makeIndexType(indexName, 'CSI', 'TBI'),
      },
    }
  }

  if (/\.(bb|bigbed)$/i.test(fileName) || adapterHint === 'BigBedAdapter') {
    return {
      type: 'BigBedAdapter',
      bigBedLocation: file,
    }
  }

  if (/\.(bw|bigwig)$/i.test(fileName) || adapterHint === 'BigWigAdapter') {
    return {
      type: 'BigWigAdapter',
      bigWigLocation: file,
    }
  }

  if (
    /\.(fa|fasta|fas|fna|mfa)$/i.test(fileName) ||
    adapterHint === 'IndexedFastaAdapter'
  ) {
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: file,
      faiLocation: index || makeIndex(file, '.fai'),
    }
  }

  if (
    /\.(fa|fasta|fas|fna|mfa)\.b?gz$/i.test(fileName) ||
    adapterHint === 'BgzipFastaAdapter'
  ) {
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: file,
      faiLocation: makeIndex(file, '.fai'),
      gziLocation: makeIndex(file, '.gzi'),
    }
  }

  if (/\.2bit$/i.test(fileName) || adapterHint === 'TwoBitAdapter') {
    return {
      type: 'TwoBitAdapter',
      twoBitLocation: file,
    }
  }

  if (/\.sizes$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (
    /\/trackData.jsonz?$/i.test(fileName) ||
    adapterHint === 'NCListAdapter'
  ) {
    return {
      type: 'NCListAdapter',
      rootUrlTemplate: file,
    }
  }

  if (/\/sparql$/i.test(fileName) || adapterHint === 'SPARQLAdapter') {
    return {
      type: 'SPARQLAdapter',
      endpoint: file,
    }
  }

  if (/\.hic/i.test(fileName) || adapterHint === 'HicAdapter') {
    return {
      type: 'HicAdapter',
      hicLocation: file,
    }
  }

  if (/\.paf/i.test(fileName) || adapterHint === 'PAFAdapter') {
    return {
      type: 'PAFAdapter',
      pafLocation: file,
    }
  }

  return {
    type: UNKNOWN,
  }
}

export function guessTrackType(adapterType: string): string {
  const known: { [key: string]: string | undefined } = {
    BamAdapter: 'AlignmentsTrack',
    CramAdapter: 'AlignmentsTrack',
    BgzipFastaAdapter: 'ReferenceSequenceTrack',
    BigWigAdapter: 'QuantitativeTrack',
    IndexedFastaAdapter: 'ReferenceSequenceTrack',
    TwoBitAdapter: 'ReferenceSequenceTrack',
    VcfTabixAdapter: 'VariantTrack',
    HicAdapter: 'HicTrack',
    PAFAdapter: 'SyntenyTrack',
  }
  return known[adapterType] || 'FeatureTrack'
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

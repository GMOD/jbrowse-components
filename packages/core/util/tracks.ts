import { getParent, isRoot, IAnyStateTreeNode } from 'mobx-state-tree'
import objectHash from 'object-hash'
import { AnyConfigurationModel } from '../configuration/configurationSchema'
import { UriLocation, LocalPathLocation } from './types'
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

export function guessAdapter(
  fileName: string,
  protocol: 'uri' | 'localPath',
  index?: string,
) {
  function makeLocation(location: string): UriLocation | LocalPathLocation {
    if (protocol === 'uri') {
      return { uri: location }
    }
    if (protocol === 'localPath') {
      return { localPath: location }
    }
    throw new Error(`invalid protocol ${protocol}`)
  }
  if (/\.bam$/i.test(fileName)) {
    return {
      type: 'BamAdapter',
      bamLocation: makeLocation(fileName),
      index: {
        location: makeLocation(index || `${fileName}.bai`),
        indexType: index && index.toUpperCase().endsWith('CSI') ? 'CSI' : 'BAI',
      },
    }
  }

  if (/\.cram$/i.test(fileName)) {
    return {
      type: 'CramAdapter',
      cramLocation: makeLocation(fileName),
      craiLocation: makeLocation(`${fileName}.crai`),
    }
  }

  if (/\.gff3?$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\.gff3?\.b?gz$/i.test(fileName)) {
    return {
      type: 'Gff3TabixAdapter',
      gffGzLocation: makeLocation(fileName),
      index: {
        location: makeLocation(index || `${fileName}.tbi`),
        indexType: index && index.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
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

  if (/\.vcf\.b?gz$/i.test(fileName)) {
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: makeLocation(fileName),
      index: {
        location: makeLocation(`${fileName}.tbi`),
        indexType: index && index.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
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

  if (/\.bed\.b?gz$/i.test(fileName)) {
    return {
      type: 'BedTabixAdapter',
      bedGzLocation: makeLocation(fileName),
      index: {
        location: makeLocation(`${fileName}.tbi`),
        indexType: index && index.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
      },
    }
  }

  if (/\.(bb|bigbed)$/i.test(fileName)) {
    return {
      type: 'BigBedAdapter',
      bigBedLocation: makeLocation(fileName),
    }
  }

  if (/\.(bw|bigwig)$/i.test(fileName)) {
    return {
      type: 'BigWigAdapter',
      bigWigLocation: makeLocation(fileName),
    }
  }

  if (/\.(fa|fasta|fas|fna|mfa)$/i.test(fileName)) {
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: makeLocation(fileName),
      faiLocation: makeLocation(index || `${fileName}.fai`),
    }
  }

  if (/\.(fa|fasta|fas|fna|mfa)\.b?gz$/i.test(fileName)) {
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: makeLocation(fileName),
      faiLocation: makeLocation(`${fileName}.fai`),
      gziLocation: makeLocation(`${fileName}.gzi`),
    }
  }

  if (/\.2bit$/i.test(fileName)) {
    return {
      type: 'TwoBitAdapter',
      twoBitLocation: makeLocation(fileName),
    }
  }

  if (/\.sizes$/i.test(fileName)) {
    return {
      type: 'UNSUPPORTED',
    }
  }

  if (/\/trackData.jsonz?$/i.test(fileName)) {
    return {
      type: 'NCListAdapter',
      rootUrlTemplate: makeLocation(fileName),
    }
  }

  if (/\/sparql$/i.test(fileName)) {
    return {
      type: 'SPARQLAdapter',
      endpoint: fileName,
    }
  }

  if (/\.hic/i.test(fileName)) {
    return {
      type: 'HicAdapter',
      hicLocation: makeLocation(fileName),
    }
  }

  if (/\.paf/i.test(fileName)) {
    return {
      type: 'PAFAdapter',
      pafLocation: makeLocation(fileName),
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

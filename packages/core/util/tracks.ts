import { getParent, isRoot, IStateTreeNode } from 'mobx-state-tree'
import objectHash from 'object-hash'
import { AnyConfigurationModel } from '../configuration/configurationSchema'
import { UriLocation, LocalPathLocation } from './types'
import { readConfObject } from '../configuration'

/* utility functions for use by track models and so forth */

export function getTrackAssemblyNames(
  track: IStateTreeNode & { configuration: AnyConfigurationModel },
) {
  const trackConf = track.configuration
  const trackAssemblyNames = readConfObject(trackConf, 'assemblyNames')
  if (!trackAssemblyNames) {
    // Check if it's an assembly sequence track
    const parent = getParent(track.configuration)
    if (parent.sequence) return [readConfObject(parent, 'name')]
  }
  return trackAssemblyNames
}

/**
 * given an MST node, get the renderprops of the first parent container that has
 * renderProps
 * @param node -
 * @returns renderprops, or empty object if none found
 */
export function getParentRenderProps(node: IStateTreeNode) {
  for (
    let currentNode = getParent(node);
    !isRoot(currentNode);
    currentNode = getParent(currentNode)
  ) {
    if (currentNode.renderProps) return currentNode.renderProps
  }

  return {}
}

export const UNKNOWN = 'UNKNOWN'
export const UNSUPPORTED = 'UNSUPPORTED'

export function guessAdapter(fileName: string, protocol: 'uri' | 'localPath') {
  function makeLocation(location: string): UriLocation | LocalPathLocation {
    if (protocol === 'uri') return { uri: location }
    if (protocol === 'localPath') return { localPath: location }
    throw new Error(`invalid protocol ${protocol}`)
  }
  if (/\.bam$/i.test(fileName))
    return {
      type: 'BamAdapter',
      bamLocation: makeLocation(fileName),
      index: { location: makeLocation(`${fileName}.bai`) },
    }
  if (/\.bai$/i.test(fileName))
    return {
      type: 'BamAdapter',
      bamLocation: makeLocation(fileName.replace(/\.bai$/i, '')),
      index: { location: makeLocation(fileName) },
    }
  if (/\.bam.csi$/i.test(fileName))
    return {
      type: 'BamAdapter',
      bamLocation: makeLocation(fileName.replace(/\.csi$/i, '')),
      index: { location: makeLocation(fileName), indexType: 'CSI' },
    }

  if (/\.cram$/i.test(fileName))
    return {
      type: 'CramAdapter',
      cramLocation: makeLocation(fileName),
      craiLocation: makeLocation(`${fileName}.crai`),
    }
  if (/\.crai$/i.test(fileName))
    return {
      type: 'CramAdapter',
      cramLocation: makeLocation(fileName.replace(/\.crai$/i, '')),
      craiLocation: makeLocation(fileName),
    }

  if (/\.gff3?$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.gff3?\.b?gz$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.gff3?\.b?gz.tbi$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.gff3?\.b?gz.csi$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.gtf?$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.vcf$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.vcf\.b?gz$/i.test(fileName))
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: makeLocation(fileName),
      index: { location: makeLocation(`${fileName}.tbi`), indexType: 'TBI' },
    }
  if (/\.vcf\.b?gz\.tbi$/i.test(fileName))
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: makeLocation(fileName.replace(/\.tbi$/i, '')),
      index: { location: makeLocation(fileName), indexType: 'TBI' },
    }
  if (/\.vcf\.b?gz\.csi$/i.test(fileName))
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: makeLocation(fileName.replace(/\.csi$/i, '')),
      index: { location: makeLocation(fileName), indexType: 'CSI' },
    }

  if (/\.vcf\.idx$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.bed$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.bed\.b?gz$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.bed.b?gz.tbi$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.bed.b?gz.csi/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.bed\.idx$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.(bb|bigbed)$/i.test(fileName))
    return {
      type: 'BigBedAdapter',
      bigBedLocation: makeLocation(fileName),
    }

  if (/\.(bw|bigwig)$/i.test(fileName))
    return {
      type: 'BigWigAdapter',
      bigWigLocation: makeLocation(fileName),
    }

  if (/\.(fa|fasta|fna|mfa)$/i.test(fileName))
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: makeLocation(fileName),
      faiLocation: makeLocation(`${fileName}.fai`),
    }
  if (/\.(fa|fasta|fna|mfa)\.fai$/i.test(fileName))
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: makeLocation(fileName.replace(/\.fai$/i, '')),
      faiLocation: makeLocation(fileName),
    }

  if (/\.(fa|fasta|fna|mfa)\.b?gz$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: makeLocation(fileName),
      faiLocation: makeLocation(`${fileName}.fai`),
      gziLocation: makeLocation(`${fileName}.gzi`),
    }
  if (/\.(fa|fasta|fna|mfa)\.b?gz\.fai$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: makeLocation(fileName.replace(/\.fai$/i, '')),
      faiLocation: makeLocation(fileName),
      gziLocation: makeLocation(`${fileName.replace(/\.fai$/i, '')}.gzi`),
    }
  if (/\.(fa|fasta|fna|mfa)\.b?gz\.gzi$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: makeLocation(fileName.replace(/\.gzi$/i, '')),
      faiLocation: makeLocation(`${fileName.replace(/\.gzi$/i, '')}.fai`),
      gziLocation: makeLocation(fileName),
    }

  if (/\.2bit$/i.test(fileName))
    return {
      type: 'TwoBitAdapter',
      twoBitLocation: makeLocation(fileName),
    }

  if (/\.sizes$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\/trackData.jsonz?$/i.test(fileName))
    return {
      type: 'NCListAdapter',
      rootUrlTemplate: fileName,
    }

  if (/\/sparql$/i.test(fileName))
    return {
      type: 'SPARQLAdapter',
      endpoint: fileName,
    }

  return {
    type: UNKNOWN,
  }
}

export function guessSubadapter(
  fileName: string,
  protocol: string,
  mainAdapter: string,
) {
  if (/\.bam$/i.test(fileName))
    return {
      type: mainAdapter,
      subadapter: {
        type: 'BamAdapter',
        bamLocation: { [protocol]: fileName },
        index: { location: { [protocol]: `${fileName}.bai` } },
      },
    }
  if (/\.bai$/i.test(fileName))
    return {
      type: mainAdapter,
      subadapter: {
        type: 'BamAdapter',
        bamLocation: { [protocol]: fileName.replace(/\.bai$/i, '') },
        index: { location: { [protocol]: fileName } },
      },
    }
  if (/\.bam.csi$/i.test(fileName))
    return {
      type: mainAdapter,
      subadapter: {
        type: 'BamAdapter',
        bamLocation: { [protocol]: fileName.replace(/\.csi$/i, '') },
        index: { location: { [protocol]: fileName }, indexType: 'CSI' },
      },
    }

  if (/\.cram$/i.test(fileName))
    return {
      type: mainAdapter,
      subadapter: {
        type: 'CramAdapter',
        cramLocation: { [protocol]: fileName },
        craiLocation: { [protocol]: `${fileName}.crai` },
      },
    }
  if (/\.crai$/i.test(fileName))
    return {
      type: mainAdapter,
      subadapter: {
        type: 'CramAdapter',
        cramLocation: { [protocol]: fileName.replace(/\.crai$/i, '') },
        craiLocation: { [protocol]: fileName },
      },
    }
  return {
    type: UNSUPPORTED,
  }
}

export function guessTrackType(adapterType: string): string {
  const known: { [key: string]: string | undefined } = {
    BamAdapter: 'AlignmentsTrack',
    CramAdapter: 'AlignmentsTrack',
    BgzipFastaAdapter: 'SequenceTrack',
    BigWigAdapter: 'WiggleTrack',
    IndexedFastaAdapter: 'SequenceTrack',
    TwoBitAdapter: 'SequenceTrack',
    VcfTabixAdapter: 'VariantTrack',
  }
  return known[adapterType] || 'BasicTrack'
}

export function generateUnsupportedTrackConf(
  trackName: string,
  trackUrl: string,
  categories: string[] | undefined,
) {
  const conf = {
    type: 'BasicTrack',
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
    type: 'BasicTrack',
    name: `${trackName} (Unknown)`,
    description: `Could not determine track type for "${trackUrl}"`,
    category: categories,
    trackId: '',
  }
  conf.trackId = objectHash(conf)
  return conf
}

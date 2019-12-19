import { getParent, isRoot } from 'mobx-state-tree'
import objectHash from 'object-hash'
import { readConfObject } from '../configuration'

/* utility functions for use by track models and so forth */

/**
 * get the closest view object that contains this state tree node
 * @param {MSTNode} node
 */
export function getContainingView(node) {
  let currentNode = node
  while (currentNode.bpPerPx === undefined) currentNode = getParent(currentNode)
  return currentNode
}

export function getTrackAssemblyName(track) {
  // if the track has an assemblyName for some reason, just use that
  if (track.assemblyName) return track.assemblyName

  // otherwise use the assembly from the dataset that it is part of
  const trackConf = track.configuration
  let trackConfParent = trackConf
  do {
    trackConfParent = getParent(trackConfParent)
  } while (!trackConfParent.assembly && !isRoot(trackConfParent))

  const assemblyName = readConfObject(trackConfParent, ['assembly', 'name'])
  return assemblyName
}

/**
 * given an MST node, get the renderprops of the first parent container that has
 * renderProps
 * @param {TreeNode} node
 * @returns {object} renderprops, or empty object if none found
 */
export function getParentRenderProps(node) {
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

export function guessAdapter(fileName, protocol) {
  if (/\.bam$/i.test(fileName))
    return {
      type: 'BamAdapter',
      bamLocation: { [protocol]: fileName },
      index: { location: { [protocol]: `${fileName}.bai` } },
    }
  if (/\.bai$/i.test(fileName))
    return {
      type: 'BamAdapter',
      bamLocation: { [protocol]: fileName.replace(/\.bai$/i, '') },
      index: { location: { [protocol]: fileName } },
    }
  if (/\.bam.csi$/i.test(fileName))
    return {
      type: 'BamAdapter',
      bamLocation: { [protocol]: fileName.replace(/\.csi$/i, '') },
      index: { location: { [protocol]: fileName }, indexType: 'CSI' },
    }

  if (/\.cram$/i.test(fileName))
    return {
      type: 'CramAdapter',
      cramLocation: { [protocol]: fileName },
      craiLocation: { [protocol]: `${fileName}.crai` },
    }
  if (/\.crai$/i.test(fileName))
    return {
      type: 'CramAdapter',
      cramLocation: { [protocol]: fileName.replace(/\.crai$/i, '') },
      craiLocation: { [protocol]: fileName },
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
      vcfGzLocation: { [protocol]: fileName },
      index: { location: { [protocol]: `${fileName}.tbi` }, indexType: 'TBI' },
    }
  if (/\.vcf\.b?gz\.tbi$/i.test(fileName))
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: { [protocol]: fileName.replace(/\.tbi$/i, '') },
      index: { location: { [protocol]: fileName }, indexType: 'TBI' },
    }
  if (/\.vcf\.b?gz\.csi$/i.test(fileName))
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: { [protocol]: fileName.replace(/\.csi$/i, '') },
      index: { location: { [protocol]: fileName }, indexType: 'CSI' },
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
      bigBedLocation: { [protocol]: fileName },
    }

  if (/\.(bw|bigwig)$/i.test(fileName))
    return {
      type: 'BigWigAdapter',
      bigWigLocation: { [protocol]: fileName },
    }

  if (/\.(fa|fasta|fna|mfa)$/i.test(fileName))
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: { [protocol]: fileName },
      faiLocation: { [protocol]: `${fileName}.fai` },
    }
  if (/\.(fa|fasta|fna|mfa)\.fai$/i.test(fileName))
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: { [protocol]: fileName.replace(/\.fai$/i, '') },
      faiLocation: { [protocol]: fileName },
    }

  if (/\.(fa|fasta|fna|mfa)\.b?gz$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: { [protocol]: fileName },
      faiLocation: { [protocol]: `${fileName}.fai` },
      gziLocation: { [protocol]: `${fileName}.gzi` },
    }
  if (/\.(fa|fasta|fna|mfa)\.b?gz\.fai$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: { [protocol]: fileName.replace(/\.fai$/i, '') },
      faiLocation: { [protocol]: fileName },
      gziLocation: { [protocol]: `${fileName.replace(/\.fai$/i, '')}.gzi` },
    }
  if (/\.(fa|fasta|fna|mfa)\.b?gz\.gzi$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: { [protocol]: fileName.replace(/\.gzi$/i, '') },
      faiLocation: { [protocol]: `${fileName.replace(/\.gzi$/i, '')}.fai` },
      gziLocation: { [protocol]: fileName },
    }

  if (/\.2bit$/i.test(fileName))
    return {
      type: 'TwoBitAdapter',
      twoBitLocation: { [protocol]: fileName },
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

export function guessTrackType(adapterType) {
  return (
    {
      BamAdapter: 'AlignmentsTrack',
      CramAdapter: 'AlignmentsTrack',
      BgzipFastaAdapter: 'SequenceTrack',
      BigWigAdapter: 'WiggleTrack',
      IndexedFastaAdapter: 'SequenceTrack',
      TwoBitAdapter: 'SequenceTrack',
      VcfTabixAdapter: 'VariantTrack',
    }[adapterType] || 'BasicTrack'
  )
}

export function generateUnsupportedTrackConf(trackName, trackUrl, categories) {
  const conf = {
    type: 'BasicTrack',
    name: `${trackName} (Unsupported)`,
    description: `Support not yet implemented for "${trackUrl}"`,
    category: categories,
  }
  conf.trackId = objectHash(conf)
  return conf
}

export function generateUnknownTrackConf(trackName, trackUrl, categories) {
  const conf = {
    type: 'BasicTrack',
    name: `${trackName} (Unknown)`,
    description: `Could not determine track type for "${trackUrl}"`,
    category: categories,
  }
  conf.trackId = objectHash(conf)
  return conf
}

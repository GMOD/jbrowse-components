import { getParent, isRoot } from 'mobx-state-tree'

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

/**
 * get the assembly configuration that contains a track configuration
 * @param {MSTNode} node
 */
export function getContainingAssembly(trackConf) {
  let trackConfParent = getParent(trackConf)
  if (!trackConfParent.assemblyName)
    trackConfParent = getParent(trackConfParent)
  return trackConfParent
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
      type: UNSUPPORTED,
    }
  if (/\.crai$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.gff3?$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.gff3?\.gz$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.gff3?\.gz.tbi$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.gff3?\.gz.csi$/i.test(fileName))
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

  if (/\.vcf\.gz$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.vcf\.gz\.tbi$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.vcf\.gz\.csi$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.vcf\.idx$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.bed$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }

  if (/\.bed\.gz$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.bed.gz.tbi$/i.test(fileName))
    return {
      type: UNSUPPORTED,
    }
  if (/\.bed.gz.csi/i.test(fileName))
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

  if (/\.(fa|fasta|fna|mfa)\.gz$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: { [protocol]: fileName },
      faiLocation: { [protocol]: `${fileName}.fai` },
      gziLocation: { [protocol]: `${fileName}.gzi` },
    }
  if (/\.(fa|fasta|fna|mfa)\.gz\.fai$/i.test(fileName))
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: { [protocol]: fileName.replace(/\.fai$/i, '') },
      faiLocation: { [protocol]: fileName },
      gziLocation: { [protocol]: `${fileName.replace(/\.fai$/i, '')}.gzi` },
    }
  if (/\.(fa|fasta|fna|mfa)\.gz\.gzi$/i.test(fileName))
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

  if (/\/trackData.json$/i.test(fileName))
    return {
      type: 'NCListAdapter',
      rootUrlTemplate: fileName,
    }

  return {
    type: UNSUPPORTED,
  }
}

export function guessTrackType(adapterType) {
  return {
    BamAdapter: 'AlignmentsTrack',
    BgzipFastaAdapter: 'SequenceTrack',
    BigBedAdapter: 'BasicTrack',
    BigWigAdapter: 'WiggleTrack',
    IndexedFastaAdapter: 'SequenceTrack',
    NCListAdapter: 'BasicTrack',
    TwoBitAdapter: 'SequenceTrack',
  }[adapterType]
}

export function generateUnsupportedTrackConf(trackName, trackUrl, categories) {
  return {
    type: 'BasicTrack',
    name: `${trackName} (Unsupported)`,
    description: `Could not determine track type for "${trackUrl}"`,
    category: categories,
  }
}

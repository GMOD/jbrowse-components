interface UriLocation {
  uri: string
  locationType: 'UriLocation'
}

interface LocalPathLocation {
  localPath: string
  locationType: 'LocalPathLocation'
}

export function makeLocationProtocol(protocol: string) {
  return (location: string) => {
    if (protocol === 'uri') {
      return {
        uri: location,
        locationType: 'UriLocation',
      } as UriLocation
    }
    if (protocol === 'localPath') {
      return {
        localPath: location,
        locationType: 'LocalPathLocation',
      } as LocalPathLocation
    }
    throw new Error(`invalid protocol ${protocol}`)
  }
}

export function guessFileNames({
  location,
  index,
  bed1,
  bed2,
}: {
  location: string
  index?: string
  bed1?: string
  bed2?: string
}) {
  if (/\.anchors(.simple)?$/i.test(location)) {
    return {
      file: location,
      bed1: bed1!,
      bed2: bed2!,
    }
  } else if (/\.bam$/i.test(location)) {
    return {
      file: location,
      index: index || `${location}.bai`,
    }
  } else if (/\.cram$/i.test(location)) {
    return {
      file: location,
      index: index || `${location}.crai`,
    }
  } else if (
    /\.gff3?\.b?gz$/i.test(location) ||
    /\.vcf\.b?gz$/i.test(location) ||
    /\.bed\.b?gz$/i.test(location) ||
    /\.pif\.b?gz$/i.test(location)
  ) {
    return {
      file: location,
      index: index || `${location}.tbi`,
    }
  } else if (/\.(fa|fasta|fas|fna|mfa)$/i.test(location)) {
    return {
      file: location,
      index: index || `${location}.fai`,
    }
  } else if (/\.(fa|fasta|fas|fna|mfa)\.b?gz$/i.test(location)) {
    return {
      file: location,
      index: `${location}.fai`,
      index2: `${location}.gzi`,
    }
  } else if (
    /\.2bit$/i.test(location) ||
    /\.bedpe(\.gz)?$/i.test(location) ||
    /\/trackData.jsonz?$/i.test(location) ||
    /\/sparql$/i.test(location) ||
    /\.out(\.gz)?$/i.test(location) ||
    /\.paf(\.gz)?$/i.test(location) ||
    /\.delta(\.gz)?$/i.test(location) ||
    /\.bed?$/i.test(location) ||
    /\.(bw|bigwig)$/i.test(location) ||
    /\.(bb|bigbed)$/i.test(location) ||
    /\.vcf$/i.test(location) ||
    /\.gtf?$/i.test(location) ||
    /\.gff3?$/i.test(location) ||
    /\.chain(\.gz)?$/i.test(location) ||
    /\.hic$/i.test(location)
  ) {
    return {
      file: location,
    }
  }

  return {}
}

export function guessAdapter({
  location,
  protocol,
  index,
  bed1,
  bed2,
}: {
  location: string
  protocol: string
  index?: string
  bed1?: string
  bed2?: string
}) {
  const makeLocation = makeLocationProtocol(protocol)
  if (/\.bam$/i.test(location)) {
    return {
      type: 'BamAdapter',
      bamLocation: makeLocation(location),
      index: {
        location: makeLocation(index || `${location}.bai`),
        indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'BAI',
      },
    }
  } else if (/\.cram$/i.test(location)) {
    return {
      type: 'CramAdapter',
      cramLocation: makeLocation(location),
      craiLocation: makeLocation(`${location}.crai`),
    }
  } else if (/\.gff3?$/i.test(location)) {
    return {
      type: 'Gff3Adapter',
      gffLocation: makeLocation(location),
    }
  } else if (/\.gff3?\.b?gz$/i.test(location)) {
    return {
      type: 'Gff3TabixAdapter',
      gffGzLocation: makeLocation(location),
      index: {
        location: makeLocation(index || `${location}.tbi`),
        indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
      },
    }
  } else if (/\.gtf?$/i.test(location)) {
    return {
      type: 'GtfAdapter',
      gtfLocation: makeLocation(location),
    }
  } else if (/\.vcf$/i.test(location)) {
    return {
      type: 'VcfAdapter',
      vcfLocation: makeLocation(location),
    }
  } else if (/\.vcf\.b?gz$/i.test(location)) {
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: makeLocation(location),
      index: {
        location: makeLocation(index || `${location}.tbi`),
        indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
      },
    }
  } else if (/\.vcf\.idx$/i.test(location)) {
    return {
      type: 'UNSUPPORTED',
    }
  } else if (/\.bedpe(.gz)?$/i.test(location)) {
    return {
      type: 'BedpeAdapter',
      bedpeLocation: makeLocation(location),
    }
  } else if (/\.bed$/i.test(location)) {
    return {
      type: 'BedAdapter',
      bedLocation: makeLocation(location),
    }
  } else if (/\.pif\.b?gz$/i.test(location)) {
    return {
      type: 'PairwiseIndexedPAFAdapter',
      pifGzLocation: makeLocation(location),
      index: {
        location: makeLocation(index || `${location}.tbi`),
        indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
      },
    }
  } else if (/\.bed\.b?gz$/i.test(location)) {
    return {
      type: 'BedTabixAdapter',
      bedGzLocation: makeLocation(location),
      index: {
        location: makeLocation(index || `${location}.tbi`),
        indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
      },
    }
  } else if (/\.(bb|bigbed)$/i.test(location)) {
    return {
      type: 'BigBedAdapter',
      bigBedLocation: makeLocation(location),
    }
  } else if (/\.(bw|bigwig)$/i.test(location)) {
    return {
      type: 'BigWigAdapter',
      bigWigLocation: makeLocation(location),
    }
  } else if (/\.(fa|fasta|fna|mfa)$/i.test(location)) {
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation: makeLocation(location),
      faiLocation: makeLocation(index || `${location}.fai`),
    }
  } else if (/\.(fa|fasta|fna|mfa)\.b?gz$/i.test(location)) {
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation: makeLocation(location),
      faiLocation: makeLocation(`${location}.fai`),
      gziLocation: makeLocation(`${location}.gzi`),
    }
  } else if (/\.2bit$/i.test(location)) {
    return {
      type: 'TwoBitAdapter',
      twoBitLocation: makeLocation(location),
    }
  } else if (/\.sizes$/i.test(location)) {
    return {
      type: 'UNSUPPORTED',
    }
  } else if (/\/trackData.jsonz?$/i.test(location)) {
    return {
      type: 'NCListAdapter',
      rootUrlTemplate: makeLocation(location),
    }
  } else if (/\/sparql$/i.test(location)) {
    return {
      type: 'SPARQLAdapter',
      endpoint: location,
    }
  } else if (/\.hic$/i.test(location)) {
    return {
      type: 'HicAdapter',
      hicLocation: makeLocation(location),
    }
  } else if (/\.paf(.gz)?$/i.test(location)) {
    return {
      type: 'PAFAdapter',
      pafLocation: makeLocation(location),
    }
  } else if (/\.out(.gz)?$/i.test(location)) {
    return {
      type: 'MashMapAdapter',
      outLocation: makeLocation(location),
    }
  } else if (/\.chain(.gz)?$/i.test(location)) {
    return {
      type: 'ChainAdapter',
      chainLocation: makeLocation(location),
    }
  } else if (/\.delta(.gz)?$/i.test(location)) {
    return {
      type: 'DeltaAdapter',
      deltaLocation: makeLocation(location),
    }
  } else if (/\.anchors(.gz)?$/i.test(location)) {
    return {
      type: 'MCScanAnchorsAdapter',
      mcscanAnchorsLocation: makeLocation(location),
      bed1Location: bed1 ? makeLocation(bed1) : undefined,
      bed2Location: bed2 ? makeLocation(bed2) : undefined,
    }
  } else if (/\.anchors.simple(.gz)?$/i.test(location)) {
    return {
      type: 'MCScanSimpleAnchorsAdapter',
      mcscanSimpleAnchorsLocation: makeLocation(location),
      bed1Location: bed1 ? makeLocation(bed1) : undefined,
      bed2Location: bed2 ? makeLocation(bed2) : undefined,
    }
  }

  return {
    type: 'UNKNOWN',
  }
}

export const adapterTypesToTrackTypeMap: Record<string, string> = {
  BamAdapter: 'AlignmentsTrack',
  CramAdapter: 'AlignmentsTrack',
  BgzipFastaAdapter: 'ReferenceSequenceTrack',
  BigWigAdapter: 'QuantitativeTrack',
  IndexedFastaAdapter: 'ReferenceSequenceTrack',
  TwoBitAdapter: 'ReferenceSequenceTrack',
  VcfTabixAdapter: 'VariantTrack',
  VcfAdapter: 'VariantTrack',
  BedpeAdapter: 'VariantTrack',
  BedAdapter: 'FeatureTrack',
  HicAdapter: 'HicTrack',
  PAFAdapter: 'SyntenyTrack',
  DeltaAdapter: 'SyntenyTrack',
  ChainAdapter: 'SyntenyTrack',
  MashMapAdapter: 'SyntenyTrack',
  PairwiseIndexedPAFAdapter: 'SyntenyTrack',
  MCScanAnchorsAdapter: 'SyntenyTrack',
  MCScanSimpleAnchorsAdapter: 'SyntenyTrack',
}

export function guessTrackType(adapterType: string): string {
  return adapterTypesToTrackTypeMap[adapterType] || 'FeatureTrack'
}
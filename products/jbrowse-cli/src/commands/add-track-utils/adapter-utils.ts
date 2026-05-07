interface UriLocation {
  uri: string
  locationType: 'UriLocation'
}

interface LocalPathLocation {
  localPath: string
  locationType: 'LocalPathLocation'
}

type Location = UriLocation | LocalPathLocation

export interface Adapter {
  type: string
  [key: string]: unknown
}

type AdapterSpec =
  | { kind: 'single'; adapterType: string; locField: string }
  | { kind: 'bam' }
  | { kind: 'cram' }
  | { kind: 'tabix'; adapterType: string; locField: string }
  | { kind: 'indexed-fasta' }
  | { kind: 'bgzip-fasta' }
  | { kind: 'anchors'; adapterType: string; locField: string }
  | { kind: 'nclist' }
  | { kind: 'sparql' }
  | { kind: 'unsupported' }

const formats: { regex: RegExp; spec: AdapterSpec }[] = [
  { regex: /\.bam$/i, spec: { kind: 'bam' } },
  { regex: /\.cram$/i, spec: { kind: 'cram' } },
  {
    regex: /\.gff3?\.b?gz$/i,
    spec: {
      kind: 'tabix',
      adapterType: 'Gff3TabixAdapter',
      locField: 'gffGzLocation',
    },
  },
  {
    regex: /\.gff3?$/i,
    spec: {
      kind: 'single',
      adapterType: 'Gff3Adapter',
      locField: 'gffLocation',
    },
  },
  {
    regex: /\.gtf?$/i,
    spec: {
      kind: 'single',
      adapterType: 'GtfAdapter',
      locField: 'gtfLocation',
    },
  },
  {
    regex: /\.vcf\.b?gz$/i,
    spec: {
      kind: 'tabix',
      adapterType: 'VcfTabixAdapter',
      locField: 'vcfGzLocation',
    },
  },
  { regex: /\.vcf\.idx$/i, spec: { kind: 'unsupported' } },
  {
    regex: /\.vcf$/i,
    spec: {
      kind: 'single',
      adapterType: 'VcfAdapter',
      locField: 'vcfLocation',
    },
  },
  {
    regex: /\.bedpe(\.gz)?$/i,
    spec: {
      kind: 'single',
      adapterType: 'BedpeAdapter',
      locField: 'bedpeLocation',
    },
  },
  {
    regex: /\.bed\.b?gz$/i,
    spec: {
      kind: 'tabix',
      adapterType: 'BedTabixAdapter',
      locField: 'bedGzLocation',
    },
  },
  {
    regex: /\.pif\.b?gz$/i,
    spec: {
      kind: 'tabix',
      adapterType: 'PairwiseIndexedPAFAdapter',
      locField: 'pifGzLocation',
    },
  },
  {
    regex: /\.bed$/i,
    spec: {
      kind: 'single',
      adapterType: 'BedAdapter',
      locField: 'bedLocation',
    },
  },
  {
    regex: /\.(bb|bigbed)$/i,
    spec: {
      kind: 'single',
      adapterType: 'BigBedAdapter',
      locField: 'bigBedLocation',
    },
  },
  {
    regex: /\.(bw|bigwig)$/i,
    spec: {
      kind: 'single',
      adapterType: 'BigWigAdapter',
      locField: 'bigWigLocation',
    },
  },
  { regex: /\.(fa|fasta|fna|mfa)\.b?gz$/i, spec: { kind: 'bgzip-fasta' } },
  { regex: /\.(fa|fasta|fna|mfa)$/i, spec: { kind: 'indexed-fasta' } },
  {
    regex: /\.2bit$/i,
    spec: {
      kind: 'single',
      adapterType: 'TwoBitAdapter',
      locField: 'twoBitLocation',
    },
  },
  { regex: /\.sizes$/i, spec: { kind: 'unsupported' } },
  { regex: /\/trackData\.jsonz?$/i, spec: { kind: 'nclist' } },
  { regex: /\/sparql$/i, spec: { kind: 'sparql' } },
  {
    regex: /\.hic$/i,
    spec: {
      kind: 'single',
      adapterType: 'HicAdapter',
      locField: 'hicLocation',
    },
  },
  {
    regex: /\.paf(\.gz)?$/i,
    spec: {
      kind: 'single',
      adapterType: 'PAFAdapter',
      locField: 'pafLocation',
    },
  },
  {
    regex: /\.out(\.gz)?$/i,
    spec: {
      kind: 'single',
      adapterType: 'MashMapAdapter',
      locField: 'outLocation',
    },
  },
  {
    regex: /\.chain(\.gz)?$/i,
    spec: {
      kind: 'single',
      adapterType: 'ChainAdapter',
      locField: 'chainLocation',
    },
  },
  {
    regex: /\.delta(\.gz)?$/i,
    spec: {
      kind: 'single',
      adapterType: 'DeltaAdapter',
      locField: 'deltaLocation',
    },
  },
  {
    regex: /\.anchors\.simple(\.gz)?$/i,
    spec: {
      kind: 'anchors',
      adapterType: 'MCScanSimpleAnchorsAdapter',
      locField: 'mcscanSimpleAnchorsLocation',
    },
  },
  {
    regex: /\.anchors(\.gz)?$/i,
    spec: {
      kind: 'anchors',
      adapterType: 'MCScanAnchorsAdapter',
      locField: 'mcscanAnchorsLocation',
    },
  },
]

function indexType(index: string | undefined, fallback: 'BAI' | 'TBI'): string {
  return index?.toUpperCase().endsWith('CSI') ? 'CSI' : fallback
}

function specToFiles(
  spec: AdapterSpec,
  location: string,
  index: string | undefined,
  bed1: string | undefined,
  bed2: string | undefined,
): Record<string, string | undefined> {
  switch (spec.kind) {
    case 'bam':
      return { file: location, index: index || `${location}.bai` }
    case 'cram':
      return { file: location, index: `${location}.crai` }
    case 'tabix':
      return { file: location, index: index || `${location}.tbi` }
    case 'indexed-fasta':
      return { file: location, index: index || `${location}.fai` }
    case 'bgzip-fasta':
      return {
        file: location,
        index: `${location}.fai`,
        index2: `${location}.gzi`,
      }
    case 'anchors':
      return { file: location, bed1, bed2 }
    case 'single':
    case 'nclist':
    case 'sparql':
      return { file: location }
    case 'unsupported':
      return {}
  }
}

function specToAdapter(
  spec: AdapterSpec,
  location: string,
  index: string | undefined,
  bed1: string | undefined,
  bed2: string | undefined,
  makeLocation: (l: string) => Location,
): Adapter {
  switch (spec.kind) {
    case 'single':
      return { type: spec.adapterType, [spec.locField]: makeLocation(location) }
    case 'bam':
      return {
        type: 'BamAdapter',
        bamLocation: makeLocation(location),
        index: {
          location: makeLocation(index || `${location}.bai`),
          indexType: indexType(index, 'BAI'),
        },
      }
    case 'cram':
      return {
        type: 'CramAdapter',
        cramLocation: makeLocation(location),
        craiLocation: makeLocation(`${location}.crai`),
      }
    case 'tabix':
      return {
        type: spec.adapterType,
        [spec.locField]: makeLocation(location),
        index: {
          location: makeLocation(index || `${location}.tbi`),
          indexType: indexType(index, 'TBI'),
        },
      }
    case 'indexed-fasta':
      return {
        type: 'IndexedFastaAdapter',
        fastaLocation: makeLocation(location),
        faiLocation: makeLocation(index || `${location}.fai`),
      }
    case 'bgzip-fasta':
      return {
        type: 'BgzipFastaAdapter',
        fastaLocation: makeLocation(location),
        faiLocation: makeLocation(`${location}.fai`),
        gziLocation: makeLocation(`${location}.gzi`),
      }
    case 'anchors':
      return {
        type: spec.adapterType,
        [spec.locField]: makeLocation(location),
        bed1Location: bed1 ? makeLocation(bed1) : undefined,
        bed2Location: bed2 ? makeLocation(bed2) : undefined,
      }
    case 'nclist':
      return { type: 'NCListAdapter', rootUrlTemplate: makeLocation(location) }
    case 'sparql':
      return { type: 'SPARQLAdapter', endpoint: location }
    case 'unsupported':
      return { type: 'UNSUPPORTED' }
  }
}

export function makeLocationProtocol(protocol: string) {
  return (location: string): Location => {
    if (protocol === 'uri') {
      return { uri: location, locationType: 'UriLocation' }
    }
    if (protocol === 'localPath') {
      return { localPath: location, locationType: 'LocalPathLocation' }
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
  for (const { regex, spec } of formats) {
    if (regex.test(location)) {
      return specToFiles(spec, location, index, bed1, bed2)
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
}): Adapter {
  const makeLocation = makeLocationProtocol(protocol)
  for (const { regex, spec } of formats) {
    if (regex.test(location)) {
      return specToAdapter(spec, location, index, bed1, bed2, makeLocation)
    }
  }
  return { type: 'UNKNOWN' }
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

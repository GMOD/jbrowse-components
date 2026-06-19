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

// the adapter specs that carry a location field, keyed by their adapter type,
// so an explicit --adapterType can be resolved back to its file-layout spec
type LocFieldSpec = Extract<AdapterSpec, { locField: string }>

const adapterTypeToSpec: Record<string, LocFieldSpec> = {}
for (const { spec } of formats) {
  if (
    spec.kind === 'single' ||
    spec.kind === 'tabix' ||
    spec.kind === 'anchors'
  ) {
    adapterTypeToSpec[spec.adapterType] = spec
  }
}

// kinds whose location fields are reused when an explicit --adapterType is
// given for a recognized file extension; other kinds yield a bare { type }
const locationKinds = new Set<AdapterSpec['kind']>([
  'bam',
  'cram',
  'indexed-fasta',
  'bgzip-fasta',
  'nclist',
  'sparql',
])

function indexType(index: string | undefined, fallback: 'BAI' | 'TBI'): string {
  return index?.toUpperCase().endsWith('CSI') ? 'CSI' : fallback
}

interface SpecContext {
  location: string
  index?: string
  bed1?: string
  bed2?: string
  makeLocation: (l: string) => Location
}

// builds the adapter object and the list of source files for a spec in one
// place, so the config it writes and the files add-track copies can never drift
function buildFromSpec(
  spec: AdapterSpec,
  { location, index, bed1, bed2, makeLocation }: SpecContext,
): { adapter: Adapter; files: (string | undefined)[] } {
  switch (spec.kind) {
    case 'single':
      return {
        adapter: {
          type: spec.adapterType,
          [spec.locField]: makeLocation(location),
        },
        files: [location],
      }
    case 'bam': {
      const idx = index || `${location}.bai`
      return {
        adapter: {
          type: 'BamAdapter',
          bamLocation: makeLocation(location),
          index: {
            location: makeLocation(idx),
            indexType: indexType(index, 'BAI'),
          },
        },
        files: [location, idx],
      }
    }
    case 'cram': {
      const idx = index || `${location}.crai`
      return {
        adapter: {
          type: 'CramAdapter',
          cramLocation: makeLocation(location),
          craiLocation: makeLocation(idx),
        },
        files: [location, idx],
      }
    }
    case 'tabix': {
      const idx = index || `${location}.tbi`
      return {
        adapter: {
          type: spec.adapterType,
          [spec.locField]: makeLocation(location),
          index: {
            location: makeLocation(idx),
            indexType: indexType(index, 'TBI'),
          },
        },
        files: [location, idx],
      }
    }
    case 'indexed-fasta': {
      const idx = index || `${location}.fai`
      return {
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation: makeLocation(location),
          faiLocation: makeLocation(idx),
        },
        files: [location, idx],
      }
    }
    case 'bgzip-fasta': {
      const fai = `${location}.fai`
      const gzi = `${location}.gzi`
      return {
        adapter: {
          type: 'BgzipFastaAdapter',
          fastaLocation: makeLocation(location),
          faiLocation: makeLocation(fai),
          gziLocation: makeLocation(gzi),
        },
        files: [location, fai, gzi],
      }
    }
    case 'anchors':
      return {
        adapter: {
          type: spec.adapterType,
          [spec.locField]: makeLocation(location),
          bed1Location: bed1 ? makeLocation(bed1) : undefined,
          bed2Location: bed2 ? makeLocation(bed2) : undefined,
        },
        files: [location, bed1, bed2],
      }
    case 'nclist':
      return {
        adapter: {
          type: 'NCListAdapter',
          rootUrlTemplate: makeLocation(location),
        },
        files: [location],
      }
    case 'sparql':
      return {
        adapter: { type: 'SPARQLAdapter', endpoint: location },
        files: [location],
      }
    case 'unsupported':
      return { adapter: { type: 'UNSUPPORTED' }, files: [] }
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

function matchFormat(location: string) {
  return formats.find(({ regex }) => regex.test(location))?.spec
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
}): (string | undefined)[] {
  const spec = matchFormat(location)
  // makeLocation only shapes the adapter, which is discarded here
  return spec
    ? buildFromSpec(spec, {
        location,
        index,
        bed1,
        bed2,
        makeLocation: makeLocationProtocol('uri'),
      }).files
    : []
}

export function guessAdapter({
  location,
  protocol,
  index,
  bed1,
  bed2,
  adapterType,
}: {
  location: string
  protocol: string
  index?: string
  bed1?: string
  bed2?: string
  adapterType?: string
}): Adapter {
  const ctx = {
    location,
    index,
    bed1,
    bed2,
    makeLocation: makeLocationProtocol(protocol),
  }
  const spec = matchFormat(location)

  if (adapterType) {
    const known = adapterTypeToSpec[adapterType]
    if (known) {
      // explicit --adapterType resolves back to its known file layout
      return buildFromSpec(known, ctx).adapter
    } else if (spec && locationKinds.has(spec.kind)) {
      // unknown adapter type, but the extension has a fixed location layout we
      // can reuse, just relabeling the adapter type
      return { ...buildFromSpec(spec, ctx).adapter, type: adapterType }
    } else {
      return { type: adapterType }
    }
  } else {
    return spec ? buildFromSpec(spec, ctx).adapter : { type: 'UNKNOWN' }
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

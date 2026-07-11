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

// a sidecar file sits next to the data file at `${location}${suffix}`, unless
// it is the index and the user passed --indexFile (fromIndex)
interface Sidecar {
  field: string
  suffix: string
  fromIndex?: boolean
}

type AdapterSpec =
  | { kind: 'single'; adapterType: string; locField: string }
  // wrapped-index adapters: index nests under `index: { location, indexType }`
  // (BAM + all tabix). indexType flips to CSI when the index is a .csi
  | {
      kind: 'indexed'
      adapterType: string
      locField: string
      suffix: string
      indexType: 'BAI' | 'TBI'
    }
  // flat-sidecar adapters: each sidecar is its own top-level location field
  // (CRAM crai, (bgzip-)fasta fai/gzi)
  | { kind: 'sidecar'; adapterType: string; locField: string; sidecars: Sidecar[] }
  | { kind: 'anchors'; adapterType: string; locField: string }
  | { kind: 'nclist' }
  | { kind: 'sparql' }
  | { kind: 'unsupported' }

const formats: { regex: RegExp; spec: AdapterSpec }[] = [
  {
    regex: /\.bam$/i,
    spec: {
      kind: 'indexed',
      adapterType: 'BamAdapter',
      locField: 'bamLocation',
      suffix: '.bai',
      indexType: 'BAI',
    },
  },
  {
    regex: /\.cram$/i,
    spec: {
      kind: 'sidecar',
      adapterType: 'CramAdapter',
      locField: 'cramLocation',
      sidecars: [{ field: 'craiLocation', suffix: '.crai', fromIndex: true }],
    },
  },
  {
    regex: /\.gff3?\.b?gz$/i,
    spec: {
      kind: 'indexed',
      adapterType: 'Gff3TabixAdapter',
      locField: 'gffGzLocation',
      suffix: '.tbi',
      indexType: 'TBI',
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
      kind: 'indexed',
      adapterType: 'VcfTabixAdapter',
      locField: 'vcfGzLocation',
      suffix: '.tbi',
      indexType: 'TBI',
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
      kind: 'indexed',
      adapterType: 'BedTabixAdapter',
      locField: 'bedGzLocation',
      suffix: '.tbi',
      indexType: 'TBI',
    },
  },
  {
    regex: /\.pif\.b?gz$/i,
    spec: {
      kind: 'indexed',
      adapterType: 'PairwiseIndexedPAFAdapter',
      locField: 'pifGzLocation',
      suffix: '.tbi',
      indexType: 'TBI',
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
  {
    regex: /\.(fa|fasta|fna|mfa)\.b?gz$/i,
    spec: {
      kind: 'sidecar',
      adapterType: 'BgzipFastaAdapter',
      locField: 'fastaLocation',
      sidecars: [
        { field: 'faiLocation', suffix: '.fai' },
        { field: 'gziLocation', suffix: '.gzi' },
      ],
    },
  },
  {
    regex: /\.(fa|fasta|fna|mfa)$/i,
    spec: {
      kind: 'sidecar',
      adapterType: 'IndexedFastaAdapter',
      locField: 'fastaLocation',
      sidecars: [{ field: 'faiLocation', suffix: '.fai', fromIndex: true }],
    },
  },
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

function hasLocField(spec: AdapterSpec): spec is LocFieldSpec {
  return 'locField' in spec
}

const adapterTypeToSpec: Record<string, LocFieldSpec> = {}
for (const { spec } of formats) {
  if (hasLocField(spec)) {
    adapterTypeToSpec[spec.adapterType] = spec
  }
}

// kinds with a fixed location layout but no registered adapterType, whose layout
// is still reused (relabeled) under an explicit --adapterType; other unmatched
// kinds yield a bare { type }
const locationKinds = new Set<AdapterSpec['kind']>(['nclist', 'sparql'])

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
    case 'indexed': {
      const idx = index || `${location}${spec.suffix}`
      return {
        adapter: {
          type: spec.adapterType,
          [spec.locField]: makeLocation(location),
          index: {
            location: makeLocation(idx),
            indexType: indexType(index, spec.indexType),
          },
        },
        files: [location, idx],
      }
    }
    case 'sidecar': {
      const sidecars = spec.sidecars.map(s => ({
        field: s.field,
        path: s.fromIndex && index ? index : `${location}${s.suffix}`,
      }))
      return {
        adapter: {
          type: spec.adapterType,
          [spec.locField]: makeLocation(location),
          ...Object.fromEntries(
            sidecars.map(s => [s.field, makeLocation(s.path)]),
          ),
        },
        files: [location, ...sidecars.map(s => s.path)],
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

// resolves the file-layout spec that both the adapter config and the copied
// file set derive from, honoring an explicit --adapterType. `typeOverride` is
// the label to stamp on the adapter when the extension's layout is reused under
// a different adapter type.
function resolveSpec(
  location: string,
  adapterType?: string,
): { spec?: AdapterSpec; typeOverride?: string } {
  const spec = matchFormat(location)
  if (adapterType) {
    const known = adapterTypeToSpec[adapterType]
    if (known) {
      // explicit --adapterType resolves back to its known file layout
      return { spec: known }
    } else if (spec && locationKinds.has(spec.kind)) {
      // unknown adapter type, but the extension has a fixed location layout we
      // can reuse, just relabeling the adapter type
      return { spec, typeOverride: adapterType }
    } else {
      // custom adapter type with no known layout: no files to reference or copy
      return { typeOverride: adapterType }
    }
  } else {
    return { spec }
  }
}

// derives the track adapter and the raw source files together from one spec, so
// the config written and the files add-track copies can never drift. mapLocation
// turns a raw source path into the location the adapter stores (relative path +
// protocol wrapper); the returned files stay raw for the copy step.
export function guessTrack({
  location,
  index,
  bed1,
  bed2,
  adapterType,
  mapLocation,
}: {
  location: string
  index?: string
  bed1?: string
  bed2?: string
  adapterType?: string
  mapLocation: (l: string) => Location
}): { adapter: Adapter; files: (string | undefined)[] } {
  const { spec, typeOverride } = resolveSpec(location, adapterType)
  if (spec) {
    const { adapter, files } = buildFromSpec(spec, {
      location,
      index,
      bed1,
      bed2,
      makeLocation: mapLocation,
    })
    return {
      adapter: typeOverride ? { ...adapter, type: typeOverride } : adapter,
      files,
    }
  }
  return { adapter: { type: typeOverride ?? 'UNKNOWN' }, files: [] }
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

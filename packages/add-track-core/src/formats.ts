import { adapterTypesToTrackTypeMap } from './trackTypes.generated.ts'

/**
 * A sidecar file sits next to the data file at `${location}${suffix}`, unless it
 * is the index and the caller was handed one explicitly (`fromIndex`).
 */
export interface Sidecar {
  field: string
  suffix: string
  fromIndex?: boolean
}

export type AdapterSpec =
  | { kind: 'single'; adapterType: string; locField: string }
  // wrapped-index adapters: the index nests under `index: { location,
  // indexType }` (BAM + all tabix). indexType flips to CSI for a `.csi`
  | {
      kind: 'indexed'
      adapterType: string
      locField: string
      suffix: string
      indexType: 'BAI' | 'TBI'
    }
  // flat-sidecar adapters: each sidecar is its own top-level location field
  // (CRAM crai, (bgzip-)fasta fai/gzi)
  | {
      kind: 'sidecar'
      adapterType: string
      locField: string
      sidecars: Sidecar[]
    }
  // like 'single', plus the two optional BED files the CLI's --bed1/--bed2 fill
  | { kind: 'anchors'; adapterType: string; locField: string }
  // an extension JBrowse recognizes and deliberately refuses
  | { kind: 'unsupported' }

export interface FormatEntry {
  /**
   * Matched against the bare filename. Every regex in a list must match, which
   * is how a format identified by more than its extension is spelled. Absent
   * means the format is reachable only by naming its adapter type, because its
   * extension is indistinguishable from another format's.
   */
  regex?: RegExp | RegExp[]
  spec: AdapterSpec
  /**
   * Track type for files matching this entry, where the adapter alone does not
   * decide it — a `.bedmethyl.gz` and a plain `.bed.gz` are both read by
   * `BedTabixAdapter` but drawn differently.
   */
  trackType?: string
}

/**
 * Every file format the "Add track" flow knows, in first-match order.
 *
 * One table, two consumers: `@jbrowse/core`'s `Core-guessAdapterForLocation`
 * chain and `@jbrowse/cli`'s `add-track`. Twelve plugins and the CLI used to
 * carry a copy each, in different shapes, and drifted — the CLI never learned
 * `.bedmethyl.gz` or `.fas`, the plugins never learned `.bed.bgz`, and half the
 * comparative regexes had an unescaped dot.
 *
 * An entry here does not make a build able to open the format. Core guesses an
 * entry only when its adapter type is registered, so the plugin providing the
 * adapter is still what decides, and there is no second list to keep in step.
 *
 * Order matters only where two regexes can match the same name:
 * `.anchors.simple.gz` must precede `.anchors.gz`, and the tabix entries must
 * precede their plain counterparts.
 */
export const formats: FormatEntry[] = [
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
    regex: /\.sam(\.gz)?$/i,
    spec: {
      kind: 'single',
      adapterType: 'SamAdapter',
      locField: 'samLocation',
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
    regex: /\.gtf\.b?gz$/i,
    spec: {
      kind: 'indexed',
      adapterType: 'GtfTabixAdapter',
      locField: 'gtfGzLocation',
      suffix: '.tbi',
      indexType: 'TBI',
    },
  },
  {
    regex: /\.gtf$/i,
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
    regex: /\.ld\.b?gz$/i,
    spec: {
      kind: 'indexed',
      adapterType: 'PlinkLDTabixAdapter',
      locField: 'ldLocation',
      suffix: '.tbi',
      indexType: 'TBI',
    },
  },
  {
    regex: /\.ld$/i,
    spec: {
      kind: 'single',
      adapterType: 'PlinkLDAdapter',
      locField: 'ldLocation',
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
    // STAR-Fusion writes a plain TSV, so the tool's name in the filename is the
    // only thing separating it from any other `.tsv`
    regex: [/(star-?fusion|fusion_predictions)/i, /\.tsv(\.gz)?$/i],
    spec: {
      kind: 'single',
      adapterType: 'StarFusionAdapter',
      locField: 'starFusionLocation',
    },
  },
  {
    regex: /\.bedmethyl\.b?gz$/i,
    spec: {
      kind: 'indexed',
      adapterType: 'BedTabixAdapter',
      locField: 'bedGzLocation',
      suffix: '.tbi',
      indexType: 'TBI',
    },
    trackType: 'MultiQuantitativeTrack',
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
    regex: /\.bg\.b?gz$/i,
    spec: {
      kind: 'indexed',
      adapterType: 'BedGraphTabixAdapter',
      locField: 'bedGraphGzLocation',
      suffix: '.tbi',
      indexType: 'TBI',
    },
  },
  {
    regex: /\.bg$/i,
    spec: {
      kind: 'single',
      adapterType: 'BedGraphAdapter',
      locField: 'bedGraphLocation',
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
    // the Pan-UKBB GWAS flat-file convention. `.bed.gz` is deliberately left to
    // BedTabixAdapter — telling a GWAS BED from a generic one needs
    // column-level sniffing, not an extension
    regex: /\.txt\.gz$/i,
    spec: {
      kind: 'indexed',
      adapterType: 'GWASAdapter',
      locField: 'bedGzLocation',
      suffix: '.tbi',
      indexType: 'TBI',
    },
  },
  {
    regex: /\.(fa|fasta|fas|fna|mfa)\.b?gz$/i,
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
    regex: /\.(fa|fasta|fas|fna|mfa)$/i,
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
  {
    regex: /trackData\.jsonz?$/i,
    spec: {
      kind: 'single',
      adapterType: 'NCListAdapter',
      locField: 'rootUrlTemplate',
    },
  },
  {
    regex: /^sparql$/i,
    spec: {
      kind: 'single',
      adapterType: 'SPARQLAdapter',
      locField: 'endpoint',
    },
  },
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
  {
    // an all-vs-all PAF looks like any `.paf`; the assembly list and the PanSN
    // mapping come from its add-track form
    spec: {
      kind: 'single',
      adapterType: 'AllVsAllPAFAdapter',
      locField: 'pafLocation',
    },
  },
  {
    // likewise an all-vs-all PIF against a pairwise one
    spec: {
      kind: 'indexed',
      adapterType: 'AllVsAllIndexedPAFAdapter',
      locField: 'pifGzLocation',
      suffix: '.tbi',
      indexType: 'TBI',
    },
  },
  {
    spec: {
      kind: 'single',
      adapterType: 'MCScanBlocksAdapter',
      locField: 'mcscanBlocksLocation',
    },
  },
  {
    spec: {
      kind: 'single',
      adapterType: 'BlastTabularAdapter',
      locField: 'blastTableLocation',
    },
  },
]

function matchesRegex(fileName: string, regex: RegExp | RegExp[]) {
  return Array.isArray(regex)
    ? regex.every(r => r.test(fileName))
    : regex.test(fileName)
}

/**
 * The format `fileName` is, or — when `adapterHint` names an adapter type — that
 * adapter's format whatever the filename says. A hint always wins, which is what
 * lets the add-track form open a file the extension alone cannot identify.
 */
export function matchFormat(fileName: string, adapterHint?: string) {
  return adapterHint
    ? formats.find(
        f => 'adapterType' in f.spec && f.spec.adapterType === adapterHint,
      )
    : formats.find(f => f.regex && matchesRegex(fileName, f.regex))
}

/**
 * The track type to draw `adapterType` with, from its config schema's
 * `#trackType` tag. `fileName` is what distinguishes the formats that share an
 * adapter — a `.bedmethyl.gz` from a plain `.bed.gz` — so pass it when known.
 */
export function trackTypeForAdapter(adapterType: string, fileName?: string) {
  const entry = fileName ? matchFormat(fileName) : undefined
  return entry?.trackType &&
    'adapterType' in entry.spec &&
    entry.spec.adapterType === adapterType
    ? entry.trackType
    : adapterTypesToTrackTypeMap[adapterType]
}

/**
 * The index spelling a location implies: htslib writes `.csi` in place of a
 * `.bai` or a `.tbi` for a reference over 512 Mb, and on request at any size.
 */
export function resolveIndexType(
  indexName: string | undefined,
  fallback: 'BAI' | 'TBI',
) {
  return indexName?.toUpperCase().endsWith('CSI') ? 'CSI' : fallback
}

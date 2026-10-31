import {
  expandAssemblySequence,
  expandSidecarShorthand,
  refNameAliasAdapterType,
} from '@jbrowse/core/assemblyManager/expandAssemblyConfigShorthand'
import { resolveUri } from '@jbrowse/core/util'

/** A view's region, 0-based half-open, on the assembly's canonical contig. */
export interface Region {
  refName: string
  start: number
  end: number
}

export interface RExportTrack {
  trackId: string
  trackName: string
  displayType: string
  adapter: Record<string, unknown>
  /** The display's config as written, its defaults left out, which the engine fills from the same schema. */
  display: Record<string, unknown>
  /** The display's resolved sizing, which a feature track exports so the figure drops what the view drops. */
  heightMode?: unknown
  height?: unknown
  /** A variant display drawing its records alone, with no sample rows, which reads as a feature track. */
  recordsOnly?: boolean
}

interface ReaderAdapter {
  slot?: string
  ext?: RegExp
  index?: string
}

const VCF_ADAPTERS: Record<string, ReaderAdapter> = {
  VcfTabixAdapter: { slot: 'vcfGzLocation', ext: /\.vcf\.gz$/, index: '.tbi' },
  VcfAdapter: { slot: 'vcfLocation', ext: /\.vcf$/ },
}

/**
 * Each display ggjbrowse reads, by the reader that reads it, and the adapters
 * it opens: the slot holding the file, the extension the reader knows it by,
 * and the suffix of the index the reader looks for beside it.
 */
export const READERS: Record<
  string,
  {
    call: string
    /** The reader for the display drawing no sample rows, its records alone. */
    recordsOnlyCall?: string
    adapters: Record<string, ReaderAdapter>
  }
> = {
  LinearBasicDisplay: {
    call: 'jbrowse_features',
    adapters: {
      Gff3TabixAdapter: {
        slot: 'gffGzLocation',
        ext: /\.gff3?\.gz$/,
        index: '.tbi',
      },
      Gff3Adapter: { slot: 'gffLocation', ext: /\.gff3?$/ },
      GtfTabixAdapter: {
        slot: 'gtfGzLocation',
        ext: /\.gtf\.gz$/,
        index: '.tbi',
      },
      GtfAdapter: { slot: 'gtfLocation', ext: /\.gtf$/ },
      BedTabixAdapter: {
        slot: 'bedGzLocation',
        ext: /\.bed\.gz$/,
        index: '.tbi',
      },
      BedAdapter: { slot: 'bedLocation', ext: /\.bed$/ },
      BigBedAdapter: { slot: 'bigBedLocation', ext: /\.(bb|bigbed)$/ },
    },
  },
  LinearVariantDisplay: {
    call: 'jbrowse_variants',
    recordsOnlyCall: 'jbrowse_features',
    adapters: VCF_ADAPTERS,
  },
  LinearWiggleDisplay: {
    call: 'jbrowse_wiggle',
    adapters: {
      BigWigAdapter: { slot: 'bigWigLocation', ext: /$/ },
      MultiWiggleAdapter: {},
    },
  },
  LinearAlignmentsDisplay: {
    call: 'jbrowse_alignments',
    adapters: {
      BamAdapter: { slot: 'bamLocation', ext: /(?<!\.cram)$/, index: '.bai' },
      CramAdapter: { slot: 'cramLocation', ext: /\.cram$/, index: '.crai' },
    },
  },
}

/**
 * The ggjbrowse release the script is tested against: its floor, and the tag
 * its install line pins. The R export workflow installs this tag on a push.
 */
export const GGJBROWSE_VERSION = '0.11.0'

const INSTALL = `remotes::install_github("GMOD/ggjbrowse@v${GGJBROWSE_VERSION}")`

function isSet(value: unknown) {
  return !(
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  )
}

/**
 * A resolved config writes an unset slot as `''`, `[]` or `{}`, which a reader
 * would take for a setting. Keeps `false` and `0`, which are values.
 */
export function withoutUnset(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutUnset)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([k, v]) => [k, withoutUnset(v)] as const)
        .filter(([, v]) => isSet(v)),
    )
  }
  return value
}

export function rStr(s: string) {
  return JSON.stringify(s)
}

const RESERVED = new Set([
  'if',
  'else',
  'repeat',
  'while',
  'function',
  'for',
  'next',
  'break',
  'in',
  'TRUE',
  'FALSE',
  'NULL',
  'Inf',
  'NaN',
  'NA',
  'NA_integer_',
  'NA_real_',
  'NA_complex_',
  'NA_character_',
])

function isIdentifier(s: string) {
  return (
    /^([A-Za-z]|\.(?!\d))[A-Za-z0-9._]*$/.test(s) &&
    !/^(\.\.\.|\.\.\d+)$/.test(s) &&
    !RESERVED.has(s)
  )
}

/**
 * A config value as the R literal ggjbrowse hands the engine: a `list` per
 * object, `c()` per vector of scalars, `list()` per vector of objects and per
 * empty vector, which jsonlite would otherwise write as `{}`.
 */
export function rValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'string') {
    return rStr(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return typeof value === 'number' ? String(value) : value ? 'TRUE' : 'FALSE'
  }
  if (Array.isArray(value)) {
    const items = value.map(rValue).join(', ')
    return value.length && value.every(v => typeof v !== 'object')
      ? `c(${items})`
      : `list(${items})`
  }
  return `list(${Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${isIdentifier(k) ? k : rStr(k)} = ${rValue(v)}`)
    .join(', ')})`
}

/**
 * The path or URL a JBrowse file location points at, as R opens it: a `uri`
 * resolved against its `baseUri` as the browser's fetch resolved it, a
 * `file://` URL as its path, or a `localPath`.
 */
export function locationPath(location: unknown) {
  const loc = location as
    | { uri?: string; baseUri?: string; localPath?: string }
    | undefined
  if (!loc?.uri) {
    return loc?.localPath
  }
  const resolved = resolveUri({ uri: loc.uri, baseUri: loc.baseUri })
  return resolved.startsWith('file://')
    ? decodeURIComponent(new URL(resolved).pathname)
    : resolved
}

function isLocation(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    (typeof (v as { uri?: unknown }).uri === 'string' ||
      typeof (v as { localPath?: unknown }).localPath === 'string')
  )
}

/** An adapter config with each location a path or URL R opens, each path also pushed onto `uris`. */
function openable(value: unknown, uris: string[]): unknown {
  if (isLocation(value)) {
    const uri = locationPath(value)
    if (uri) {
      uris.push(uri)
    }
    return { uri }
  }
  if (Array.isArray(value)) {
    return value.map(v => openable(v, uris))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, openable(v, uris)]),
    )
  }
  return value
}

/**
 * The file argument of a track's reader: its path where ggjbrowse would choose
 * the track's adapter for it from the extension, and the adapter config itself
 * where the adapter carries a setting or the name hides its format, so every
 * setting reaches the engine as the browser has it.
 */
function fileArgument(
  adapters: Record<string, ReaderAdapter>,
  adapter: Record<string, unknown>,
): { file: string; index?: string; uris: string[] } | { skipped: string } {
  const type = String(adapter.type)
  const known = adapters[type]
  if (!known) {
    return { skipped: `${type} has no R reader for this display` }
  }
  const uris: string[] = []
  const located = withoutUnset(openable(adapter, uris)) as Record<
    string,
    unknown
  >
  if (uris.length === 0) {
    return { skipped: `${type} names no file` }
  }
  if (uris.some(u => u.startsWith('blob:'))) {
    return {
      skipped: 'it reads a file opened in the browser, which R cannot reach',
    }
  }
  const file = known.slot ? locationPath(adapter[known.slot]) : undefined
  const index = adapter.index as
    | { location?: unknown; indexType?: string }
    | undefined
  const indexPath =
    locationPath(index?.location) ?? locationPath(adapter.craiLocation)
  const plainSlots = new Set(['type', 'index', 'craiLocation', known.slot])
  const plain =
    file !== undefined &&
    known.ext?.test(file.replace(/\?.*$/, '').toLowerCase()) &&
    Object.keys(located).every(k => plainSlots.has(k)) &&
    Object.keys(index ?? {}).every(
      k => k === 'location' || k === 'indexType',
    ) &&
    (index?.indexType === 'CSI') === !!indexPath?.endsWith('.csi')
  return plain
    ? {
        file: rStr(file),
        index:
          indexPath && indexPath !== `${file}${known.index}`
            ? indexPath
            : undefined,
        uris,
      }
    : { file: rValue(located), uris }
}

/**
 * Each sequence adapter `jbrowse_assembly()` builds from a path, by the
 * extension ggjbrowse reads it off, and the index each takes beside it.
 */
export const SEQUENCE_ADAPTERS: Record<
  string,
  { slot: string; ext: RegExp; beside: Record<string, string> }
> = {
  TwoBitAdapter: { slot: 'twoBitLocation', ext: /\.2bit$/, beside: {} },
  BgzipFastaAdapter: {
    slot: 'fastaLocation',
    ext: /\.gz$/,
    beside: { faiLocation: '.fai', gziLocation: '.gzi' },
  },
  IndexedFastaAdapter: {
    slot: 'fastaLocation',
    ext: /^(?!.*\.(2bit|gz)$)/,
    beside: { faiLocation: '.fai' },
  },
}

/** The path of a sequence adapter `jbrowse_assembly()` rebuilds from that path alone. */
function plainSequence(adapter: Record<string, unknown>) {
  const { type, uri, baseUri, ...slots } = adapter
  if (type === undefined && typeof uri === 'string') {
    return Object.keys(slots).length
      ? undefined
      : locationPath({ uri, baseUri })
  }
  const known = SEQUENCE_ADAPTERS[String(type)]
  const file = known && uri === undefined && locationPath(slots[known.slot])
  return file &&
    known.ext.test(file.replace(/\?.*$/, '').toLowerCase()) &&
    Object.entries(slots).every(
      ([k, v]) =>
        k === known.slot ||
        (known.beside[k] !== undefined &&
          locationPath(v) === `${file}${known.beside[k]}`),
    )
    ? file
    : undefined
}

/** The path of an alias adapter ggjbrowse reads as that path alone. */
function plainAliases(adapter: Record<string, unknown>) {
  const { type, uri, baseUri, location, ...rest } = adapter
  const file =
    typeof uri === 'string'
      ? locationPath({ uri, baseUri })
      : locationPath(location)
  return file &&
    Object.keys(rest).length === 0 &&
    type === refNameAliasAdapterType(file)
    ? file
    : undefined
}

/**
 * The view's assembly as the R value every reader takes: `jbrowse_assembly()`
 * of its sequence and alias files where ggjbrowse builds the same config from
 * their paths, and otherwise the config itself, its locations paths R opens.
 */
export function assemblyArgument(
  snapshot: Record<string, unknown>,
): { value: string } | { skipped: string } {
  const config = expandAssemblySequence(snapshot)
  const name = String(config.name)
  const sequence = withoutUnset(
    (config.sequence as { adapter?: unknown } | undefined)?.adapter,
  ) as Record<string, unknown> | undefined
  if (!sequence) {
    return { skipped: 'the assembly names no sequence' }
  }
  const aliasConfig = config.refNameAliases as
    | Record<string, unknown>
    | undefined
  const aliases = aliasConfig
    ? (withoutUnset(
        expandSidecarShorthand(aliasConfig, refNameAliasAdapterType).adapter,
      ) as Record<string, unknown>)
    : undefined
  const uris: string[] = []
  const located = {
    name,
    sequence: { adapter: openable(sequence, uris) },
    ...(aliases
      ? { refNameAliases: { adapter: openable(aliases, uris) } }
      : {}),
  }
  if (uris.some(u => u.startsWith('blob:'))) {
    return {
      skipped:
        'the assembly reads a file opened in the browser, which R cannot reach',
    }
  }
  const sequenceFile = plainSequence(sequence)
  const aliasFile = aliases && plainAliases(aliases)
  return sequenceFile && (!aliases || aliasFile)
    ? {
        value: `jbrowse_assembly(${[
          rStr(sequenceFile),
          ...(aliasFile ? [rStr(aliasFile)] : []),
          `name = ${rStr(name)}`,
        ].join(', ')})`,
      }
    : { value: rValue(located) }
}

/** A region as JBrowse's location box writes it, 1-based and inclusive. */
export function locusOf(refName: string, start: number, end: number) {
  const n = (x: number) => Math.round(x).toLocaleString('en-US')
  return `${refName}:${n(start + 1)}-${n(end)}`
}

function lociLiteral(loci: readonly string[]) {
  return loci.length === 1
    ? rStr(loci[0]!)
    : `c(${loci.map(l => rStr(l)).join(', ')})`
}

/** An R-safe name per track id, unique within the script. */
function trackNames(tracks: readonly RExportTrack[]) {
  const taken = new Set<string>(['locus', 'width', 'assembly', 'fig'])
  return tracks.map(track => {
    let base = track.trackId
      .replaceAll(/[^a-zA-Z0-9]/g, '_')
      .replace(/^(?=[\d_])/, 'x')
    if (!isIdentifier(base)) {
      base = `${base}_track`
    }
    let name = base
    for (let n = 2; taken.has(name); n++) {
      name = `${base}_${n}`
    }
    taken.add(name)
    return name
  })
}

/**
 * A track's `jbrowse_stack()` argument, named as the view labels it so its
 * band is titled. A name `width` would set the stack's own `width`, so that
 * one goes in a list, whose names title its tracks too.
 */
function stackArgument(title: string, name: string) {
  return title === 'width'
    ? `list(width = ${name})`
    : `${isIdentifier(title) ? title : rStr(title)} = ${name}`
}

/** What the figure cannot show of a track whose settings ggjbrowse reads. */
// The variant display's record settings, under `records`, as the feature
// track's top-level spelling `jbrowse_features` reads; the genotype rows'
// settings stay behind.
const RECORD_SETTINGS = [
  'displayMode',
  'mark',
  'labels',
  'facet',
  'maxFeatureScreenDensity',
] as const
const SHARED_SETTINGS = [
  'filter',
  'encoding',
  'legend',
  'heightMode',
  'growMaxHeight',
] as const

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function recordsAsFeatureDisplay(display: Record<string, unknown>) {
  const records = isRecord(display.records) ? display.records : {}
  const tooltip = {
    ...(isRecord(display.tooltip) ? display.tooltip : {}),
    ...(isRecord(records.tooltip) ? records.tooltip : {}),
  }
  return Object.fromEntries([
    ...SHARED_SETTINGS.flatMap(k =>
      display[k] === undefined ? [] : [[k, display[k]]],
    ),
    ...RECORD_SETTINGS.flatMap(k =>
      records[k] === undefined ? [] : [[k, records[k]]],
    ),
    ...(Object.keys(tooltip).length > 0 ? [['tooltip', tooltip]] : []),
  ])
}

function settingNotes(track: RExportTrack) {
  const { color } =
    (track.display.encoding as { color?: { field?: string } } | undefined) ?? {}
  return [
    ...(color?.field === 'mateRefName'
      ? [
          'color: mateRefName colors each contig by its hash, where the browser orders them by the assembly',
        ]
      : []),
  ]
}

/**
 * One R script for a view's tracks over its regions: a ggjbrowse reader per
 * track, reading each as its display does, then `jbrowse_stack()` drawing
 * them as the view stacks them. A track ggjbrowse cannot read lands in the
 * header instead of stopping the figure: a script that quietly differs from
 * its view says so.
 */
export function exportTracksToR({
  tracks,
  regions,
  assembly: assemblySnapshot,
  bpPerPx,
  colorByFrame = false,
  showAminoAcids = true,
  out = 'figure.png',
  notes: viewNotes = [],
}: {
  tracks: readonly RExportTrack[]
  regions: readonly Region[]
  /** The view's assembly config as written, which names its sequence and its contigs' aliases. */
  assembly?: Record<string, unknown>
  /** The view's zoom, which decides what a feature or quantitative display shows. */
  bpPerPx: number
  /** The view's "CDS reading frame colors", which a feature track takes. */
  colorByFrame?: boolean
  /** The view's "Amino acids when zoomed in", which a feature track takes. */
  showAminoAcids?: boolean
  out?: string
  /** What the caller knows of the view that the figure does not show. */
  notes?: readonly string[]
}) {
  const notes = [...viewNotes]
  const assembly = assemblySnapshot && assemblyArgument(assemblySnapshot)
  if (assembly && 'skipped' in assembly) {
    notes.push(`assembly: ${assembly.skipped}`)
  }
  const assemblyValue =
    assembly && 'value' in assembly ? assembly.value : undefined
  const loci = regions.map(r => locusOf(r.refName, r.start, r.end))
  const totalBp = regions.reduce((sum, r) => sum + r.end - r.start, 0)
  const viewPx = Math.round(totalBp / bpPerPx)
  const names = trackNames(tracks)
  const reads: string[] = []
  const drawn: string[] = []
  const bands: string[] = []
  let alignments: string | undefined
  tracks.forEach((track, i) => {
    const known = READERS[track.displayType]
    if (!known) {
      notes.push(
        `${track.trackName}: ${track.displayType} has no R reader in ggjbrowse yet`,
      )
      return
    }
    const recordsCall = track.recordsOnly ? known.recordsOnlyCall : undefined
    const asRecords = recordsCall !== undefined
    const reader = {
      adapters: known.adapters,
      call: recordsCall ?? known.call,
    }
    const source = fileArgument(reader.adapters, track.adapter)
    if ('skipped' in source) {
      notes.push(`${track.trackName}: ${source.skipped}`)
      return
    }
    const { heightMode, height } = track
    const written = asRecords
      ? recordsAsFeatureDisplay(track.display)
      : track.display
    const display =
      reader.call === 'jbrowse_features'
        ? {
            ...written,
            ...(heightMode === undefined ? {} : { heightMode }),
            ...(height === undefined ? {} : { height }),
          }
        : written
    const geneTrack = track.displayType === 'LinearBasicDisplay'
    const args = [
      ...(Object.keys(display).length ? [`display = ${rValue(display)}`] : []),
      'width = width',
      ...(assemblyValue ? ['assembly = assembly'] : []),
      ...(geneTrack && colorByFrame ? ['color_by_cds = TRUE'] : []),
      ...(geneTrack && !showAminoAcids ? ['amino_acids = FALSE'] : []),
      ...(source.index ? [`index = ${rStr(source.index)}`] : []),
    ]
    const name = names[i]!
    reads.push(
      [
        `# ${track.trackName}`,
        `${name} <- ${reader.call}(${source.file},`,
        `  ${['locus', ...args].join(',\n  ')})`,
      ].join('\n'),
    )
    drawn.push(name)
    bands.push(stackArgument(track.trackName, name))
    if (reader.call === 'jbrowse_alignments') {
      alignments ??= name
    }
    notes.push(
      ...[
        ...(source.uris.some(u => u.includes('://') && u.includes('?'))
          ? [
              'source: a URL carries its query string, credential included, so the script is not one to share',
            ]
          : []),
        ...settingNotes(track),
      ].map(n => `${track.trackName}: ${n}`),
    )
  })
  if (drawn.length === 0) {
    return { drawn: 0, script: undefined, notes }
  }
  const script = [
    "# Generated by JBrowse 2: the view's tracks, read by ggjbrowse, JBrowse's",
    '# own engine in R, and drawn as the view stacks them.',
    `# Install ggjbrowse with ${INSTALL}`,
    '#',
    '# Each reader returns the tables its track draws; jbrowse_stack() draws',
    '# them. Restyle every band with &, or draw one alone and add to it:',
    '#   fig & ggplot2::theme_classic()',
    `#   ${alignments ? `autoplot(${alignments}, "pileup")` : `autoplot(${drawn[0]})`} + ggplot2::theme_classic()`,
    ...(notes.length
      ? [
          '#',
          '# What this figure does not show:',
          ...notes.map(n => `#   - ${n}`),
        ]
      : []),
    '',
    'if (',
    '  !requireNamespace("ggjbrowse", quietly = TRUE) ||',
    `    packageVersion("ggjbrowse") < ${rStr(GGJBROWSE_VERSION)}`,
    ') {',
    `  stop("this script needs ggjbrowse ${GGJBROWSE_VERSION} or later: ${INSTALL.replaceAll('"', '\\"')}")`,
    '}',
    'library(ggjbrowse)',
    '',
    `locus <- ${lociLiteral(loci)}`,
    ...(assemblyValue
      ? [
          "# The view's assembly: the reference every reader reads against, and",
          '# the aliases that name each contig as each file spells it.',
          `assembly <- ${assemblyValue}`,
        ]
      : []),
    "# The view's pixels across its regions. A smaller number lays the tracks",
    '# out as a narrower browser window would, for a narrower figure with',
    '# fewer labels at the same size.',
    `width <- ${viewPx}`,
    '',
    reads.join('\n\n'),
    '',
    `fig <- jbrowse_stack(${bands.join(',\n  ')})`,
    'print(fig)',
    `ggplot2::ggsave(${rStr(out)}, fig, width = jbrowse_width(fig), height = jbrowse_height(fig))`,
    '',
  ].join('\n')
  return { drawn: drawn.length, script, notes }
}

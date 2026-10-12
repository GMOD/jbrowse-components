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
  /** The display's resolved config. */
  display: Record<string, unknown>
  /** `display` as written, its defaults left out, which the engine fills from the same schema. */
  writtenDisplay?: Record<string, unknown>
  /** The assembly's FASTA or 2bit, for a CRAM and a read with no MD tag. */
  reference?: string
  /** Canonical refName to the name the track's file spells it with, where they differ. */
  refNames?: Record<string, string>
  /** The view's zoom, which decides what a feature or quantitative display shows. */
  viewBpPerPx?: number
}

/**
 * Each display ggjbrowse reads, by the reader that reads it, and the adapters
 * it opens (the slot holding the file and the extension the reader knows it
 * by).
 */
const READERS: Record<
  string,
  {
    call: string
    adapters: Record<string, { slot?: string; ext?: RegExp }>
  }
> = {
  LinearBasicDisplay: {
    call: 'jbrowse_features',
    adapters: {
      Gff3TabixAdapter: { slot: 'gffGzLocation', ext: /\.gff3?\.gz$/ },
      Gff3Adapter: { slot: 'gffLocation', ext: /\.gff3?$/ },
      GtfAdapter: { slot: 'gtfLocation', ext: /\.gtf$/ },
      BedTabixAdapter: { slot: 'bedGzLocation', ext: /\.bed\.gz$/ },
      BedAdapter: { slot: 'bedLocation', ext: /\.bed$/ },
      BigBedAdapter: { slot: 'bigBedLocation', ext: /\.(bb|bigbed)$/ },
    },
  },
  LinearVariantDisplay: {
    call: 'jbrowse_features',
    adapters: {
      VcfTabixAdapter: { slot: 'vcfGzLocation', ext: /\.vcf\.gz$/ },
      VcfAdapter: { slot: 'vcfLocation', ext: /\.vcf$/ },
    },
  },
  LinearMultiSampleVariantDisplay: {
    call: 'jbrowse_variants',
    adapters: {
      VcfTabixAdapter: { slot: 'vcfGzLocation', ext: /\.vcf\.gz$/ },
      VcfAdapter: { slot: 'vcfLocation', ext: /\.vcf$/ },
    },
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
      BamAdapter: { slot: 'bamLocation', ext: /(?<!\.cram)$/ },
      CramAdapter: { slot: 'cramLocation', ext: /\.cram$/ },
    },
  },
}

/** The ggjbrowse release whose readers and `jbrowse_stack` the script calls. */
export const GGJBROWSE_VERSION = '0.3.0'

const INSTALL = 'remotes::install_github("GMOD/ggjbrowse")'
const WIDTH_INCHES = 10

/** Slots that name the display rather than set it. */
const NAMING_SLOTS = new Set(['type', 'displayId'])

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
])

function isIdentifier(s: string) {
  return /^[A-Za-z.][A-Za-z0-9._]*$/.test(s) && !RESERVED.has(s)
}

/** An R name safe on the left of `=` inside `list()`. */
function rName(s: string) {
  return isIdentifier(s) ? s : rStr(s)
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
    .map(([k, v]) => `${rName(k)} = ${rValue(v)}`)
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

/** An adapter config with each location a path or URL R opens. */
function openable(value: unknown): unknown {
  if (isLocation(value)) {
    return { uri: locationPath(value) }
  }
  if (Array.isArray(value)) {
    return value.map(openable)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, openable(v)]),
    )
  }
  return value
}

function pathsIn(value: unknown): string[] {
  if (isLocation(value)) {
    return [locationPath(value) ?? '']
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(pathsIn)
  }
  return []
}

/**
 * The file argument of a track's reader: its path where ggjbrowse would choose
 * the track's adapter for it from the extension, and the adapter config itself
 * where the adapter carries a setting or the name hides its format, so every
 * setting reaches the engine as the browser has it.
 */
function fileArgument(
  adapters: Record<string, { slot?: string; ext?: RegExp }>,
  adapter: Record<string, unknown>,
): { file: string; index?: string; uris: string[] } | { skipped: string } {
  const type = String(adapter.type)
  const known = adapters[type]
  if (!known) {
    return { skipped: `${type} has no R reader for this display` }
  }
  const located = withoutUnset(openable(adapter)) as Record<string, unknown>
  const uris = pathsIn(located).filter(Boolean)
  if (uris.length === 0) {
    return { skipped: `${type} names no file` }
  }
  if (uris.some(u => u.startsWith('blob:'))) {
    return {
      skipped: 'it reads a file opened in the browser, which R cannot reach',
    }
  }
  const file = known.slot
    ? (locationPath(adapter[known.slot]) ??
      (typeof adapter.uri === 'string' ? adapter.uri : undefined))
    : undefined
  const index = adapter.index as
    | { location?: unknown; indexType?: string }
    | undefined
  const indexPath =
    locationPath(index?.location) ?? locationPath(adapter.craiLocation)
  const besideSuffix =
    type === 'CramAdapter' ? '.crai' : type === 'BamAdapter' ? '.bai' : '.tbi'
  const plainSlots = new Set([
    'type',
    'uri',
    'index',
    'craiLocation',
    known.slot,
  ])
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
          indexPath && indexPath !== `${file}${besideSuffix}`
            ? indexPath
            : undefined,
        uris,
      }
    : { file: rValue(located), uris }
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
  const taken = new Set<string>(['locus', 'fig'])
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

/** What the figure cannot show of a track whose settings ggjbrowse reads. */
function settingNotes(track: RExportTrack) {
  const color = track.display.color as
    | { field?: string; scale?: string }
    | undefined
  return [
    ...(color?.field && color.scale === 'linear'
      ? [`color: a linear ramp over ${color.field} keys no legend`]
      : []),
    ...(color?.field === 'mateRefName'
      ? [
          'color: mateRefName colors each contig by its hash, where the browser orders them by the assembly',
        ]
      : []),
    ...(track.display.facet && track.displayType !== 'LinearAlignmentsDisplay'
      ? ['facet: drawn as one section']
      : []),
  ]
}

function sourceNotes(uris: readonly string[]) {
  return uris.some(u => u.includes('://') && u.includes('?'))
    ? [
        'source: a URL carries its query string, credential included, so the script is not one to share',
      ]
    : []
}

/** One band drawn alone over the script's own names: an alignments track's pileup, else the first track. */
function oneBand(first: string, alignments?: string) {
  return alignments ? `autoplot(${alignments}, "pileup")` : `autoplot(${first})`
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
  out = 'figure.png',
  notes: viewNotes = [],
}: {
  tracks: readonly RExportTrack[]
  regions: readonly Region[]
  out?: string
  /** What the caller knows of the view that the figure does not show. */
  notes?: readonly string[]
}) {
  const notes = [...viewNotes]
  const loci = regions.map(r => locusOf(r.refName, r.start, r.end))
  const totalBp = regions.reduce((sum, r) => sum + r.end - r.start, 0)
  const names = trackNames(tracks)
  const reads: string[] = []
  const drawn: string[] = []
  let alignments: string | undefined
  tracks.forEach((track, i) => {
    const reader = READERS[track.displayType]
    if (!reader) {
      notes.push(
        `${track.trackName}: ${track.displayType} has no R reader in ggjbrowse yet`,
      )
      return
    }
    const source = fileArgument(reader.adapters, track.adapter)
    if ('skipped' in source) {
      notes.push(`${track.trackName}: ${source.skipped}`)
      return
    }
    const aliases = track.refNames ?? {}
    const aliased = regions.some(r => aliases[r.refName] !== undefined)
    const region = aliased
      ? lociLiteral(
          regions.map(r =>
            locusOf(aliases[r.refName] ?? r.refName, r.start, r.end),
          ),
        )
      : 'locus'
    const display = Object.fromEntries(
      Object.entries(
        withoutUnset(track.writtenDisplay ?? track.display) as Record<
          string,
          unknown
        >,
      ).filter(([slot]) => !NAMING_SLOTS.has(slot)),
    )
    if (reader.call === 'jbrowse_features') {
      const { heightMode, height } = track.display
      Object.assign(
        display,
        heightMode === undefined ? {} : { heightMode },
        height === undefined ? {} : { height },
      )
    }
    const reference =
      reader.call === 'jbrowse_alignments' ? track.reference : undefined
    const width =
      reader.call === 'jbrowse_features' || reader.call === 'jbrowse_wiggle'
        ? Math.round(
            totalBp / (track.viewBpPerPx ?? totalBp / (WIDTH_INCHES * 150)),
          )
        : undefined
    const args = [
      ...(reference ? [`reference = ${rStr(reference)}`] : []),
      ...(reference && aliased
        ? [`reference_chrom = ${lociLiteral(regions.map(r => r.refName))}`]
        : []),
      ...(source.index ? [`index = ${rStr(source.index)}`] : []),
      ...(Object.keys(display).length ? [`display = ${rValue(display)}`] : []),
      ...(width === undefined ? [] : [`width = ${width}`]),
    ]
    const name = names[i]!
    reads.push(
      [
        `# ${track.trackName}`,
        `${name} <- ${reader.call}(${source.file},`,
        `  ${[region, ...args].join(',\n  ')})`,
      ].join('\n'),
    )
    drawn.push(name)
    if (reader.call === 'jbrowse_alignments') {
      alignments ??= name
    }
    notes.push(
      ...[...sourceNotes(source.uris), ...settingNotes(track)].map(
        n => `${track.trackName}: ${n}`,
      ),
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
    `#   ${oneBand(drawn[0]!, alignments)} + ggplot2::theme_classic()`,
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
    '',
    reads.join('\n\n'),
    '',
    `fig <- jbrowse_stack(${drawn.join(', ')})`,
    'print(fig)',
    `ggplot2::ggsave(${rStr(out)}, fig, width = ${WIDTH_INCHES},
  height = jbrowse_height(${drawn.join(', ')}))`,
    '',
  ].join('\n')
  return { drawn: drawn.length, script, notes }
}

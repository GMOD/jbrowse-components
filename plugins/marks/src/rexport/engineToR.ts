import { fileChrom, locationPath } from './frameFor.ts'
import { FIGURE_WIDTH_PX } from './rScript.ts'
import { expr, frame, jbrowseLayer, rName, rStr } from './rplot.ts'
import { withoutUnset } from './withoutUnset.ts'

import type { Panel, Region } from './rScript.ts'
import type { Plot, RFrame } from './rplot.ts'

/** Each ggjbrowse reader, and the adapters it opens by the slot holding the file and the extension it knows the file by. */
const READERS = {
  features: {
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
  alignments: {
    call: 'jbrowse_alignments',
    adapters: {
      BamAdapter: { slot: 'bamLocation', ext: /(?<!\.cram)$/ },
      CramAdapter: { slot: 'cramLocation', ext: /\.cram$/ },
    },
  },
  wiggle: {
    call: 'jbrowse_wiggle',
    adapters: {
      BigWigAdapter: { slot: 'bigWigLocation', ext: /$/ },
      MultiWiggleAdapter: { slot: undefined, ext: undefined },
    },
  },
} as const

type ReaderKind = keyof typeof READERS

/** Slots the figure composes itself from, which the engine has no use for. */
const HOST_SLOTS = new Set([
  'type',
  'displayId',
  'coverageHeight',
  'sashimiArcsHeight',
  'readConnectionsHeight',
  'showLegend',
  'showCoverage',
  'showPileup',
  'showMismatches',
  'showSashimiArcs',
  'minSashimiScore',
  'coverageSnpMinFrequency',
  'fadeLowFrequencyMismatches',
])

/**
 * A settings object as the R literal ggjbrowse hands the engine: a `list`
 * per object, `c()` per vector of scalars, `list()` per vector of objects
 * and per empty vector, which jsonlite would otherwise write as `{}`.
 */
export function rValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'string') {
    return rStr(value)
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
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

function isLocation(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    (typeof (v as { uri?: unknown }).uri === 'string' ||
      typeof (v as { localPath?: unknown }).localPath === 'string')
  )
}

/** An adapter config with each location a path or URL R opens, or the blob URL it cannot. */
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

/** The file argument a ggjbrowse reader takes for a track, and what reading it says in the header. */
export interface EngineSource {
  /** An R expression: the file's path or URL, or the adapter config where the adapter has settings of its own. */
  file: string
  /** The index's path, where it is not the file's beside it. */
  index?: string
  uris: string[]
}

function indexOf(adapter: Record<string, unknown>) {
  const index = adapter.index as
    | { location?: unknown; indexType?: string }
    | undefined
  return {
    path: locationPath(index?.location) ?? locationPath(adapter.craiLocation),
    csi: index?.indexType === 'CSI',
    keys: Object.keys(index ?? {}).filter(
      k => k !== 'location' && k !== 'indexType',
    ),
  }
}

/**
 * The file a ggjbrowse reader opens for a track: its path where the reader
 * would choose the track's adapter for it unaided, and the adapter config
 * itself where the adapter carries a setting, or a file the reader would read
 * as another format, so every setting reaches the engine as the browser has it.
 */
export function engineSource(
  kind: ReaderKind,
  adapter: Record<string, unknown>,
): EngineSource | { skipped: string } {
  const type = String(adapter.type)
  const adapters = READERS[kind].adapters as Record<
    string,
    { slot?: string; ext?: RegExp }
  >
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
  const { slot, ext } = known
  const file = slot
    ? (locationPath(adapter[slot]) ??
      (typeof adapter.uri === 'string' ? adapter.uri : undefined))
    : undefined
  const index = indexOf(adapter)
  const plainSlots = new Set(['type', 'uri', 'index', 'craiLocation', slot])
  const named = file?.replace(/\?.*$/, '').toLowerCase()
  const beside = file
    ? `${file}${type === 'CramAdapter' ? '.crai' : type === 'BamAdapter' ? '.bai' : '.tbi'}`
    : undefined
  const plain =
    file &&
    ext?.test(named!) &&
    Object.keys(located).every(k => plainSlots.has(k)) &&
    index.keys.length === 0 &&
    index.csi === !!index.path?.endsWith('.csi')
  return plain
    ? {
        file: rStr(file),
        index: index.path && index.path !== beside ? index.path : undefined,
        uris,
      }
    : { file: rValue(located), uris }
}

/** The display's settings the engine takes, as the config writes them. */
export function engineDisplay(written: Record<string, unknown>) {
  return withoutUnset(
    Object.fromEntries(
      Object.entries(written).filter(([slot]) => !HOST_SLOTS.has(slot)),
    ),
  ) as Record<string, unknown>
}

/** The R expressions a reader is called with for one region, or for each in turn. */
interface Span {
  /** The contig as the file spells it. */
  chrom: string
  /** The contig as the assembly spells it, which its reference reads under. */
  refChrom: string
  start: string
  end: string
  /** The width in pixels the browser lays the region across. */
  width: string
}

/**
 * The ggjbrowse result a track reads: the region read directly, or each
 * region read in turn and bound onto the cumulative axis by
 * `jbrowse_regions`, so the result's geoms draw them end to end.
 */
export function engineResult({
  name,
  call,
  regions,
  aliases,
  bpPerPx,
}: {
  name: string
  call: (span: Span) => string
  regions: readonly Region[]
  aliases?: Record<string, string>
  bpPerPx: number
}): RFrame {
  if (regions.length === 1) {
    const r = regions[0]!
    return frame({
      name,
      columns: [],
      packages: ['ggjbrowse'],
      statements: `${name} <- ${call({
        chrom: rStr(aliases?.[r.refName] ?? r.refName),
        refChrom: rStr(r.refName),
        start: String(r.start),
        end: String(r.end),
        width: String(Math.round((r.end - r.start) / bpPerPx)),
      })}`,
    })
  }
  return frame({
    name,
    columns: [],
    packages: ['ggjbrowse'],
    statements: `${name} <- jbrowse_regions(regions, function(chrom, start, end)
  ${call({
    chrom: fileChrom('chrom', aliases),
    refChrom: 'chrom',
    start: 'start',
    end: 'end',
    width: `(end - start) / ${bpPerPx}`,
  })})`,
  })
}

/** The R call to a reader: the file, then the region, then each setting on a line of its own. */
export function readerCall(
  kind: ReaderKind,
  [file, chrom, start, end, ...rest]: readonly string[],
) {
  const { call } = READERS[kind]
  const one = `${call}(${[file, chrom, start, end, ...rest].join(', ')})`
  return one.length > 76
    ? `${call}(${file},\n    ${[`${chrom}, ${start}, ${end}`, ...rest].join(',\n    ')})`
    : one
}

/** The view's zoom, or a figure's where the caller names none. */
export function zoomOf(regions: readonly Region[], viewBpPerPx?: number) {
  return (
    viewBpPerPx ??
    regions.reduce((sum, r) => sum + r.end - r.start, 0) / FIGURE_WIDTH_PX
  )
}

/** The x range every panel pins, so stacked panels show one locus. */
export function axisOf(regions: readonly Region[]) {
  const shifted = regions.length > 1
  return {
    xlim: shifted
      ? expr('min(regions$cum_start), max(regions$cum_end)')
      : { start: regions[0]!.start, end: regions[0]!.end },
    xLabel: shifted ? 'bp, regions end to end' : `${regions[0]!.refName} (bp)`,
  }
}

export function displayArg(display: Record<string, unknown>) {
  return Object.keys(display).length ? [`display = ${rValue(display)}`] : []
}

/** What a feature track draws: each feature's glyph on the display's rows, and the labels it shows at the view's zoom. */
export function featurePanel({
  result,
  regions,
}: {
  result: RFrame
  regions: readonly Region[]
}): Panel {
  const { xlim, xLabel } = axisOf(regions)
  const plot: Plot = {
    layers: [jbrowseLayer('glyphs', result), jbrowseLayer('labels', result)],
    scales: {
      fill: { kind: 'jbrowse', of: result },
      y: { kind: 'reverse' },
    },
    xlim,
    ylim: { min: 0, max: expr(`${result.name}$height`) },
    labs: { x: xLabel, y: null },
    hideY: true,
  }
  return {
    variable: `p_${result.name}`,
    plot,
    heightWeight: `max(0.3, ${result.name}$height / 150)`,
  }
}

/**
 * What a quantitative track draws: its marks on the display's score axis, a
 * row per source where its `rows` gives each one, or a density strip where its
 * mark is `span`.
 */
export function wigglePanel({
  result,
  regions,
  display,
}: {
  result: RFrame
  regions: readonly Region[]
  /** The resolved display config. */
  display: Record<string, unknown>
}): Panel {
  const { xlim, xLabel } = axisOf(regions)
  const density = display.mark === 'span'
  const rows = (display.rows as { field?: unknown } | undefined)?.field
  return {
    variable: `p_${result.name}`,
    plot: {
      layers: [jbrowseLayer('wiggle', result), jbrowseLayer('rules', result)],
      scales: density ? {} : { y: { kind: 'jbrowse', of: result } },
      xlim,
      ylim: density ? { min: 0, max: 1 } : expr(`${result.name}$domain`),
      facetBy: rows ? { field: 'source', rows: 'shared' } : undefined,
      labs: { x: xLabel, y: null },
      hideY: density,
    },
  }
}

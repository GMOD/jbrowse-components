import {
  augmentColor,
  colorFwdStrand,
  colorInterchrom,
  colorLongInsert,
  colorPairLL,
  colorPairLR,
  colorPairRL,
  colorPairRR,
  colorRevStrand,
  colorShortInsert,
  colorUnmappedMate,
  grey,
  palettePresets,
  tagColorPalette,
} from '@jbrowse/core/ui/palette'
import { MEASURE_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import {
  thresholdCuts,
  thresholdLabels,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'

import { fileChrom, frameFor } from './frameFor.ts'
import { markLayer } from './markToPlot.ts'
import { expr, frame, layer, rIdent, rStr } from './rplot.ts'
import { applyTransforms } from './transformR.ts'

import type { ColorSpec } from './markToPlot.ts'
import type { Panel, Region } from './rScript.ts'
import type { Plot, Scale } from './rplot.ts'
import type { Step } from './transformR.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

/** The slice of a LinearAlignmentsDisplay config snapshot this translates. */
export interface AlignmentsDisplaySnapshot {
  color?: string | ColorSpec
  filter?: ReadFilter
  showCoverage?: boolean
  showMismatches?: boolean
  [slot: string]: unknown
}

type CategoryFilter = 'only' | 'exclude'

/** The display's `filter` object, as its `ReadFilter` config writes it. */
interface ReadFilter {
  flagInclude?: number
  flagExclude?: number
  readName?: string
  tagFilters?: { tag: string; value?: string }[]
  spliced?: CategoryFilter
  properPairs?: CategoryFilter
  singletons?: CategoryFilter
  split?: CategoryFilter
}

/** The read categories the browser decides over a read's whole chain, which R does not group. */
const CHAIN_CATEGORIES = ['properPairs', 'singletons', 'split'] as const

/** Slots whose drawing this does not translate, reported when set off their default. */
const UNTRANSLATED: Record<string, unknown> = {
  baseColor: undefined,
  facet: undefined,
  sortedBy: undefined,
  modifications: undefined,
  arcColor: undefined,
  unit: 'read',
  layoutOrder: 'position',
  readConnections: 'off',
  showBezierConnections: false,
  showSoftClipping: false,
  mismatchAlpha: false,
}

const LEVEL_COLUMN = '.color'
const NO_VALUE = 'none'

interface Level {
  value: string
  color: string
  label: string
}

const STRAND_LEVELS: Level[] = [
  { value: '1', color: colorFwdStrand, label: 'Forward strand' },
  { value: '-1', color: colorRevStrand, label: 'Reverse strand' },
]

const MATE_LEVELS: Level[] = [
  { value: 'unmappedMate', color: colorUnmappedMate, label: 'Mate unmapped' },
  {
    value: 'interchrom',
    color: colorInterchrom,
    label: 'Mate on another contig',
  },
]

/**
 * A read dimension's levels, the column holding them, and whether the mate
 * classes paint over them, as `readColorCategory` lets them for a mate-aware
 * scheme.
 */
const READ_DIMENSIONS: Record<
  string,
  { column: string; levels: Level[]; mateAware?: boolean }
> = {
  strand: { column: 'strand', levels: STRAND_LEVELS },
  firstOfPairStrand: { column: 'firstOfPairStrand', levels: STRAND_LEVELS },
  pairOrientation: {
    column: 'pairOrientation',
    mateAware: true,
    levels: [
      { value: 'LR', color: colorPairLR, label: 'LR' },
      { value: 'RL', color: colorPairRL, label: 'RL' },
      { value: 'RR', color: colorPairRR, label: 'RR' },
      { value: 'LL', color: colorPairLL, label: 'LL' },
      { value: '', color: colorPairLR, label: 'Unsplit read' },
    ],
  },
  insertSize: {
    column: 'insertSize',
    mateAware: true,
    levels: [
      { value: 'short', color: colorShortInsert, label: 'Short insert' },
      { value: 'normal', color: colorPairLR, label: 'Normal' },
      { value: 'long', color: colorLongInsert, label: 'Long insert' },
    ],
  },
}

function deriveLevel(column: string, mateAware = false) {
  const level = `ifelse(READS$${column} == "", ${rStr(NO_VALUE)}, as.character(READS$${column}))`
  return mateAware ? `ifelse(is.na(READS$mate), ${level}, READS$mate)` : level
}

function writtenColor(color: AlignmentsDisplaySnapshot['color']): ColorSpec {
  return typeof color === 'string' ? { value: color } : (color ?? {})
}

/**
 * The `color` object as a mark translator `ColorSpec` over a column the reads
 * frame holds. A read dimension's vocabulary becomes a manual scale of the
 * browser's category colors with `range` laid over them in `domain` order,
 * held apart from the categorical translation, which parts near colors where
 * the category table repeats them on purpose.
 */
function insertSizeCuts(domain: readonly string[] | undefined) {
  const cuts = (domain ?? []).map(Number)
  return cuts.length === 2 && cuts.every(Number.isFinite)
    ? ([Math.min(...cuts), Math.max(...cuts)] as [number, number])
    : undefined
}

function readColor(
  color: AlignmentsDisplaySnapshot['color'],
  notes: string[],
): {
  spec: ColorSpec
  manual?: Scale
  derive?: string
  tags: string[]
  cuts?: [number, number]
} {
  const written = writtenColor(color)
  const { field } = written
  if (!field || written.scale === 'none') {
    return { spec: { value: written.value ?? colorPairLR }, tags: [] }
  }
  if (field === 'mapq') {
    return mapqColor(written)
  }
  const dimension = READ_DIMENSIONS[field]
  if (dimension) {
    const bands = field === 'insertSize' && written.scale !== 'categorical'
    const cuts = bands ? insertSizeCuts(written.domain) : undefined
    if (
      written.scale === 'linear' ||
      (written.scale === 'threshold' && field !== 'insertSize')
    ) {
      notes.push(
        `color: a ${written.scale} scale over ${field} is not translated`,
      )
    }
    const levels = [
      ...dimension.levels,
      ...(dimension.mateAware ? MATE_LEVELS : []),
    ]
    const order = bands
      ? dimension.levels.map(l => l.value)
      : (written.domain ?? dimension.levels.map(l => l.value))
    const declared = new Map(
      order.map((v, i) => [v, written.range?.[i]] as const),
    )
    const named = new Map(
      order.map((v, i) => [v, written.labels?.[i]] as const),
    )
    return {
      spec: { field: LEVEL_COLUMN, scale: 'categorical' },
      manual: {
        kind: 'manual',
        values: levels.map(
          l => [l.value || NO_VALUE, declared.get(l.value) || l.color] as const,
        ),
        labels: levels.map(l => named.get(l.value) || l.label),
        name: written.title ?? field,
      },
      derive: deriveLevel(dimension.column, dimension.mateAware),
      tags: [],
      cuts,
    }
  }
  if (field === 'insertSizeAndOrientation' || field === 'mateRefName') {
    notes.push(`color: ${field} is not translated, so reads draw plain`)
    return { spec: { value: colorPairLR }, tags: [] }
  }
  const tag = field.startsWith('tags.') ? field.slice(5) : undefined
  if (!tag) {
    notes.push(
      `color: ${field} is a feature attribute a BAM read does not carry`,
    )
    return { spec: { value: colorPairLR }, tags: [] }
  }
  const scale = written.scale ?? 'categorical'
  if (scale === 'categorical' && !written.domain?.length) {
    notes.push(
      `color: a ${field} value that is not a whole number hashes into the browser's 30 palette shades, and here into the first 10`,
    )
  }
  return {
    spec: {
      ...written,
      scale,
      range:
        scale === 'categorical' && !written.range?.length
          ? tagColorPalette
          : written.range,
    },
    tags: [tag],
  }
}

const MAPQ_PRESETS = { mapq: MEASURE_FIELD_PRESETS.mapq }
const MAPQ_TITLE = MEASURE_FIELD_PRESETS.mapq.title

/**
 * MAPQ through the browser's own encoding: its preset's bins, each painted
 * the color `colorEncodingOf` samples for it, with a read whose MAPQ is 255
 * (NA in R) in the plain fill. A written ramp or category list paints as any
 * numeric field does.
 */
function mapqColor(written: ColorSpec) {
  const encoding = colorEncodingOf(
    {
      value: undefined,
      domain: [],
      range: [],
      ...written,
      field: 'mapq',
    } as ColorSetting,
    MAPQ_PRESETS,
  )
  const title = written.title ?? MAPQ_TITLE
  if (typeof encoding !== 'object' || encoding.scale !== 'threshold') {
    return { spec: { ...written, title }, tags: [] }
  }
  const cuts = thresholdCuts(encoding.domain)
  const colors = thresholdPalette(cuts.length + 1, encoding.range)
  const labels = encoding.labels ?? thresholdLabels(cuts)
  const bins = colors.map((color, i) => ({
    value: `bin${i}`,
    color,
    label: labels[i] ?? `bin ${i}`,
  }))
  const levels = [
    ...(encoding.descending ? bins.toReversed() : bins),
    { value: NO_VALUE, color: colorPairLR, label: 'MAPQ unavailable (255)' },
  ]
  return {
    spec: { field: LEVEL_COLUMN, scale: 'categorical' },
    manual: {
      kind: 'manual',
      values: levels.map(l => [l.value, l.color] as const),
      labels: levels.map(l => l.label),
      name: title,
    } satisfies Scale,
    derive: `ifelse(is.na(READS$mapq), ${rStr(NO_VALUE)}, paste0("bin", findInterval(READS$mapq, c(${cuts.join(', ')}))))`,
    tags: [],
  }
}

function filterArgs(filter: ReadFilter | undefined, notes: string[]) {
  const {
    flagInclude = 0,
    flagExclude = 1540,
    readName,
    tagFilters = [],
    spliced,
  } = filter ?? {}
  for (const category of CHAIN_CATEGORIES) {
    if (filter?.[category]) {
      notes.push(
        `filter: ${category} "${filter[category]}" is not translated, so the figure draws the reads it filters`,
      )
    }
  }
  return [
    `flag_include = ${flagInclude}`,
    `flag_exclude = ${flagExclude}`,
    ...(readName ? [`read_name = ${rStr(readName)}`] : []),
    ...(tagFilters.length
      ? [
          `tags = list(${tagFilters
            .map(f => `${f.tag} = ${rStr(f.value ?? '*')}`)
            .join(', ')})`,
        ]
      : []),
    ...(spliced ? [`spliced = ${rStr(spliced)}`] : []),
  ].join(', ')
}

const BASES = ['A', 'C', 'G', 'T', 'N'] as const

/**
 * A LinearAlignmentsDisplay config snapshot as R panels: a coverage band over
 * a pileup of reads packed as the browser packs them, colored through its
 * `color` object, with mismatch ticks on the reads. Several regions lie end
 * to end on one axis; a read's `read_index` counts within its region, so the
 * overlays join on it and `.region` together.
 */
export function alignmentsPanels({
  display,
  uri,
  regions,
  reference,
  key,
  aliases,
  index,
}: {
  display: AlignmentsDisplaySnapshot
  uri: string
  regions: readonly Region[]
  /** Suffixes every R name, so several alignments tracks share one script. */
  key?: string
  /** Canonical refName to the name the file spells it with, where they differ. */
  aliases?: Record<string, string>
  /** The BAM index, which R cannot find beside a remote file. */
  index?: string
  /** The assembly's FASTA or 2bit, which a read with no MD tag is compared against. */
  reference?: string
}): { panels: Panel[]; notes: string[] } {
  const named = (name: string) => (key ? `${name}_${key}` : name)
  const readsName = named('reads')
  const notes = [
    'reads: each draws as one bar over its reference span, without its deletions, insertions, clips or splice gaps',
  ]
  for (const [slot, fallback] of Object.entries(UNTRANSLATED)) {
    const v = display[slot]
    const set =
      v !== undefined &&
      v !== fallback &&
      !(typeof v === 'object' && v !== null && !Object.keys(v).length)
    if (set) {
      notes.push(`${slot}: not translated`)
    }
  }
  const color = readColor(display.color, notes)
  const tagFilters = display.filter?.tagFilters ?? []
  const base = frameFor({
    type: 'BamAdapter',
    uri,
    name: readsName,
    aliases,
    index,
    fields: [
      ...new Set([
        ...color.tags.map(t => `tags.${t}`),
        ...tagFilters.map(f => `tags.${f.tag}`),
      ]),
    ],
  })
  const fields = [
    'firstOfPairStrand',
    'mapq',
    'pairOrientation',
    'insertSize',
    'mate',
  ]
  const classified = frame({
    name: readsName,
    columns: [
      ...base.columns,
      ...fields,
      ...(color.derive ? [LEVEL_COLUMN] : []),
    ],
    coords: base.coords,
    packages: base.packages,
    statements: [
      `${readsName} <- alignments_fields(read_filter(${readsName}, ${filterArgs(display.filter, notes)})${color.cuts ? `, cuts = c(${color.cuts.join(', ')})` : ''})`,
      ...(color.derive
        ? [
            `${readsName}$${rIdent(LEVEL_COLUMN)} <- ${color.derive.replaceAll('READS', readsName)}`,
          ]
        : []),
    ].join('\n'),
    parent: base,
  })
  const pileup: Step = { type: 'pileup', padding: 2 }
  const packed = applyTransforms({
    base: classified,
    steps: [pileup],
    notes,
    bpPerPx: 1,
  })
  const reads = markLayer(
    {
      mark: 'span',
      rowProportion: 0.8,
      encoding: { row: 'row', color: color.spec },
    },
    packed,
    expr('0'),
    notes,
    { steps: [pileup] },
  )
  const indexArg = index ? `, index = ${rStr(index)}` : ''
  const refChromArg = Object.keys(aliases ?? {}).length
    ? ', ref_chrom = chrom'
    : ''
  const at = `${fileChrom('chrom', aliases)}, start, end`
  const layers = reads ? [reads.layer] : []
  const scales: Plot['scales'] = {
    ...reads?.scales,
    ...(color.manual ? { fill: color.manual } : {}),
    y: { kind: 'reverse' },
  }
  const mismatchesName = named('mismatches')
  if (display.showMismatches !== false) {
    const mismatches = frame({
      name: mismatchesName,
      columns: ['read_index', 'refpos', 'base', '.region', 'row'],
      packages: ['GenomicAlignments'],
      statements: `${mismatchesName} <- read_regions(
  function(chrom, start, end) bam_mismatches(${rStr(uri)}, ${at}, ${reference ? rStr(reference) : 'NULL'}${indexArg}${refChromArg}),
  regions, "refpos")
${mismatchesName}$row <- ${readsName}$row[match(
  paste(${mismatchesName}$.region, ${mismatchesName}$read_index),
  paste(${readsName}$.region, ${readsName}$read_index))]
${mismatchesName} <- ${mismatchesName}[!is.na(${mismatchesName}$row), ]`,
      parent: packed,
    })
    layers.push(
      layer({
        geom: 'segment',
        frame: mismatches,
        aes: {
          x: expr('refpos + 0.5'),
          xend: expr('refpos + 0.5'),
          y: expr('row + 0.1'),
          yend: expr('row + 0.9'),
          colour: 'base',
        },
        constants: { linewidth: 0.4 },
      }),
    )
    scales.colour = {
      kind: 'manual',
      values: BASES.map(
        b => [b, augmentColor(palettePresets.default.bases![b]!).main] as const,
      ),
      name: 'Mismatch',
    }
    if (!reference) {
      notes.push(
        'mismatches: a read with no MD tag draws no ticks, since no reference was given',
      )
    }
  }
  const shifted = regions.length > 1
  const xlim = shifted
    ? expr('min(regions$cum_start), max(regions$cum_end)')
    : { start: regions[0]!.start, end: regions[0]!.end }
  const panels: Panel[] = [
    {
      variable: named('pileup'),
      plot: {
        layers,
        scales,
        xlim,
        labs: {
          x: shifted ? 'bp, regions end to end' : `${regions[0]!.refName} (bp)`,
          y: null,
        },
      },
      heightWeight: 2,
    },
  ]
  if (display.showCoverage !== false) {
    const coverage = frame({
      name: named('depth'),
      columns: ['start', 'end', 'depth', '.region'],
      packages: ['GenomicAlignments'],
      statements: `${named('depth')} <- read_regions(
  function(chrom, start, end, region) bam_coverage(${rStr(uri)}, ${at},
    keep = ${readsName}$read_index[${readsName}$.region == region]${indexArg}),
  regions, c("start", "end"))`,
      parent: packed,
    })
    panels.unshift({
      variable: named('coverage'),
      plot: {
        layers: [
          layer({
            geom: 'rect',
            frame: coverage,
            aes: { xmin: 'start', xmax: 'end', ymin: expr('0'), ymax: 'depth' },
            constants: { fill: grey[400] },
          }),
        ],
        xlim,
        expandY: 0,
        labs: { x: null, y: 'depth' },
      },
      heightWeight: 0.6,
    })
  }
  return { panels, notes }
}

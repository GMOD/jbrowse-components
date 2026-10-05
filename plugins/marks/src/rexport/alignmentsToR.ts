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

import { fileChrom, frameFor } from './frameFor.ts'
import { markLayer } from './markToPlot.ts'
import { expr, frame, layer, rIdent, rStr } from './rplot.ts'
import { applyTransforms } from './transformR.ts'

import type { ColorSpec } from './markToPlot.ts'
import type { Panel, Region } from './rScript.ts'
import type { Plot, Scale } from './rplot.ts'
import type { Step } from './transformR.ts'

/** The slice of a LinearAlignmentsDisplay config snapshot this translates. */
export interface AlignmentsDisplaySnapshot {
  color?: string | ColorSpec
  filterBy?: {
    flagInclude?: number
    flagExclude?: number
    readName?: string
    tagFilters?: { tag: string; value?: string }[]
  }
  showCoverage?: boolean
  showMismatches?: boolean
  [slot: string]: unknown
}

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

const LEVEL_COLUMN = '.colour'
const NO_VALUE = 'none'

interface Level {
  value: string
  colour: string
  label: string
}

const STRAND_LEVELS: Level[] = [
  { value: '1', colour: colorFwdStrand, label: 'Forward strand' },
  { value: '-1', colour: colorRevStrand, label: 'Reverse strand' },
]

const MATE_LEVELS: Level[] = [
  { value: 'unmappedMate', colour: colorUnmappedMate, label: 'Mate unmapped' },
  {
    value: 'interchrom',
    colour: colorInterchrom,
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
      { value: 'LR', colour: colorPairLR, label: 'LR' },
      { value: 'RL', colour: colorPairRL, label: 'RL' },
      { value: 'RR', colour: colorPairRR, label: 'RR' },
      { value: 'LL', colour: colorPairLL, label: 'LL' },
      { value: '', colour: colorPairLR, label: 'Unsplit read' },
    ],
  },
  insertSize: {
    column: 'insertSize',
    mateAware: true,
    levels: [
      { value: 'short', colour: colorShortInsert, label: 'Short insert' },
      { value: 'normal', colour: colorPairLR, label: 'Normal' },
      { value: 'long', colour: colorLongInsert, label: 'Long insert' },
    ],
  },
}

function deriveLevel(column: string, mateAware = false) {
  const level = `ifelse(READS$${column} == "", ${rStr(NO_VALUE)}, as.character(READS$${column}))`
  return mateAware ? `ifelse(is.na(READS$mate), ${level}, READS$mate)` : level
}

function writtenColour(color: AlignmentsDisplaySnapshot['color']): ColorSpec {
  return typeof color === 'string' ? { value: color } : (color ?? {})
}

/**
 * The `color` object as a mark translator `ColorSpec` over a column the reads
 * frame holds. A read dimension's vocabulary becomes a manual scale of the
 * browser's category colours with `range` laid over them in `domain` order,
 * held apart from the categorical translation, which parts near colours where
 * the category table repeats them on purpose.
 */
function readColour(
  color: AlignmentsDisplaySnapshot['color'],
  notes: string[],
): { spec: ColorSpec; manual?: Scale; derive?: string; tags: string[] } {
  const written = writtenColour(color)
  const { field } = written
  if (!field || written.scale === 'none') {
    return { spec: { value: written.value ?? colorPairLR }, tags: [] }
  }
  if (field === 'mapq') {
    return {
      spec: {
        field: 'mapq',
        scale: 'linear',
        scheme: 'cividis',
        domainMin: 0,
        domainMax: 60,
        ...written,
        title: written.title ?? 'MAPQ',
      },
      tags: [],
    }
  }
  const dimension = READ_DIMENSIONS[field]
  if (dimension) {
    if (written.scale === 'threshold' || written.scale === 'linear') {
      notes.push(
        `color: a ${written.scale} scale over ${field} is not translated`,
      )
    }
    const levels = [
      ...dimension.levels,
      ...(dimension.mateAware ? MATE_LEVELS : []),
    ]
    const order = written.domain ?? dimension.levels.map(l => l.value)
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
          l =>
            [l.value || NO_VALUE, declared.get(l.value) || l.colour] as const,
        ),
        labels: levels.map(l => named.get(l.value) || l.label),
        name: written.title ?? field,
      },
      derive: deriveLevel(dimension.column, dimension.mateAware),
      tags: [],
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
      `color: ${field} walks the tag palette in the data's order, where the browser hashes each value to its colour`,
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

function filterArgs(filterBy: AlignmentsDisplaySnapshot['filterBy']) {
  const {
    flagInclude = 0,
    flagExclude = 1540,
    readName,
    tagFilters = [],
  } = filterBy ?? {}
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
  ].join(', ')
}

const BASES = ['A', 'C', 'G', 'T', 'N'] as const

/**
 * A LinearAlignmentsDisplay config snapshot as R panels: a coverage band over
 * a pileup of reads packed as the browser packs them, coloured through its
 * `color` object, with mismatch ticks on the reads.
 *
 * Reads only the first region: the mismatch overlay joins reads by their
 * per-region read index, and the multi-region join is not written yet.
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
  if (regions.length > 1) {
    notes.push('regions: only the first region is drawn')
  }
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
  const colour = readColour(display.color, notes)
  const tagFilters = display.filterBy?.tagFilters ?? []
  const base = frameFor({
    type: 'BamAdapter',
    uri,
    name: readsName,
    aliases,
    index,
    fields: [
      ...new Set([
        ...colour.tags.map(t => `tags.${t}`),
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
      ...(colour.derive ? [LEVEL_COLUMN] : []),
    ],
    coords: base.coords,
    packages: base.packages,
    statements: [
      `${readsName} <- alignments_fields(read_filter(${readsName}, ${filterArgs(display.filterBy)}))`,
      ...(colour.derive
        ? [
            `${readsName}$${rIdent(LEVEL_COLUMN)} <- ${colour.derive.replaceAll('READS', readsName)}`,
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
      encoding: { row: 'row', color: colour.spec },
    },
    packed,
    expr('0'),
    notes,
    { steps: [pileup] },
  )
  const region = regions[0]!
  const indexArg = index ? `, index = ${rStr(index)}` : ''
  const at = `${fileChrom('regions$chrom[1]', aliases)}, regions$start[1], regions$end[1]`
  const layers = reads ? [reads.layer] : []
  const scales: Plot['scales'] = {
    ...reads?.scales,
    ...(colour.manual ? { fill: colour.manual } : {}),
    y: { kind: 'reverse' },
  }
  const mismatchesName = named('mismatches')
  if (display.showMismatches !== false) {
    const mismatches = frame({
      name: mismatchesName,
      columns: ['read_index', 'refpos', 'base', 'row'],
      packages: ['GenomicAlignments'],
      statements: `${mismatchesName} <- bam_mismatches(${rStr(uri)}, ${at}, ${reference ? rStr(reference) : 'NULL'}${indexArg})
${mismatchesName}$row <- ${readsName}$row[match(${mismatchesName}$read_index, ${readsName}$read_index)]
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
  const xlim = { start: region.start, end: region.end }
  const panels: Panel[] = [
    {
      variable: named('pileup'),
      plot: {
        layers,
        scales,
        xlim,
        labs: { x: `${region.refName} (bp)`, y: null },
      },
      heightWeight: 2,
    },
  ]
  if (display.showCoverage !== false) {
    const coverage = frame({
      name: named('depth'),
      columns: ['start', 'end', 'depth'],
      packages: ['GenomicAlignments'],
      statements: `${named('depth')} <- bam_coverage(${rStr(uri)}, ${at}, keep = ${readsName}$read_index${indexArg})`,
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

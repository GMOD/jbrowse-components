import {
  augmentColor,
  grey,
  palettePresets,
  resolvePalette,
} from '@jbrowse/core/ui/palette'

import { fileChrom, locationPath, uriOf } from './frameFor.ts'
import { expr, frame, layer, rName, rStr } from './rplot.ts'

import type { Panel, Region } from './rScript.ts'
import type { Plot } from './rplot.ts'

/** The slice of a LinearAlignmentsDisplay config snapshot this translates. */
export interface AlignmentsDisplaySnapshot {
  /** The display's `color` object, or the plain fill as a string. */
  color?: string | Record<string, unknown>
  /** The display's `filter` object. */
  filter?: Record<string, unknown>
  showCoverage?: boolean
  showMismatches?: boolean
  showPileup?: boolean
  [slot: string]: unknown
}

/** The file an alignments track reads, and its index, which R cannot find beside a remote file. */
export interface AlignmentsFile {
  uri: string
  index: string
}

const FILE_SLOTS: Record<
  string,
  { file: string; index: string; beside: string }
> = {
  BamAdapter: { file: 'bamLocation', index: 'index.location', beside: '.bai' },
  CramAdapter: { file: 'cramLocation', index: 'craiLocation', beside: '.crai' },
}

/**
 * The BAM or CRAM behind an adapter config, or why it cannot be read: a type
 * the engine has no reader for, a config naming no file, or a file opened in
 * the browser, which R cannot reach.
 */
export function alignmentsFile(
  adapter: Record<string, unknown>,
): AlignmentsFile | { skipped: string } {
  const type = String(adapter.type)
  const slots = FILE_SLOTS[type]
  if (!slots) {
    return { skipped: `${type} has no R reader for this display` }
  }
  const uri = uriOf(adapter, slots.file)
  if (!uri) {
    return { skipped: `${type} names no file` }
  }
  if (uri.startsWith('blob:')) {
    return {
      skipped: 'it reads a file opened in the browser, which R cannot reach',
    }
  }
  const [slot, sub] = slots.index.split('.')
  const held = adapter[slot!] as Record<string, unknown> | undefined
  return {
    uri,
    index: locationPath(sub ? held?.[sub] : held) ?? `${uri}${slots.beside}`,
  }
}

/** Slots the panels read. */
const TRANSLATED = new Set([
  'color',
  'filter',
  'showCoverage',
  'showMismatches',
  'showPileup',
])

/** Slots that size the browser's track, where a figure sizes itself. */
const LAYOUT = new Set([
  'type',
  'displayId',
  'height',
  'maxHeight',
  'coverageHeight',
  'sashimiArcsHeight',
  'readConnectionsHeight',
  'showLegend',
])

/** A color object switched off, as clearing a base layer or arc color writes it. */
function paintsNothing(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { scale?: unknown }).scale === 'none'
  )
}

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

function colorObject(color: AlignmentsDisplaySnapshot['color']) {
  return typeof color === 'string' ? { value: color } : color
}

/** What the engine paints that the figure's key cannot show. */
function colorNotes(color: Record<string, unknown> | undefined) {
  const { field, scale } = color ?? {}
  if (!field || scale === 'none') {
    return []
  }
  if (scale === 'linear') {
    return [
      `color: a linear ramp over ${field} keys no legend; each read still fills in its own color`,
    ]
  }
  if (field === 'mateRefName') {
    return [
      'color: mateRefName colors each contig by its hash, where the browser orders them by the assembly',
    ]
  }
  return []
}

const BASES = ['A', 'C', 'G', 'T', 'N'] as const

/**
 * A LinearAlignmentsDisplay config snapshot as R panels: a coverage band over
 * a pileup of reads, read through JBrowse's own engine (ggjbrowse), so each
 * read comes back on the row the browser packs it onto and in the color its
 * `color` object paints it, with the browser's key beside it and only the
 * reads its `filter` keeps. Several regions lie end to end on one axis; a
 * read's `read` counts within its region, so the overlays join on it and
 * `.region` together.
 */
export function alignmentsPanels({
  display,
  written,
  file,
  regions,
  reference,
  key,
  aliases,
}: {
  display: AlignmentsDisplaySnapshot
  /** The config as written, its defaults left out, which names the settings the figure drops. */
  written: Record<string, unknown>
  file: AlignmentsFile
  regions: readonly Region[]
  /** Suffixes every R name, so several alignments tracks share one script. */
  key?: string
  /** Canonical refName to the name the file spells it with, where they differ. */
  aliases?: Record<string, string>
  /** The assembly's FASTA or 2bit, which a CRAM decodes against and a read with no MD tag is compared against. */
  reference?: string
}): { panels: Panel[]; notes: string[] } {
  const named = (name: string) => (key ? `${name}_${key}` : name)
  const pileupShown = display.showPileup !== false
  const coverageShown = display.showCoverage !== false
  const notes: string[] = []
  if (pileupShown) {
    notes.push('reads: drawn without their insertions or clips')
  }
  if (coverageShown) {
    notes.push(
      `coverage: one grey band, without the browser's allele colors${display.showSashimiArcs === false ? '' : ' or sashimi arcs'}`,
    )
  }
  const dropped = Object.entries(written)
    .filter(
      ([slot, value]) =>
        !TRANSLATED.has(slot) && !LAYOUT.has(slot) && !paintsNothing(value),
    )
    .map(([slot]) => slot)
  if (dropped.length) {
    notes.push(`not translated: ${dropped.join(', ')}`)
  }
  const color = colorObject(display.color)
  if (pileupShown) {
    notes.push(...colorNotes(color))
  }
  const aliased = Object.keys(aliases ?? {}).length > 0
  const args = [
    rStr(file.uri),
    fileChrom('chrom', aliases),
    'start',
    'end',
    ...(reference ? [`reference = ${rStr(reference)}`] : []),
    ...(reference && aliased ? ['reference_chrom = chrom'] : []),
    `index = ${rStr(file.index)}`,
    ...(color && Object.keys(color).length ? [`color = ${rValue(color)}`] : []),
    ...(display.filter && Object.keys(display.filter).length
      ? [`filter = ${rValue(display.filter)}`]
      : []),
  ]
  const alnName = named('aln')
  const aln = frame({
    name: alnName,
    columns: [],
    packages: ['ggjbrowse'],
    statements: `${alnName} <- alignments_regions(regions, function(chrom, start, end)
  jbrowse_alignments(${args.join(',\n    ')}))`,
  })
  const readsName = named('reads')
  const legendName = named('legend')
  const keyName = named('key')
  const reads = frame({
    name: readsName,
    columns: [
      'start',
      'end',
      'row',
      'strand',
      'mapq',
      'flags',
      'name',
      'insert_size',
      'pair_orientation',
      'color',
      'category',
      'read',
      '.region',
    ],
    coords: ['start', 'end'],
    statements: `${readsName} <- ${alnName}$reads
${legendName} <- ${alnName}$legend
${keyName} <- ${legendName}[!duplicated(${legendName}$color), ]`,
    parent: aln,
  })
  const gapsName = named('gaps')
  const gaps = frame({
    name: gapsName,
    columns: ['start', 'end', 'type', 'read', 'row', '.region'],
    coords: ['start', 'end'],
    statements: `${gapsName} <- ${alnName}$gaps`,
    parent: reads,
  })
  const ofType = (type: string) => {
    const name = named(`${type}s`)
    return frame({
      name,
      columns: gaps.columns,
      coords: gaps.coords,
      statements: `${name} <- ${gapsName}[${gapsName}$type == ${rStr(type)}, ]`,
      parent: gaps,
    })
  }
  const skips = ofType('skip')
  const blocksName = named('read_blocks')
  const blocks = frame({
    name: blocksName,
    columns: reads.columns,
    coords: reads.coords,
    statements: `${blocksName} <- read_blocks(${readsName}, ${skips.name})`,
    parent: skips,
  })
  const palette = resolvePalette()
  const layers = [
    layer({
      geom: 'rect',
      frame: blocks,
      aes: {
        xmin: 'start',
        xmax: 'end',
        ymin: expr('row + 0.1'),
        ymax: expr('row + 0.9'),
        fill: 'color',
      },
    }),
    layer({
      geom: 'segment',
      frame: skips,
      aes: {
        x: 'start',
        xend: 'end',
        y: expr('row + 0.5'),
        yend: expr('row + 0.5'),
      },
      constants: { colour: palette.skip, linewidth: 0.3 },
    }),
    layer({
      geom: 'rect',
      frame: ofType('deletion'),
      aes: {
        xmin: 'start',
        xmax: 'end',
        ymin: expr('row + 0.35'),
        ymax: expr('row + 0.65'),
      },
      constants: { fill: palette.deletion },
    }),
  ]
  const scales: Plot['scales'] = {
    fill: {
      kind: 'identity',
      key: {
        name: expr(`attr(${legendName}, "title")`),
        breaks: expr(`${keyName}$color`),
        labels: expr(`${keyName}$label`),
      },
    },
    y: { kind: 'reverse' },
  }
  if (pileupShown && display.showMismatches !== false) {
    const mismatchesName = named('mismatches')
    const mismatches = frame({
      name: mismatchesName,
      columns: [
        'position',
        'base',
        'read',
        'row',
        'frequency',
        'quality',
        '.region',
      ],
      coords: ['position'],
      statements: `${mismatchesName} <- ${alnName}$mismatches`,
      parent: reads,
    })
    layers.push(
      layer({
        geom: 'segment',
        frame: mismatches,
        aes: {
          x: expr('position + 0.5'),
          xend: expr('position + 0.5'),
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
  const xLabel = shifted
    ? 'bp, regions end to end'
    : `${regions[0]!.refName} (bp)`
  const panels: Panel[] = pileupShown
    ? [
        {
          variable: named('pileup'),
          plot: { layers, scales, xlim, labs: { x: xLabel, y: null } },
          heightWeight: 2,
        },
      ]
    : []
  if (coverageShown) {
    const depthName = named('depth')
    const coverage = frame({
      name: depthName,
      columns: ['start', 'end', 'depth', 'forward', 'reverse', '.region'],
      coords: ['start', 'end'],
      statements: `${depthName} <- ${alnName}$coverage`,
      parent: aln,
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
        labs: { x: pileupShown ? null : xLabel, y: 'depth' },
      },
      heightWeight: 0.6,
    })
  }
  return { panels, notes }
}

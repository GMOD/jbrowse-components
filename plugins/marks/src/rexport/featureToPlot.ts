import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'
import { DEFAULT_CANONICAL_TRANSCRIPTS } from '@jbrowse/core/util/isoformRank'

import {
  FIGURE_WIDTH_PX,
  INCHES_PER_WEIGHT,
  PANEL_WIDTH_INCHES,
} from './rScript.ts'
import { expr, frame, layer, rIdent, rStr } from './rplot.ts'

import type { TranslatedPlot } from './markToPlot.ts'
import type { Region } from './rScript.ts'
import type { Layer, RFrame } from './rplot.ts'

/**
 * The slots of a `LinearBasicDisplay` config snapshot that change what the
 * gene glyph draws. A color slot is a CSS color or a `jexl:` callback, and
 * `color` may also be the `{ value, field, ... }` object.
 */
export interface FeatureDisplaySpec {
  filter?: string[]
  showOnlyGenes?: boolean
  hideSourceFeatures?: boolean
  geneGlyphMode?: 'auto' | 'all' | 'longestCoding'
  transcriptTypes?: string[]
  containerTypes?: string[]
  canonicalTranscriptField?: string
  canonicalTranscriptTags?: string[]
  subParts?: string
  impliedUTRs?: boolean
  color?: string | { value?: string; field?: string }
  utrColor?: string
  connectorColor?: string
  outlineColor?: string
  showLabels?: 'auto' | 'nameAndDescription' | 'name' | 'description' | 'none'
  labels?: { name?: string; description?: string }
  displayMode?: 'normal' | 'compact' | 'superCompact' | 'collapsed'
  featureHeight?: number | string
  subfeatureLabels?: 'none' | 'below' | 'overlay'
  displayDirectionalChevrons?: boolean
  facet?: unknown
}

const TRANSCRIPT_TYPES = [
  'mRNA',
  'transcript',
  'primary_transcript',
  'V_gene_segment',
  'C_gene_segment',
  'D_gene_segment',
  'J_gene_segment',
]
const CONTAINER_TYPES = ['proteoform_orf']
const SUB_PARTS = 'CDS,UTR,five_prime_UTR,three_prime_UTR'
const DEFAULT_NAME = `jexl:get(feature,'name') || get(feature,'id')`
const DEFAULT_DESCRIPTION = `jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')`
/** `isGeneLikeType`'s pattern, which "Show only genes" admits by. */
const GENE_LIKE = 'gene(_segment)?$|rna$|transcript$'
/** The bp/px past which `auto` shows one transcript per gene. */
const AUTO_COLLAPSE_BP_PER_PX = 100
const UTR_HALF = 0.5 * 0.65
/** ggplot2's size for the name and description, which gene_layout measures. */
const TEXT_SIZE = 3
/** One glyph-height unit of gene_layout's rows, so a label line clears the text it holds. */
const ROW_UNIT_INCHES = 0.12
/** The axis under a gene panel. */
const AXIS_INCHES = 0.6
const CONNECTOR = 'grey30'

/** One `filter` entry the R side can apply: an attribute against a literal. */
interface FilterRule {
  attr: string
  op: '==' | '!='
  value: string
  jexl: string
}

const FILTER_FORMS = [
  /^get\(\s*feature\s*,\s*['"]([^'"]+)['"]\s*\)\s*(==|!=)\s*['"]([^'"]*)['"]$/,
  /^feature\.([A-Za-z_]\w*)\s*(==|!=)\s*['"]([^'"]*)['"]$/,
]

/**
 * The filters as attribute comparisons, and the rest, which the header names:
 * R gets no jexl evaluator, so only the shape a filter is usually written in
 * crosses.
 */
export function translateFilters(filters: readonly string[]) {
  const rules: FilterRule[] = []
  const untranslated: string[] = []
  for (const filter of filters) {
    const jexl = filter.replace(/^jexl:/, '').trim()
    const m = FILTER_FORMS.map(re => re.exec(jexl)).find(Boolean)
    if (m) {
      rules.push({ attr: m[1]!, op: m[2] as '==' | '!=', value: m[3]!, jexl })
    } else if (jexl) {
      untranslated.push(jexl)
    }
  }
  return { rules, untranslated }
}

/**
 * jexl's `undefined`: a feature lacking the attribute fails `==` and passes
 * `!=`, which is what keeps the gbkey rule a no-op on files without one.
 */
function rPredicate({ attr, op, value }: FilterRule) {
  const col = `f$${rIdent(attr)}`
  return op === '=='
    ? `function(f) !is.na(${col}) & ${col} == ${rStr(value)}`
    : `function(f) is.na(${col}) | ${col} != ${rStr(value)}`
}

function rVector(values: readonly string[]) {
  return `c(${values.map(v => rStr(v)).join(', ')})`
}

function collapses(display: FeatureDisplaySpec, bpPerPx: number) {
  const mode = display.geneGlyphMode ?? 'auto'
  return mode === 'auto'
    ? bpPerPx > AUTO_COLLAPSE_BP_PER_PX
    : mode === 'longestCoding'
}

function shows(display: FeatureDisplaySpec) {
  const mode =
    display.displayMode === 'collapsed'
      ? 'none'
      : (display.showLabels ?? 'auto')
  return {
    name: mode === 'auto' || mode === 'nameAndDescription' || mode === 'name',
    description:
      mode === 'auto' ||
      mode === 'nameAndDescription' ||
      mode === 'description',
  }
}

function spanOf(regions: readonly Region[]) {
  return regions.reduce((a, r) => a + (r.end - r.start), 0)
}

/** The zoom `auto` collapses at: the live view's, else the figure's own. */
function zoomOf(regions: readonly Region[], viewBpPerPx?: number) {
  return viewBpPerPx ?? Math.max(spanOf(regions), 1) / FIGURE_WIDTH_PX
}

/**
 * The file's fields the glyph reads beyond the reader's own columns: what the
 * filters compare, the source-record marker, the description and the curated
 * isoform tag.
 */
export function featureFields(
  display: FeatureDisplaySpec,
  regions: readonly Region[] = [],
  viewBpPerPx?: number,
) {
  const bpPerPx = zoomOf(regions, viewBpPerPx)
  return [
    ...new Set([
      ...translateFilters(display.filter ?? []).rules.map(r => r.attr),
      ...(display.hideSourceFeatures === false ? [] : ['gbkey']),
      ...(shows(display).description ? ['note'] : []),
      ...(collapses(display, bpPerPx)
        ? [
            display.canonicalTranscriptField ??
              DEFAULT_CANONICAL_TRANSCRIPTS.field,
          ]
        : []),
    ]),
  ]
}

function colorValue(c: FeatureDisplaySpec['color']) {
  return typeof c === 'string' ? c : c?.value
}

/** A color slot R can paint, or undefined with a note where it cannot. */
function literalColor(
  slot: string,
  value: string | undefined,
  notes: string[],
) {
  if (value?.startsWith('jexl:')) {
    notes.push(
      `${slot}: a jexl callback has no R counterpart; drawn in the default`,
    )
    return undefined
  }
  return value || undefined
}

function unsupported(display: FeatureDisplaySpec, notes: string[]) {
  if (typeof display.color === 'object' && display.color.field) {
    notes.push(
      `color: the ${display.color.field} field scale is not drawn; boxes take the default`,
    )
  }
  if (display.facet) {
    notes.push(
      'facet: the sections are not drawn; every feature packs together',
    )
  }
  if (display.displayMode && display.displayMode !== 'normal') {
    notes.push(`displayMode: ${display.displayMode} is drawn at normal height`)
  }
  if (display.featureHeight !== undefined && display.featureHeight !== 10) {
    notes.push('featureHeight: every feature draws one row high')
  }
  if (display.subfeatureLabels && display.subfeatureLabels !== 'none') {
    notes.push('subfeatureLabels: transcript labels are not drawn')
  }
  if (display.displayDirectionalChevrons !== false) {
    notes.push(
      'chevrons: intron lines carry no strand chevrons; each transcript ends in an arrow',
    )
  }
  if (display.outlineColor) {
    notes.push('outlineColor: boxes draw without an outline')
  }
  if (display.labels?.name && display.labels.name !== DEFAULT_NAME) {
    notes.push(
      'labels.name: drawn from the Name attribute, not the configured expression',
    )
  }
  if (
    display.labels?.description &&
    display.labels.description !== DEFAULT_DESCRIPTION
  ) {
    notes.push(
      'labels.description: drawn from the Note attribute, not the configured expression',
    )
  }
  if ((display.geneGlyphMode ?? 'auto') === 'auto') {
    notes.push(
      'geneGlyphMode: auto trims isoforms to the track height in the browser; the figure draws every one it keeps',
    )
  }
}

/**
 * The admission gate, then the isoform collapse, over the reader's frame:
 * each a statement rebinding the same name, so a reader edits one line to
 * change what the panel admits.
 */
function admitted(
  base: RFrame,
  display: FeatureDisplaySpec,
  bpPerPx: number,
  notes: string[],
): RFrame {
  const { rules, untranslated } = translateFilters(display.filter ?? [])
  for (const u of untranslated) {
    notes.push(
      `filter: ${u} is beyond an attribute comparison, so the figure draws what it hides`,
    )
  }
  const held = new Set(base.columns)
  const readable = rules.filter(r => held.has(r.attr))
  for (const r of rules.filter(r => !held.has(r.attr))) {
    notes.push(
      `filter: ${r.jexl} reads ${r.attr}, which this file's reader has no column for`,
    )
  }
  const transcriptTypes = display.transcriptTypes ?? TRANSCRIPT_TYPES
  const geneTypes = [
    ...transcriptTypes,
    ...(display.containerTypes ?? CONTAINER_TYPES),
    'CDS',
  ].map(t => t.toLowerCase())
  const preds = [
    ...(display.hideSourceFeatures === false || !held.has('gbkey')
      ? []
      : [
          `  # hideSourceFeatures\n  function(f) is.na(f$gbkey) | f$gbkey != "Src"`,
        ]),
    ...(display.showOnlyGenes
      ? [
          `  # showOnlyGenes\n  function(f) grepl(${rStr(GENE_LIKE)}, tolower(f$type)) | tolower(f$type) %in% ${rVector([...new Set(geneTypes)])}`,
        ]
      : []),
    ...readable.map(r => `  # ${r.jexl}\n  ${rPredicate(r)}`),
  ]
  const n = base.name
  const filtered = frame({
    name: n,
    columns: base.columns,
    coords: base.coords,
    packages: [...base.packages, 'IRanges'],
    statements: `${n} <- feature_filter(${n}, list(${preds.length ? `\n${preds.join(',\n')}\n` : ''}))`,
    parent: base,
  })
  if (!collapses(display, bpPerPx)) {
    return filtered
  }
  const field =
    display.canonicalTranscriptField ?? DEFAULT_CANONICAL_TRANSCRIPTS.field
  const tags = display.canonicalTranscriptTags ?? [
    ...DEFAULT_CANONICAL_TRANSCRIPTS.tags,
  ]
  return frame({
    name: n,
    columns: base.columns,
    coords: base.coords,
    packages: filtered.packages,
    statements: `${n} <- collapse_isoforms(${n}, ${rVector(transcriptTypes)},
  ${rStr(field)}, ${rVector(tags)})`,
    parent: filtered,
  })
}

/**
 * A `LinearBasicDisplay` config as a ggplot of gene glyphs: each top-level
 * feature packed onto rows with its transcripts stacked under it, a connector
 * line per transcript ending in a strand arrow, CDS boxes full height and UTR
 * boxes thinner, and the name and description under the feature.
 *
 * `frame` is the reader's: a GFF3 frame, a BED one, which `bed_features`
 * turns into the same shape, or any frame with `id`, `parent`, `type`, `name`
 * and `strand` columns. `aggregate` is the column a BigBed adapter groups
 * transcripts into genes by, which the frame must hold. `viewBpPerPx` is the
 * live view's zoom, which decides whether `auto` collapses isoforms as the
 * browser decided.
 */
export function featurePlot({
  display,
  frame: base,
  regions,
  aggregate,
  viewBpPerPx,
}: {
  display: FeatureDisplaySpec
  frame: RFrame
  regions: readonly Region[]
  aggregate?: string
  viewBpPerPx?: number
}): TranslatedPlot & { heightWeight: string } {
  const notes: string[] = []
  const bpPerPx = zoomOf(regions, viewBpPerPx)
  unsupported(display, notes)
  const n = base.name
  const shaped = base.columns.includes('parent')
    ? base
    : frame({
        name: n,
        columns: [...base.columns, 'type', 'id', 'parent'],
        coords: base.coords,
        packages: base.packages,
        statements: `${n} <- bed_features(${n}${aggregate ? `, aggregate = ${rStr(aggregate)}` : ''})`,
        parent: base,
      })
  const feats = admitted(shaped, display, bpPerPx, notes)
  const described = feats.columns.includes('note')
  const show = shows(display)
  const shifted = regions.length > 1
  const lanes = frame({
    name: `${n}_lanes`,
    columns: [
      'start',
      'end',
      'strand',
      'id',
      'gene',
      'lane',
      'y',
      'label',
      'description',
      'description_y',
      'bottom',
    ],
    coords: base.coords,
    packages: feats.packages,
    statements: `${n}_lanes <- gene_layout(${n},
  bp_per_inch = (max(regions$cum_end) - min(regions$cum_start)) / ${PANEL_WIDTH_INCHES},
  text_size = ${TEXT_SIZE},
  labels = ${show.name ? `${n}$name` : `rep(NA_character_, nrow(${n}))`},
  descriptions = ${show.description && described ? `${n}$note` : `rep(NA_character_, nrow(${n}))`})`,
    parent: feats,
  })
  const parts = frame({
    name: `${n}_parts`,
    columns: ['start', 'end', 'part', 'lane', 'y'],
    coords: base.coords,
    packages: feats.packages,
    statements: `${n}_parts <- gene_parts(${n}, ${n}_lanes,
  sub_parts = ${rVector((display.subParts ?? SUB_PARTS).split(',').map(s => s.trim()))},
  implied_utrs = ${display.impliedUTRs === false ? 'FALSE' : 'TRUE'})${
    shifted
      ? `
${n}_parts <- clip_regions(${n}_parts, regions)`
      : ''
  }`,
    parent: lanes,
  })
  const lines = shifted
    ? frame({
        name: `${n}_lines`,
        columns: lanes.columns,
        coords: base.coords,
        packages: feats.packages,
        statements: `${n}_lines <- clip_regions(${n}_lanes, regions)`,
        parent: parts,
      })
    : lanes
  const arrows = frame({
    name: `${n}_arrows`,
    columns: ['start', 'end', 'strand', 'y'],
    coords: base.coords,
    packages: feats.packages,
    statements: `${n}_arrows <- ${lines.name}[${lines.name}$strand != 0, ]`,
    parent: lines,
  })
  const fill =
    literalColor('color', colorValue(display.color), notes) ??
    featureDefaultColor
  const utrFill =
    literalColor('utrColor', display.utrColor, notes) ??
    literalColor('color', colorValue(display.color), []) ??
    utrDefaultColor
  const connector =
    literalColor('connectorColor', display.connectorColor, notes) ?? CONNECTOR
  const arrowBp = (Math.max(spanOf(regions), 1) / FIGURE_WIDTH_PX) * 6
  const tip = expr('ifelse(strand > 0, end, start)')
  const layers: Layer[] = [
    layer({
      geom: 'segment',
      frame: lines,
      aes: { x: 'start', xend: 'end', y: 'y', yend: 'y' },
      constants: { colour: connector, linewidth: 0.3 },
    }),
    layer({
      geom: 'rect',
      frame: parts,
      aes: {
        xmin: 'start',
        xmax: 'end',
        ymin: expr(`y - ifelse(part == "UTR", ${UTR_HALF}, 0.5)`),
        ymax: expr(`y + ifelse(part == "UTR", ${UTR_HALF}, 0.5)`),
        fill: 'part',
      },
    }),
    layer({
      geom: 'segment',
      frame: arrows,
      aes: {
        x: tip,
        xend: expr(
          `ifelse(strand > 0, end, start) + strand * ${Math.round(arrowBp)}`,
        ),
        y: 'y',
        yend: 'y',
      },
      constants: { colour: connector, linewidth: 0.3 },
      params: {
        arrow: expr('arrow(length = unit(0.05, "inches"), type = "closed")'),
      },
    }),
  ]
  const textX = expr(
    shifted ? 'start' : `pmax(start, ${regions[0]?.start ?? 0})`,
  )
  if (show.name) {
    layers.push(
      layer({
        geom: 'text',
        frame: lines,
        aes: { x: textX, y: expr('y + 0.6'), label: 'label' },
        constants: { size: TEXT_SIZE },
        params: { hjust: 0, vjust: 1, 'na.rm': expr('TRUE') },
      }),
    )
  }
  if (show.description && described) {
    layers.push(
      layer({
        geom: 'text',
        frame: lines,
        aes: { x: textX, y: 'description_y', label: 'description' },
        constants: { size: TEXT_SIZE, colour: 'grey40' },
        params: { hjust: 0, vjust: 1, 'na.rm': expr('TRUE') },
      }),
    )
  }
  return {
    plot: {
      layers,
      scales: {
        fill: {
          kind: 'manual',
          values: [
            ['CDS', fill],
            ['UTR', utrFill],
            ['box', fill],
          ],
        },
        y: { kind: 'reverse' },
      },
      xlim: shifted
        ? expr('min(regions$cum_start), max(regions$cum_end)')
        : regions[0],
      expandY: expr(`c(0, max(c(1, ${n}_lanes$bottom)))`),
      labs: {
        x: shifted
          ? 'bp, regions end to end'
          : regions[0]
            ? `${regions[0].refName} (bp)`
            : 'bp',
        y: null,
      },
      legend: false,
      hideY: true,
    },
    notes,
    heightWeight: `(max(c(1, ${n}_lanes$bottom)) * ${ROW_UNIT_INCHES} + ${AXIS_INCHES}) / ${INCHES_PER_WEIGHT}`,
  }
}

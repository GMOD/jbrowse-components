import {
  categoricalColorScale,
  categoricalPalette,
  categoricalScale,
} from '@jbrowse/core/ui/colors'
import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import {
  DEFAULT_MARK_COLOR,
  DEFAULT_SIZE_RANGE_PX,
} from '@jbrowse/core/util/markEncoding'
import { SHAPE_NAMES } from '@jbrowse/core/util/shapeNames'
import {
  thresholdCuts,
  thresholdLabels,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'
import { DEFAULT_RULE_COLOR } from '@jbrowse/display-ui/yAxisConstants'

import { MARK_SPECS, readsValue } from '../LinearMarkDisplay/markSpecs.ts'
import {
  DEFAULT_LINK_STROKE_PX,
  DEFAULT_TEXT_FIELD,
  type LinkShape,
  type MarkType,
} from '../LinearMarkDisplay/markVocabulary.ts'
import { FIGURE_WIDTH_PX } from './rScript.ts'
import { colourAesthetic, expr, layer, rIdent, rStr } from './rplot.ts'
import {
  applyTransforms,
  lastBinOf,
  stepOutputs,
  stepReads,
} from './transformR.ts'

import type { Region } from './rScript.ts'
import type {
  Aesthetic,
  Geom,
  Layer,
  Plot,
  RExpr,
  RFrame,
  Scale,
} from './rplot.ts'
import type { Step } from './transformR.ts'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type {
  ColorChannel,
  IdentityColorChannel,
} from '@jbrowse/display-kit/channelSpec'

/**
 * The arm of a colour channel that binds a field, which the string arm leaves,
 * with the `value` the schema keeps beside it for a `none` scale.
 */
type FieldColor = Exclude<ColorChannel, string | IdentityColorChannel> & {
  value?: string
}

/** How many stops a continuous ramp hands ggplot's `gradientn`. */
const RAMP_STOPS = 16

/** A px on screen as ggplot's mm, at the 96 dpi a browser draws at. */
const MM_PER_PX = 25.4 / 96

function knownScheme(scheme: string | undefined) {
  return COLOR_SCHEMES.find((s): s is ColorSchemeName => s === scheme)
}

export interface MarkConfig {
  mark: MarkType
  linkShape?: LinkShape
  size?: number
  source?: string
  minBpPerPx?: number
  maxBpPerPx?: number
  transform?: Step[]
  encoding?: {
    x?: string
    x2?: string | { pos?: string; chrom?: string }
    y?: string
    row?: string
    text?: string
    color?: string | IdentityColorChannel | FieldColor
    shape?:
      | string
      | {
          field?: string
          scale?: string
          value?: string
          range?: string[]
          domain?: string[]
        }
    size?: {
      field?: string
      scale?: string
      range?: string[]
      domainMin?: number
      domainMax?: number
    }
  }
}

type Encoding = NonNullable<MarkConfig['encoding']>

export interface Facet {
  field?: string
  domain?: string[]
  transform?: Step[]
}

export interface DisplaySpec {
  marks: MarkConfig[]
  transform?: Step[]
  facet?: string | Facet
  rows?: string | { field?: string; domain?: string[] }
  rowColor?: { field?: string; domain?: string[]; range?: string[] }
  jexlFilters?: string[]
  scales?: {
    y?: {
      type?: string
      domainMin?: number
      domainMax?: number
      title?: string
      rules?: { value?: number; color?: string; label?: string }[]
    }
  }
  origin?: number
  showLegend?: boolean
}

export interface TranslatedPlot {
  plot: Plot
  /** What the figure does not show, for the script's header. */
  notes: string[]
}

const GEOM_OF: Record<MarkType, Geom> = {
  bar: 'rect',
  point: 'point',
  span: 'rect',
  text: 'text',
  link: 'curve',
}

/** A field a channel names, or undefined where it names a jexl callback. */
function plainField(field: string | undefined) {
  return field && !field.startsWith('jexl:') ? field : undefined
}

function midpoint(x: string, x2: string | undefined) {
  return x2 ? expr(`(${rIdent(x)} + ${rIdent(x2)}) / 2`) : x
}

function facetOf(facet: DisplaySpec['facet']): Facet {
  return typeof facet === 'string' ? { field: facet } : (facet ?? {})
}

function rowsOf(rows: DisplaySpec['rows']) {
  return typeof rows === 'string' ? { field: rows } : (rows ?? {})
}

/**
 * A ramp pins its declared domain. Without `limits` ggplot stretches the ramp
 * to the data, so a diverging declaration's `domainMid` lands wherever the
 * window happens to put it rather than where the config says.
 */
function rampScale(color: FieldColor): Scale {
  const lut = rampLutOf({
    scheme: knownScheme(color.scheme),
    range: color.range,
    reverse: color.reverse,
  })
  const { domainMin, domainMax, domainMid } = color
  return {
    kind: 'gradient',
    colours: stopsFromRampLut(lut, RAMP_STOPS).map(s => s.color),
    log: color.scale === 'log',
    limits:
      domainMin === undefined && domainMax === undefined
        ? undefined
        : [domainMin, domainMax],
    rescaleMid:
      domainMid !== undefined &&
      domainMin !== undefined &&
      domainMax !== undefined
        ? domainMid
        : undefined,
    name: color.title,
  }
}

/**
 * The colour each listed value takes is the browser's own answer: `range` in
 * `domain` order, continued into the wide palette past its end. A domain
 * left unlisted walks that palette in the data's order, as ggplot's own
 * discrete scale would walk its hue wheel.
 */
function categoricalColour(color: FieldColor): Scale {
  const domain = color.domain ?? []
  if (!domain.length) {
    return {
      kind: 'cycle',
      values: color.range?.length ? color.range : categoricalPalette,
    }
  }
  const colourOf = categoricalColorScale(domain, color.range)
  return {
    kind: 'manual',
    values: domain.map(v => [v, colourOf(v)] as const),
    name: color.title,
  }
}

/**
 * A threshold paints each bin the literal colour its `range` names, so it is
 * `cut()` into a manual scale and not `scale_*_stepsn`, which bins an
 * interpolated gradient and hands back colours nobody declared — measured at
 * `#357ebd` coming out `#4F80B6`.
 *
 * `thresholdCuts` sorts the domain ascending and drops non-finite cuts, which
 * matters because a p-value threshold is often written high-to-low, and
 * `thresholdPalette` fills a short `range` from the categorical palette.
 */
function thresholdScale(color: FieldColor, field: string) {
  const domain = thresholdCuts(color.domain ?? [])
  const palette = thresholdPalette(domain.length + 1, color.range)
  const labels = thresholdLabels(domain)
  return {
    field: expr(
      `cut(${rIdent(field)}, breaks = c(${['-Inf', ...domain, 'Inf'].join(', ')}), labels = c(${labels
        .map(l => rStr(l))
        .join(', ')}), right = FALSE)`,
    ),
    scale: {
      kind: 'manual',
      values: labels.map((l, i) => [l, palette[i]!] as const),
      name: color.title,
    } as Scale,
  }
}

/**
 * A mark's colour as either a constant or a scale over a field.
 *
 * The continuous arm reads the same baked LUT the legend and both rendering
 * backends index, so a stop in the R figure is byte-identical to the browser's
 * at that fraction rather than a second reading of the scheme name.
 */
function colourOf(
  color: Encoding['color'],
  aesthetic: 'fill' | 'colour',
  notes: string[],
): {
  field?: string | RExpr
  constant?: string
  scale?: Scale
  /** The plain column a derived `field` expression reads. */
  reads?: string
} {
  if (!color) {
    return {}
  }
  if (typeof color === 'string') {
    if (color.startsWith('jexl:')) {
      notes.push(`${aesthetic}: a jexl callback has no R counterpart`)
      return {}
    }
    return { constant: color }
  }
  // `identity` is not in the enumeration this schema passes, so a colour
  // object here always binds a field.
  if (!('field' in color)) {
    notes.push(`${aesthetic}: an identity scale is not a mark display's colour`)
    return {}
  }
  const bound: FieldColor = color
  // `none` paints `value` and keeps the field only for a switch back.
  if (bound.scale === 'none') {
    return colourOf(bound.value ?? DEFAULT_MARK_COLOR, aesthetic, notes)
  }
  const field = plainField(bound.field)
  if (!field) {
    notes.push(`${aesthetic}: a jexl callback has no R counterpart`)
    return {}
  }
  if (bound.scale === 'linear' || bound.scale === 'log') {
    return { field, scale: rampScale(bound) }
  }
  if (bound.scale === 'threshold') {
    return { reads: field, ...thresholdScale(bound, field) }
  }
  return { field, scale: categoricalColour(bound) }
}

function markAes(m: MarkConfig, origin: RExpr) {
  const { x = 'start', y, row, text, x2: locus }: Encoding = m.encoding ?? {}
  const x2 = locusField(locus)
  // An unwritten `row` is every mark on one band, not a column called `row`.
  // A preceding `pileup` writes one, and naming it is that step's `as`.
  const band = row ? row : expr('0')
  switch (m.mark) {
    case 'bar':
      return { xmin: x, xmax: x2, ymin: origin, ymax: y! }
    case 'span':
      return {
        xmin: x,
        xmax: x2,
        ymin: band,
        ymax: expr(`${row ? rIdent(row) : '0'} + 0.8`),
      }
    // At `x`, not the midpoint: both backends append the glyph at the left
    // edge (`pointMark.ts` and the vertex stage), widening to a bar rather
    // than centring.
    case 'point':
      return { x, y: y! }
    case 'text':
      return {
        x: midpoint(x, x2),
        y: y || band,
        label: text ?? DEFAULT_TEXT_FIELD,
      }
    // A link's apex rides `y` where it names one, and its feet sit on the row.
    case 'link':
      return { x, xend: x2, y: y || band, yend: y || band }
  }
}

/** A locus channel is a `pos` field, written bare or beside a `chrom`. */
function locusField(locus: Encoding['x2']) {
  if (!locus) {
    return 'end'
  }
  return typeof locus === 'string' ? locus : (locus.pos ?? 'end')
}

/**
 * A point symbol as R's `pch`. The names are Vega-Lite's (ADR-159) and R has no
 * names at all, so the mapping is stated once here rather than at each call.
 */
const PCH: Record<string, number> = {
  circle: 16,
  'triangle-down': 25,
  diamond: 18,
}

function shapeOf(
  shape: Encoding['shape'],
  notes: string[],
): { field?: string; constant?: number; scale?: Scale } {
  if (!shape) {
    return {}
  }
  if (typeof shape === 'string') {
    if (shape.startsWith('jexl:')) {
      notes.push('shape: a jexl callback has no R counterpart')
      return {}
    }
    return { constant: PCH[shape] ?? PCH.circle }
  }
  // `none` draws `value`, and so does a field left unwritten.
  if (shape.scale === 'none' || !shape.field) {
    return shapeOf(shape.value ?? 'circle', notes)
  }
  const field = plainField(shape.field)
  if (!field) {
    notes.push('shape: a jexl callback has no R counterpart')
    return {}
  }
  // The browser's rule, from `markEncoding.ts`: `range` in domain order,
  // continued into the shape list where it runs out, and the shape list alone
  // for a domain left unlisted.
  const domain = shape.domain ?? []
  const range = shape.range ?? []
  const pch = (name: string) => PCH[name] ?? PCH.circle!
  if (!domain.length) {
    return {
      field,
      scale: {
        kind: 'cycle',
        values: (range.length ? range : SHAPE_NAMES).map(pch),
      },
    }
  }
  const shapeOfValue = categoricalScale(domain, range, {
    fallback: range.length > domain.length ? [] : SHAPE_NAMES,
  })
  return {
    field,
    scale: {
      kind: 'manual',
      values: domain.map(v => [v, String(pch(shapeOfValue(v)))] as const),
    },
  }
}

/** A link's stroke: a field through a linear or log scale into a px width. */
function sizeOf(size: Encoding['size']) {
  const field = plainField(size?.field)
  if (!field || !size) {
    return {}
  }
  const [lo = DEFAULT_SIZE_RANGE_PX[0], hi = DEFAULT_SIZE_RANGE_PX[1]] = (
    size.range ?? []
  ).map(Number)
  return {
    field,
    scale: {
      kind: size.scale === 'log' ? 'linewidthLog' : 'linewidth',
      range: [lo, hi],
    } as Scale,
  }
}

function markParams(m: MarkConfig) {
  return m.mark === 'link'
    ? { curvature: m.linkShape === 'arc' ? -0.6 : -0.3 }
    : undefined
}

/** The mark's own `size`: a link's stroke in px, a point's diameter in px. */
function markConstants(m: MarkConfig): Partial<Record<Aesthetic, number>> {
  if (m.mark === 'link') {
    return { linewidth: m.size ?? DEFAULT_LINK_STROKE_PX }
  }
  if (m.mark === 'point' && m.size !== undefined) {
    return { size: m.size * MM_PER_PX }
  }
  return {}
}

/**
 * One mark's layer over `frame`, and the scales its channels declare.
 *
 * Scales come back keyed by aesthetic so the caller merges them into the
 * plot's one-per-aesthetic table rather than appending a second scale ggplot
 * would silently drop.
 */
export function markLayer(
  m: MarkConfig,
  frame: RFrame,
  origin: RExpr,
  notes: string[],
) {
  const geom = GEOM_OF[m.mark]
  // A bar or point reads a value, and the display draws nothing for one naming
  // none — inventing a field here would draw a figure the browser does not.
  const encoding: Encoding = m.encoding ?? {}
  if (readsValue(m.mark) && !encoding.y) {
    notes.push(`${m.mark}: names no value field, so it draws nothing`)
    return undefined
  }
  const colourAes = colourAesthetic(geom)
  const colour = colourOf(encoding.color, colourAes, notes)
  const scales: Partial<Record<Aesthetic, Scale>> = {}
  if (colour.scale) {
    scales[colourAes] = colour.scale
  }
  if (m.source === 'density') {
    notes.push(`${m.mark}: drawn from the density sidecar, not the features`)
  }
  if (m.minBpPerPx !== undefined || m.maxBpPerPx !== undefined) {
    notes.push(`${m.mark}: its zoom range is a live-view rule, not a figure's`)
  }
  // `shape` is the point's channel and `size` the link's — MARK_SPECS says
  // which, so a channel written on a mark that does not take it is the config's
  // problem to report, not a scale to emit.
  const takes = MARK_SPECS[m.mark].channels as readonly string[]
  const shape = takes.includes('shape') ? shapeOf(encoding.shape, notes) : {}
  if (shape.scale) {
    scales.shape = shape.scale
  }
  const width = takes.includes('size') ? sizeOf(encoding.size) : {}
  if (width.scale) {
    scales.linewidth = width.scale
  }
  const l = layer({
    geom,
    frame,
    aes: {
      ...markAes(m, origin),
      ...(colour.field ? { [colourAes]: colour.field } : {}),
      ...(shape.field ? { shape: shape.field } : {}),
      ...(width.field ? { linewidth: width.field } : {}),
    },
    constants: {
      ...markConstants(m),
      ...(colour.constant ? { [colourAes]: colour.constant } : {}),
      ...(shape.constant !== undefined ? { shape: shape.constant } : {}),
    },
    params: markParams(m),
  })
  const missing = missingColumns(
    { ...l.aes, ...(colour.reads ? { reads: colour.reads } : {}) },
    frame,
  )
  if (missing.length) {
    notes.push(
      `${m.mark}: reads ${missing.join(', ')}, which no stage produces, so it draws nothing`,
    )
    return undefined
  }
  return { layer: l, scales }
}

/**
 * The columns a layer reads that its frame does not hold.
 *
 * The step list is config, so the column set is only known at export time and
 * no type covers it: `applyTransforms` answers `string[]`, which widens
 * `Aes<C>` to any string at every real call site. R finds the same mistake at
 * draw time, after every read, and names `base::row` rather than the column
 * when the miss happens to collide with a base function.
 */
function missingColumns(aes: Record<string, unknown>, frame: RFrame) {
  const held = new Set<string>(frame.columns)
  return Object.values(aes)
    .filter((v): v is string => typeof v === 'string')
    .filter(v => !held.has(v))
}

function channelFields(m: MarkConfig) {
  const { x, x2, y, row, text, color, shape, size }: Encoding = m.encoding ?? {}
  return [
    x,
    typeof x2 === 'string' ? x2 : x2?.pos,
    typeof x2 === 'string' ? undefined : x2?.chrom,
    y,
    row,
    text,
    typeof color === 'object' && 'field' in color ? color.field : undefined,
    typeof shape === 'object' ? shape.field : undefined,
    size?.field,
  ]
}

/**
 * The fields of the file a display reads, for the reader to fetch: every
 * plain field a channel, a step, the facet or the rows names, less what a step
 * writes — that one is not in the file, and asking a reader for it would hand
 * the mark an all-NA column where `missingColumns` should refuse it.
 */
export function fieldsRead(display: DisplaySpec) {
  const facet = facetOf(display.facet)
  const lists = [
    display.transform ?? [],
    facet.transform ?? [],
    ...display.marks.map(m => m.transform ?? []),
  ]
  const made = stepOutputs(lists)
  const named = [
    ...lists.flat().flatMap(stepReads),
    ...display.marks.flatMap(channelFields),
    facet.field,
    rowsOf(display.rows).field,
  ]
  return [
    ...new Set(
      named.map(plainField).filter((f): f is string => !!f && !made.has(f)),
    ),
  ]
}

/**
 * A mark display's config as a ggplot.
 *
 * `frame` is what the caller's reader helper produced — this translates the
 * grammar, not the fetch, so the same display over a BigWig and over a BED
 * differ only in the frame handed in.
 */
export function markPlot({
  display,
  frame,
  regions,
}: {
  display: DisplaySpec
  frame: RFrame
  /**
   * The displayed regions. Past one they concatenate onto a cumulative-bp
   * axis, so the x range is the one `region_layout` computed and not the
   * genomic span — pinning the latter left a two-region figure 82% empty.
   */
  regions?: readonly Region[]
}): TranslatedPlot {
  const notes: string[] = []
  const y = display.scales?.y
  const logY = y?.type === 'log'
  const origin = display.origin ?? 0
  // Under a log axis a bar from 0 transforms to -Inf with a warning per draw;
  // the panel's bottom edge is what the display draws it from.
  const baseline = expr(logY && origin <= 0 ? '-Inf' : String(origin))
  const layers: Layer[] = []
  const scales: Partial<Record<Aesthetic, Scale>> = {}
  const span = (regions ?? []).reduce((a, r) => a + (r.end - r.start), 0)
  const bpPerPx = Math.max(span, 1) / FIGURE_WIDTH_PX
  const shifted = (regions?.length ?? 0) > 1
  const facet = facetOf(display.facet)
  // The display's steps run before every mark's own, as the encoder runs them:
  // the shared frame is what each mark then reads, and its columns are what the
  // steps left rather than what the adapter answered.
  const displayed = applyTransforms({
    base: frame,
    steps: display.transform ?? [],
    notes,
    bpPerPx,
    shifted,
  })
  const facetField = splitField('facet', facet.field, displayed, notes)
  const shared = applyTransforms({
    base: displayed,
    steps: facet.transform ?? [],
    notes,
    bpPerPx,
    shifted,
    within: facetField,
    inheritedBin: lastBinOf(display.transform ?? []),
  })
  const above = [...(display.transform ?? []), ...(facet.transform ?? [])]
  for (const [i, m] of display.marks.entries()) {
    const own = m.transform?.length
      ? applyTransforms({
          base: shared,
          steps: m.transform,
          notes,
          name: `${frame.name}_${i + 1}`,
          inheritedBin: lastBinOf(above),
          bpPerPx,
          shifted,
        })
      : shared
    const built = markLayer(m, own, baseline, notes)
    if (!built) {
      continue
    }
    layers.push(built.layer)
    for (const [aesthetic, scale] of Object.entries(built.scales)) {
      const key = aesthetic as Aesthetic
      if (scales[key]) {
        notes.push(
          `${key}: a second scale on one aesthetic, which ggplot cannot hold`,
        )
      } else {
        scales[key] = scale
      }
    }
  }
  if (logY) {
    scales.y = { kind: 'log' }
  } else if (y?.type === 'symlog') {
    notes.push('y: symlog has no ggplot counterpart; drawn linear')
  }
  const rows = rowsOf(display.rows)
  const rowsField = splitField('rows', rows.field, displayed, notes)
  // One row per value is one panel per value, which is what a facet draws;
  // beside a facet the facet draws, as the display draws it.
  let facetBy: Plot['facetBy']
  if (facetField) {
    facetBy = { field: facetField, levels: facet.domain }
    if (rowsField) {
      notes.push('rows: the facet draws, so the rows are not drawn')
    }
  } else if (rowsField) {
    facetBy = { field: rowsField, levels: rows.domain }
  }
  if (display.rowColor?.field || display.rowColor?.domain?.length) {
    notes.push(
      'rowColor: the tint beside a row label has no ggplot counterpart',
    )
  }
  if (display.jexlFilters?.length) {
    notes.push(
      `jexlFilters: ${display.jexlFilters.length} jexl filter(s) have no R counterpart, so the figure shows unfiltered rows`,
    )
  }
  const rules = (y?.rules ?? []).map(r => ({
    value: r.value ?? 0,
    colour: r.color ?? DEFAULT_RULE_COLOR,
    label: r.label || undefined,
  }))
  return {
    plot: {
      layers,
      scales,
      facetBy,
      rules: rules.length ? rules : undefined,
      xlim: shifted
        ? expr('min(regions$cum_start), max(regions$cum_end)')
        : regions?.[0],
      ylim: ylimOf(y, logY, notes),
      labs: {
        x: shifted
          ? 'bp, regions end to end'
          : regions?.[0]
            ? `${regions[0].refName} (bp)`
            : 'bp',
        y: y?.title ?? null,
      },
      legend: display.showLegend ?? true,
    },
    notes,
  }
}

/** A field the display splits on, where it is plain and the frame holds it. */
function splitField(
  slot: 'facet' | 'rows',
  field: string | undefined,
  frame: RFrame,
  notes: string[],
) {
  if (!field) {
    return undefined
  }
  const plain = plainField(field)
  if (!plain) {
    notes.push(`${slot}: a jexl callback has no R counterpart`)
    return undefined
  }
  if (!frame.columns.includes(plain)) {
    notes.push(
      `${slot}: reads ${plain}, which no stage produces, so it is not drawn`,
    )
    return undefined
  }
  return plain
}

/**
 * The pinned y range. A log axis cannot hold a bound at or below zero —
 * `coord_cartesian` on a log scale asks for a finite transformed limit — so
 * that bound is left to the data and the header says so.
 */
function ylimOf(
  y: NonNullable<DisplaySpec['scales']>['y'],
  logY: boolean,
  notes: string[],
) {
  if (y?.domainMin === undefined && y?.domainMax === undefined) {
    return undefined
  }
  const positive = (v: number | undefined) => {
    if (logY && v !== undefined && v <= 0) {
      notes.push(`y: a log axis cannot pin ${v}, so that end follows the data`)
      return undefined
    }
    return v
  }
  const min = positive(y.domainMin)
  const max = positive(y.domainMax)
  return min === undefined && max === undefined ? undefined : { min, max }
}

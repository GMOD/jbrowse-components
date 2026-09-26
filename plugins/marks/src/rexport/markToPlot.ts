import {
  categoricalColorScale,
  categoricalPalette,
  categoricalScale,
} from '@jbrowse/core/ui/colors'
import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import {
  FEATURE_FIELD_PRESETS,
  fieldScaleOf,
  paintedScale,
  withPreset,
} from '@jbrowse/core/util/colorScale'
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

import {
  MARK_SPECS,
  plotsValue,
  readsValue,
} from '../LinearMarkDisplay/markSpecs.ts'
import {
  DEFAULT_LINK_STROKE_PX,
  DEFAULT_ROW_PROPORTION,
  DEFAULT_TEXT_FIELD,
  type LineInterpolation,
  type LinkShape,
  type MarkType,
} from '../LinearMarkDisplay/markVocabulary.ts'
import { stepChannels } from '../LinearMarkDisplay/stepChannels.ts'
import { FIGURE_WIDTH_PX } from './rScript.ts'
import {
  colourAesthetic,
  expr,
  layer,
  rIdent,
  frame as rFrame,
  rStr,
} from './rplot.ts'
import {
  applyTransforms,
  lastBinOf,
  stepOutputs,
  stepReads,
} from './transformR.ts'

import type { MarkSpec } from '../LinearMarkDisplay/markSpecs.ts'
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

/**
 * A colour object as a config writes one: `value` the constant, `field`
 * through `scale` the mapping. A bare string on the encoding is the field.
 */
export interface ColorSpec {
  value?: string
  field?: string
  scale?: string
  domain?: string[]
  range?: string[]
  labels?: string[]
  scheme?: string
  reverse?: boolean
  domainMin?: number
  domainMax?: number
  domainMid?: number
  domainQuantile?: number
  title?: string
}

/** How many stops a continuous ramp hands ggplot's `gradientn`. */
const RAMP_STOPS = 16

/** A px on screen as ggplot's mm, at the 96 dpi a browser draws at. */
const MM_PER_PX = 25.4 / 96

/** A px stroke as ggplot's `linewidth`, whose unit is 72.27 / 25.4 of R's 1/96 in `lwd`. */
function linewidth(px: number) {
  return Number(((px * 25.4) / 72.27).toFixed(2))
}

function knownScheme(scheme: string | undefined) {
  return COLOR_SCHEMES.find((s): s is ColorSchemeName => s === scheme)
}

export interface MarkConfig {
  mark: MarkType
  linkShape?: LinkShape
  interpolate?: LineInterpolation
  rowProportion?: number
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
    color?: string | ColorSpec
    shape?:
      | string
      | {
          field?: string
          scale?: string
          value?: string
          range?: string[]
          domain?: string[]
        }
    size?:
      | number
      | string
      | {
          value?: number
          field?: string
          scale?: string
          range?: (string | number)[]
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
  filter?: string[]
  scales?: {
    y?: {
      type?: string
      zero?: boolean
      domainMin?: number
      domainMax?: number
      title?: string
      rules?: (number | { value?: number; color?: string; label?: string })[]
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
  rule: 'segment',
  line: 'path',
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
function rampScale(color: ColorSpec, notes: string[]): Scale {
  const lut = rampLutOf({
    scheme: knownScheme(color.scheme),
    range: color.range,
    reverse: color.reverse,
  })
  const { domainMin, domainMax, domainMid, domainQuantile = 1 } = color
  const log = color.scale === 'log'
  if (
    domainQuantile < 1 &&
    (domainMin === undefined || domainMax === undefined)
  ) {
    notes.push(
      `color: an open end follows the data's extremes, not its ${domainQuantile} quantile`,
    )
  }
  return {
    kind: 'gradient',
    colours: stopsFromRampLut(lut, RAMP_STOPS).map(s => s.color),
    log,
    limits:
      domainMin === undefined && domainMax === undefined
        ? undefined
        : [domainMin, domainMax],
    rescaleMid:
      domainMid === undefined
        ? undefined
        : log
          ? Math.log10(domainMid)
          : domainMid,
    name: color.title,
  }
}

/**
 * A field read as categories, keyed by its text as the browser keys them: a
 * numeric column such as strand's 1 and -1 reaches a discrete scale, which
 * refuses a number, and matches a `domain` written as strings.
 */
function categories(field: string) {
  return expr(`as.character(${rIdent(field)})`)
}

/**
 * The colour each listed value takes is the browser's own answer: `range` in
 * `domain` order, continued into the wide palette past its end. A domain
 * left unlisted walks that palette in the data's order, as ggplot's own
 * discrete scale would walk its hue wheel.
 */
function categoricalColour(color: ColorSpec, field: string): Scale {
  const domain = color.domain ?? []
  if (!domain.length) {
    return {
      kind: 'cycle',
      values: color.range?.length ? color.range : categoricalPalette,
      name: color.title ?? field,
    }
  }
  const colourOf = categoricalColorScale(domain, color.range)
  return {
    kind: 'manual',
    values: domain.map(v => [v, colourOf(v)] as const),
    labels: color.labels?.length ? color.labels : undefined,
    name: color.title ?? field,
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
function thresholdScale(color: ColorSpec, field: string) {
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
      name: color.title ?? field,
    } as Scale,
  }
}

/**
 * A mark's colour as either a constant or a scale over a field, by the
 * browser's rule: a bare string is a field, `{ value }` the constant, and a
 * field whose `scale` is unset paints through its preset — `score` a ramp,
 * `strand` and `svType` their own colours and names, any other field
 * categories.
 *
 * The continuous arm reads the same baked LUT the legend and both rendering
 * backends index, so a stop in the R figure is byte-identical to the browser's
 * at that fraction rather than a second reading of the scheme name.
 */
function colourOf(
  color: Encoding['color'],
  aesthetic: 'fill' | 'colour',
  notes: string[],
  fallback: string | undefined,
): {
  field?: string | RExpr
  constant?: string
  scale?: Scale
  /** The plain column a derived `field` expression reads. */
  reads?: string
} {
  const written = typeof color === 'string' ? { field: color } : (color ?? {})
  const bound = withPreset(
    { ...written, field: written.field ?? '' },
    FEATURE_FIELD_PRESETS,
  )
  const scale = paintedScale(
    { scale: bound.scale, field: bound.field },
    fieldScaleOf(FEATURE_FIELD_PRESETS, bound.field),
  )
  if (scale === 'none') {
    const value = bound.value ?? fallback
    if (value?.startsWith('jexl:')) {
      notes.push(`${aesthetic}: a jexl callback has no R counterpart`)
      return {}
    }
    return value ? { constant: value } : {}
  }
  const field = plainField(bound.field)
  if (!field) {
    notes.push(`${aesthetic}: a jexl callback has no R counterpart`)
    return {}
  }
  if (scale === 'linear' || scale === 'log') {
    return { field, scale: rampScale({ ...bound, scale }, notes) }
  }
  if (scale === 'threshold') {
    return { reads: field, ...thresholdScale(bound, field) }
  }
  if (scale !== 'categorical') {
    notes.push(`${aesthetic}: an ${scale} scale is not a mark display's colour`)
    return {}
  }
  return {
    field: categories(field),
    reads: field,
    scale: categoricalColour(bound, field),
  }
}

/** `offset` of the way up a mark's row band, or of the one band where it names no row. */
function band(row: string | undefined, offset: number) {
  if (!row) {
    return expr(String(offset))
  }
  return offset ? expr(`${rIdent(row)} + ${offset}`) : row
}

function markAes(
  m: MarkConfig,
  origin: RExpr,
  { y, row }: { y?: string; row?: string },
) {
  const { x = 'start', text, x2: locus }: Encoding = m.encoding ?? {}
  const x2 = locusField(locus)
  switch (m.mark) {
    case 'bar':
      return { xmin: x, xmax: x2, ymin: origin, ymax: y! }
    case 'span': {
      const pad = round((1 - (m.rowProportion ?? DEFAULT_ROW_PROPORTION)) / 2)
      return {
        xmin: x,
        xmax: x2,
        ymin: band(row, pad),
        ymax: band(row, round(1 - pad)),
      }
    }
    case 'point':
      return { x: midpoint(x, x2), y: y! }
    case 'rule':
      return { x, xend: x2, y: y!, yend: y! }
    case 'line':
      return m.interpolate === 'linear'
        ? { x: midpoint(x, x2), y: y!, group: lineGroup(row) }
        : { x: '.x', y: '.y', group: '.group' }
    case 'text':
      return {
        x: midpoint(x, x2),
        y: y || band(row, 0.5),
        label: text ?? DEFAULT_TEXT_FIELD,
      }
    // A link's apex rides `y` where it names one, and its feet sit on the row.
    case 'link':
      return { x, xend: x2, y: y || band(row, 0), yend: y || band(row, 0) }
  }
}

function round(v: number) {
  return Number(v.toFixed(6))
}

/** One line per region and row; a facet splits them further by panel. */
function lineGroup(row: string | undefined) {
  return row ? expr(`interaction(.region, ${rIdent(row)})`) : '.region'
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
): { field?: RExpr; reads?: string; constant?: number; scale?: Scale } {
  if (!shape) {
    return {}
  }
  // A bare string is the field, as every channel's is inside `encoding`.
  if (typeof shape === 'string') {
    return shapeOf({ field: shape }, notes)
  }
  // `none` draws `value`, and so does a field left unwritten.
  if (shape.scale === 'none' || !shape.field) {
    const value = shape.value ?? 'circle'
    if (value.startsWith('jexl:')) {
      notes.push('shape: a jexl callback has no R counterpart')
      return {}
    }
    return { constant: PCH[value] ?? PCH.circle }
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
      field: categories(field),
      reads: field,
      scale: {
        kind: 'cycle',
        values: (range.length ? range : SHAPE_NAMES).map(pch),
        name: field,
      },
    }
  }
  const shapeOfValue = categoricalScale(domain, range, {
    fallback: range.length > domain.length ? [] : SHAPE_NAMES,
  })
  return {
    field: categories(field),
    reads: field,
    scale: {
      kind: 'manual',
      values: domain.map(v => [v, String(pch(shapeOfValue(v)))] as const),
      name: field,
    },
  }
}

/**
 * A mark's `size`: a number is every instance's px, a point's diameter, a
 * rule's or a line's thickness or a link's stroke; a field, which only a link
 * reads, goes through a linear or log scale into a stroke width.
 */
function sizeOf(
  m: MarkConfig,
  notes: string[],
): {
  field?: string
  scale?: Scale
  constants?: Partial<Record<Aesthetic, number>>
} {
  const size = m.encoding?.size
  const spec =
    typeof size === 'number'
      ? { value: size }
      : typeof size === 'string'
        ? { field: size }
        : (size ?? {})
  const channel = (MARK_SPECS[m.mark] as MarkSpec).size === 'channel'
  const field = plainField(spec.field)
  if (channel && field) {
    const [lo = DEFAULT_SIZE_RANGE_PX[0], hi = DEFAULT_SIZE_RANGE_PX[1]] = (
      spec.range ?? []
    ).map(Number)
    return {
      field,
      scale: {
        kind: spec.scale === 'log' ? 'linewidthLog' : 'linewidth',
        range: [linewidth(lo), linewidth(hi)],
      },
    }
  }
  if (spec.field && !channel) {
    notes.push(`${m.mark}: its size is a number, so the field is not read`)
  }
  return { constants: constantSize(m.mark, spec.value) }
}

function constantSize(
  mark: MarkType,
  px: number | undefined,
): Partial<Record<Aesthetic, number>> {
  if (mark === 'link') {
    return { linewidth: linewidth(px ?? DEFAULT_LINK_STROKE_PX) }
  }
  if (px === undefined) {
    return {}
  }
  if (mark === 'point') {
    return { size: px * MM_PER_PX }
  }
  return mark === 'rule' || mark === 'line' ? { linewidth: linewidth(px) } : {}
}

function markParams(m: MarkConfig) {
  return m.mark === 'link'
    ? { curvature: m.linkShape === 'arc' ? -0.6 : -0.3 }
    : undefined
}

/**
 * One mark's layer over `frame`, and the scales its channels declare.
 *
 * Scales come back keyed by aesthetic so the caller merges them into the
 * plot's one-per-aesthetic table rather than appending a second scale ggplot
 * would silently drop.
 *
 * A `y` or `row` the mark leaves unwritten is what its steps fill, as the
 * browser reads it: the depth a `coverage` writes, the one summary a
 * single-op `aggregate` writes, the row a `pileup` packs.
 */
export function markLayer(
  m: MarkConfig,
  frame: RFrame,
  origin: RExpr,
  notes: string[],
  {
    steps = [],
    by = [],
    name = `${frame.name}_path`,
  }: {
    /** Every step the mark's frame went through, display's first. */
    steps?: readonly Step[]
    /** Fields the figure splits panels by, which a line does not run across. */
    by?: readonly string[]
    /** The binding a step line's vertices land in. */
    name?: string
  } = {},
) {
  const encoding: Encoding = m.encoding ?? {}
  const filled = stepChannels(steps)
  const y = plainField(encoding.y) || filled.y
  const row = plainField(encoding.row) || filled.row
  // A bar or point reads a value, and the display draws nothing for one naming
  // none — inventing a field here would draw a figure the browser does not.
  if (readsValue(m.mark) && !y) {
    notes.push(`${m.mark}: names no value field, so it draws nothing`)
    return undefined
  }
  const stepLine = m.mark === 'line' && m.interpolate !== 'linear'
  const x = encoding.x ?? 'start'
  const x2 = locusField(encoding.x2)
  const unread = stepLine ? missingColumns({ x, x2, y, row }, frame) : []
  if (unread.length) {
    notes.push(
      `${m.mark}: reads ${unread.join(', ')}, which no stage produces, so it draws nothing`,
    )
    return undefined
  }
  const drawn = stepLine
    ? rFrame({
        name,
        columns: [...frame.columns, '.x', '.y', '.group'],
        coords: frame.coords,
        packages: frame.packages,
        statements: `${name} <- step_path(${frame.name}, ${[x, x2, y!]
          .map(c => rStr(c))
          .join(', ')},
  origin = ${origin.expr}, by = c(${['.region', ...(row ? [row] : []), ...by]
    .map(c => rStr(c))
    .join(', ')}))`,
        parent: frame,
      })
    : frame
  // geom_line draws in x order, which the linear line joins its centres in.
  const geom = m.mark === 'line' && !stepLine ? 'line' : GEOM_OF[m.mark]
  const colourAes = colourAesthetic(geom)
  const colour = colourOf(
    encoding.color,
    colourAes,
    notes,
    m.mark === 'text' ? undefined : DEFAULT_MARK_COLOR,
  )
  const scales: Partial<Record<Aesthetic, Scale>> = {}
  if (colour.scale) {
    scales[colourAes] = colour.scale
  }
  if (m.source === 'density') {
    notes.push(`${m.mark}: drawn from the density sidecar, not the features`)
  }
  if (m.minBpPerPx || m.maxBpPerPx) {
    notes.push(`${m.mark}: its zoom range is a live-view rule, not a figure's`)
  }
  // `shape` is the point's channel, and MARK_SPECS says so, so a shape written
  // on a mark that does not take it is the config's problem to report, not a
  // scale to emit.
  const takes = MARK_SPECS[m.mark].channels as readonly string[]
  const shape = takes.includes('shape') ? shapeOf(encoding.shape, notes) : {}
  if (shape.scale) {
    scales.shape = shape.scale
  }
  const size = sizeOf(m, notes)
  if (size.scale) {
    scales.linewidth = size.scale
  }
  const l = layer({
    geom,
    frame: drawn,
    aes: {
      ...markAes(m, origin, { y, row }),
      ...(colour.field ? { [colourAes]: colour.field } : {}),
      ...(shape.field ? { shape: shape.field } : {}),
      ...(size.field ? { linewidth: size.field } : {}),
    },
    constants: {
      ...size.constants,
      ...(colour.constant ? { [colourAes]: colour.constant } : {}),
      ...(shape.constant !== undefined ? { shape: shape.constant } : {}),
    },
    params: markParams(m),
  })
  const missing = missingColumns(
    { ...l.aes, colour: colour.reads, shape: shape.reads },
    drawn,
  )
  if (missing.length) {
    notes.push(
      `${m.mark}: reads ${missing.join(', ')}, which no stage produces, so it draws nothing`,
    )
    return undefined
  }
  return { layer: l, scales, valued: plotsValue(m.mark) && !!y }
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
    typeof color === 'object' ? color.field : color,
    typeof shape === 'object' ? shape.field : shape,
    typeof size === 'object'
      ? size.field
      : typeof size === 'string'
        ? size
        : undefined,
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
  const above = [...(display.transform ?? []), ...(facet.transform ?? [])]
  let valued = false
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
    const built = markLayer(m, own, baseline, notes, {
      steps: [...above, ...(m.transform ?? [])],
      by: facetBy ? [facetBy.field] : [],
      name: `${frame.name}_path${i + 1}`,
    })
    if (!built) {
      continue
    }
    valued ||= built.valued
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
  if (display.rowColor?.field || display.rowColor?.domain?.length) {
    notes.push(
      'rowColor: the tint beside a row label has no ggplot counterpart',
    )
  }
  if (display.filter?.length) {
    notes.push(
      `filter: ${display.filter.length} jexl expression(s) have no R counterpart, so the figure shows unfiltered rows`,
    )
  }
  const rules = (y?.rules ?? []).map(r =>
    typeof r === 'number'
      ? { value: r, colour: DEFAULT_RULE_COLOR }
      : {
          value: r.value ?? 0,
          colour: r.color ?? DEFAULT_RULE_COLOR,
          label: r.label || undefined,
        },
  )
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
      // `scales.y.zero`, on unless written off: a linear axis reaches 0
      // whatever the values span, where ggplot would span the values alone.
      expandY: valued && !logY && y?.zero !== false ? 0 : undefined,
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

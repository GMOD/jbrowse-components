import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { DEFAULT_SIZE_RANGE_PX } from '@jbrowse/core/util/markEncoding'
import { SHAPE_NAMES } from '@jbrowse/core/util/shapeNames'
import {
  thresholdCuts,
  thresholdLabels,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'

import { MARK_SPECS, readsValue } from '../LinearMarkDisplay/markSpecs.ts'
import {
  DEFAULT_LINK_STROKE_PX,
  type LinkShape,
  type MarkType,
} from '../LinearMarkDisplay/markVocabulary.ts'
import { colourAesthetic, expr, layer, rStr } from './rplot.ts'
import { applyTransforms, lastBinOf } from './transformR.ts'

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

/** The arm of a colour channel that binds a field, which the string arm leaves. */
type FieldColor = Exclude<ColorChannel, string | IdentityColorChannel>

/** How many stops a continuous ramp hands ggplot's `gradientn`. */
const RAMP_STOPS = 16

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
  encoding: {
    x?: string
    x2?: string | { pos?: string; chrom?: string }
    y?: string
    row?: string
    text?: string
    color?: ColorChannel
    shape?: string | { field: string; range?: string[]; domain?: string[] }
    size?: {
      field?: string
      scale?: string
      range?: string[]
      domainMin?: number
      domainMax?: number
    }
  }
}

export interface DisplaySpec {
  marks: MarkConfig[]
  transform?: Step[]
  facet?: { field?: string }
  scales?: {
    y?: {
      type?: string
      domainMin?: number
      domainMax?: number
      title?: string
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
  return x2 ? expr(`(${x} + ${x2}) / 2`) : x
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

function categoricalScale(color: FieldColor): Scale {
  const domain = color.domain ?? []
  const range = color.range ?? []
  return {
    kind: 'manual',
    values: Object.fromEntries(
      domain.map((v, i) => [v, range[i] ?? range.at(-1) ?? 'grey50']),
    ),
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
      `cut(${field}, breaks = c(-Inf, ${domain.join(', ')}, Inf), labels = c(${labels
        .map(l => rStr(l))
        .join(', ')}), right = FALSE)`,
    ),
    scale: {
      kind: 'manual',
      values: Object.fromEntries(labels.map((l, i) => [l, palette[i]!])),
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
  color: ColorChannel | undefined,
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
  // An unlisted domain is every value deriving its colour from itself, which a
  // manual scale cannot express — it needs the values, and only the data has
  // them. ggplot's own discrete palette is the same rule.
  if (!bound.domain?.length) {
    return { field }
  }
  return { field, scale: categoricalScale(bound) }
}

function markAes(m: MarkConfig, origin: number) {
  const { x = 'start', y, row, text } = m.encoding
  const x2 = locusField(m.encoding.x2)
  // An unwritten `row` is every mark on one band, not a column called `row`.
  // A preceding `pileup` writes one, and naming it is that step's `as`.
  const bandSrc = row || '0'
  const band = row ? row : expr('0')
  switch (m.mark) {
    case 'bar':
      return { xmin: x, xmax: x2, ymin: expr(String(origin)), ymax: y! }
    case 'span':
      return { xmin: x, xmax: x2, ymin: band, ymax: expr(`${bandSrc} + 0.8`) }
    // At `x`, not the midpoint: both backends append the glyph at the left
    // edge (`pointMark.ts` and the vertex stage), widening to a bar rather
    // than centring.
    case 'point':
      return { x, y: y! }
    case 'text':
      return { x: midpoint(x, x2), y: y || band, label: text ?? 'name' }
    // A link's apex rides `y` where it names one, and its feet sit on the row.
    case 'link':
      return { x, xend: x2, y: y || band, yend: y || band }
  }
}

/** A locus channel is a `pos` field, written bare or beside a `chrom`. */
function locusField(locus: MarkConfig['encoding']['x2']) {
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
  shape: MarkConfig['encoding']['shape'],
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
    return { constant: PCH[shape] }
  }
  const field = plainField(shape.field)
  if (!field) {
    notes.push('shape: a jexl callback has no R counterpart')
    return {}
  }
  const domain = shape.domain ?? []
  const range = shape.range ?? SHAPE_NAMES
  return {
    field,
    scale: {
      kind: 'manual',
      values: Object.fromEntries(
        domain.map((v, i) => [
          v,
          String(PCH[range[i % range.length] ?? 'circle'] ?? PCH.circle),
        ]),
      ),
    },
  }
}

/** A link's stroke: a field through a linear or log scale into a px width. */
function sizeOf(size: MarkConfig['encoding']['size']) {
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

function markConstants(m: MarkConfig): Partial<Record<Aesthetic, number>> {
  return m.mark === 'link'
    ? { linewidth: m.size ?? DEFAULT_LINK_STROKE_PX }
    : {}
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
  origin: number,
  notes: string[],
) {
  const geom = GEOM_OF[m.mark]
  // A bar or point reads a value, and the display draws nothing for one naming
  // none — inventing a field here would draw a figure the browser does not.
  if (readsValue(m.mark) && !m.encoding.y) {
    notes.push(`${m.mark}: names no value field, so it draws nothing`)
    return undefined
  }
  const colourAes = colourAesthetic(geom)
  const colour = colourOf(m.encoding.color, colourAes, notes)
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
  const shape = takes.includes('shape') ? shapeOf(m.encoding.shape, notes) : {}
  if (shape.scale) {
    scales.shape = shape.scale
  }
  const width = takes.includes('size') ? sizeOf(m.encoding.size) : {}
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
  regions?: readonly { start: number; end: number }[]
}): TranslatedPlot {
  const notes: string[] = []
  const origin = display.origin ?? 0
  const layers: Layer[] = []
  const scales: Partial<Record<Aesthetic, Scale>> = {}
  // The display's steps run before every mark's own, as the encoder runs them:
  // the shared frame is what each mark then reads, and its columns are what the
  // steps left rather than what the adapter answered.
  const shared = applyTransforms({
    base: frame,
    steps: display.transform ?? [],
    notes,
  })
  for (const [i, m] of display.marks.entries()) {
    const own = m.transform?.length
      ? applyTransforms({
          base: shared,
          steps: m.transform,
          notes,
          name: `${frame.name}_${i + 1}`,
          inheritedBin: lastBinOf(display.transform ?? []),
        })
      : shared
    const built = markLayer(m, own, origin, notes)
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
  const y = display.scales?.y
  if (y?.type === 'log') {
    scales.y = { kind: 'log' }
  } else if (y?.type === 'symlog') {
    notes.push('y: symlog has no ggplot counterpart; drawn linear')
  }
  const facetField = plainField(display.facet?.field)
  if (display.facet?.field && !facetField) {
    notes.push('facet: a jexl callback has no R counterpart')
  }
  return {
    plot: {
      layers,
      scales,
      facetBy: facetField,
      xlim:
        regions && regions.length > 1
          ? expr('min(regions$cum_start), max(regions$cum_end)')
          : regions?.[0],
      ylim:
        y?.domainMin === undefined && y?.domainMax === undefined
          ? undefined
          : { min: y.domainMin, max: y.domainMax },
      labs: { y: y?.title ?? null },
      legend: display.showLegend ?? true,
    },
    notes,
  }
}

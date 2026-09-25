import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { isIdentityColor } from '@jbrowse/display-kit/channelSpec'

import {
  DEFAULT_LINK_STROKE_PX,
  type LinkShape,
  type MarkType,
} from '../LinearMarkDisplay/markVocabulary.ts'
import { colourAesthetic, expr, layer } from './rplot.ts'

import type { Aesthetic, Geom, Layer, Plot, RFrame, Scale } from './rplot.ts'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type {
  ColorChannel,
  IdentityColorChannel,
} from '@jbrowse/display-kit/channelSpec'

/** The arm of a colour channel that binds a field, which `isIdentityColor` and the string arm leave. */
type FieldColor = Exclude<ColorChannel, string | IdentityColorChannel>

/** How many stops a continuous ramp hands ggplot's `gradientn`. */
const RAMP_STOPS = 16

function knownScheme(scheme: string | undefined) {
  return COLOR_SCHEMES.find((s): s is ColorSchemeName => s === scheme)
}

export interface MarkSpec {
  mark: MarkType
  linkShape?: LinkShape
  size?: number
  source?: string
  minBpPerPx?: number
  maxBpPerPx?: number
  encoding: {
    x?: string
    x2?: string
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
  marks: MarkSpec[]
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

function rampScale(color: FieldColor): Scale {
  const lut = rampLutOf({
    scheme: knownScheme(color.scheme),
    range: color.range,
    reverse: color.reverse,
  })
  return {
    kind: 'gradient',
    colours: stopsFromRampLut(lut, RAMP_STOPS).map(s => s.color),
    log: color.scale === 'log',
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

function thresholdScale(color: FieldColor): Scale {
  return {
    kind: 'steps',
    colours: color.range ?? [],
    breaks: (color.domain ?? []).map(Number),
    name: color.title,
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
) {
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
  if (isIdentityColor(color)) {
    return {
      field: color.value ?? 'color',
      scale: { kind: 'identity' } as Scale,
    }
  }
  const field = plainField(color.field)
  if (!field) {
    notes.push(`${aesthetic}: a jexl callback has no R counterpart`)
    return {}
  }
  const scale =
    color.scale === 'linear' || color.scale === 'log'
      ? rampScale(color)
      : color.scale === 'threshold'
        ? thresholdScale(color)
        : categoricalScale(color)
  return { field, scale }
}

function markAes(m: MarkSpec, origin: number) {
  const { x = 'start', x2, y, row, text } = m.encoding
  const band = row || 'row'
  switch (m.mark) {
    case 'bar':
      return {
        xmin: x,
        xmax: x2 ?? 'end',
        ymin: expr(String(origin)),
        ymax: y ?? 'score',
      }
    case 'span':
      return {
        xmin: x,
        xmax: x2 ?? 'end',
        ymin: band,
        ymax: expr(`${band} + 0.8`),
      }
    case 'point':
      return { x: midpoint(x, x2 ?? 'end'), y: y ?? 'score' }
    case 'text':
      return {
        x: midpoint(x, x2 ?? 'end'),
        y: y || band,
        label: text ?? 'name',
      }
    case 'link':
      return { x, xend: x2 ?? 'end', y: expr('0'), yend: expr('0') }
  }
}

function markParams(m: MarkSpec) {
  return m.mark === 'link'
    ? { curvature: m.linkShape === 'arc' ? -0.6 : -0.3 }
    : undefined
}

function markConstants(m: MarkSpec): Partial<Record<Aesthetic, number>> {
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
  m: MarkSpec,
  frame: RFrame,
  origin: number,
  notes: string[],
) {
  const geom = GEOM_OF[m.mark]
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
  if (m.encoding.shape) {
    notes.push('shape: the point symbol scale is not translated')
  }
  if (m.encoding.size?.field) {
    notes.push('size: a stroke-width scale is not translated')
  }
  const l = layer({
    geom,
    frame,
    aes: {
      ...markAes(m, origin),
      ...(colour.field ? { [colourAes]: colour.field } : {}),
    },
    constants: {
      ...markConstants(m),
      ...(colour.constant ? { [colourAes]: colour.constant } : {}),
    },
    params: markParams(m),
  })
  return { layer: l, scales }
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
  region,
}: {
  display: DisplaySpec
  frame: RFrame
  region?: { start: number; end: number }
}): TranslatedPlot {
  const notes: string[] = []
  const origin = display.origin ?? 0
  const layers: Layer[] = []
  const scales: Partial<Record<Aesthetic, Scale>> = {}
  for (const m of display.marks) {
    const built = markLayer(m, frame, origin, notes)
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
      xlim: region,
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

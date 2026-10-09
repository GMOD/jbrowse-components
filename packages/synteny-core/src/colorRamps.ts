import { readConfObject } from '@jbrowse/core/configuration'
import { categoricalColorScale } from '@jbrowse/core/ui/colors'
import { keyNames } from '@jbrowse/core/util/categoricalField'
import { colorRampStops, rampDomain } from '@jbrowse/core/util/colorRamp'
import {
  MEASURE_FIELD_PRESETS,
  withPreset,
} from '@jbrowse/core/util/colorScale'
import { formatScore } from '@jbrowse/core/util/numericUtils'
import {
  thresholdCuts,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { SCALE_TYPE_LINEAR, rampMidNorm } from '@jbrowse/render-core/scoreScale'

import { SYNTENY_VIEW_FIELDS } from './syntenyColorConfigSchema.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorRampStop } from '@jbrowse/core/util/colorRamp'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'

// How the synteny, dotplot, circular and multi-way views paint a number: a
// ramp or a threshold's bins, read off the color object through the presets
// and the resolver every display's color object goes through.

/**
 * #api
 * The fields every comparative view paints through a preset: core's
 * measurements, so `identity` and `mapq` paint here as they do on the MAF and
 * alignments displays.
 */
export const SYNTENY_FIELD_PRESETS = MEASURE_FIELD_PRESETS

export type SyntenyMeasureField = keyof typeof SYNTENY_FIELD_PRESETS

/**
 * #api
 * Whether `field` is a preset measurement. An own-property lookup: a field
 * spelled `toString` is a column nobody declared, not `Object`'s method.
 */
export function isMeasureField(field: string): field is SyntenyMeasureField {
  return Object.hasOwn(SYNTENY_FIELD_PRESETS, field)
}

/**
 * #api
 * The per-feature attribute a field reads: `mapq` is the comparative
 * adapters' `mappingQual`, and any other field its own name.
 */
export function attributeOf(field: string) {
  return field === 'mapq' ? 'mappingQual' : field
}

const STRUCTURAL_FIELDS: ReadonlySet<string> = new Set(SYNTENY_VIEW_FIELDS)

function formatOf(field: string) {
  return field === 'identity'
    ? (value: number) => `${formatScore(value * 100)}%`
    : formatScore
}

/**
 * The members of a color object a paint reads: all but the key's names,
 * heading and direction, so renaming a key repaints nothing.
 */
export interface SyntenyColorPaint {
  scale?: string
  domain?: readonly string[]
  range?: readonly string[]
  scheme?: ColorSchemeName
  reverse?: boolean
  domainMin?: number
  domainMax?: number
  domainMid?: number
}

/** Read off the paint's own slots, so a key-only edit repaints nothing. */
export function colorPaintOf(color: AnyConfigurationModel): SyntenyColorPaint {
  return {
    scale: readConfObject(color, 'scale'),
    domain: readConfObject(color, 'domain'),
    range: readConfObject(color, 'range'),
    scheme: readConfObject(color, 'scheme'),
    reverse: readConfObject(color, 'reverse'),
    domainMin: readConfObject(color, 'domainMin'),
    domainMax: readConfObject(color, 'domainMax'),
    domainMid: readConfObject(color, 'domainMid'),
  }
}

/**
 * A numeric field on a ramp: the attribute it reads, the ramp's stops, the
 * domain a value is read against and where the middle stop sits in it, and
 * the key's end labels.
 */
export interface ContinuousMode {
  scale: 'linear'
  attribute: string
  stops: readonly ColorRampStop[]
  /** domain bottom; 0 unless the mode says otherwise */
  minValue?: number
  maxValue: number
  /** where the ramp's middle stop sits in the normalized domain (`rampMidT`) */
  midNorm?: number
  minLabel: string
  maxLabel: string
}

/** A numeric field in bins: the cuts between them and each bin's color. */
export interface ThresholdMode {
  scale: 'threshold'
  attribute: string
  /** ascending */
  cuts: readonly number[]
  /** one per bin, lowest first */
  colors: readonly string[]
}

export type NumericMode = ContinuousMode | ThresholdMode

const MAX_STOP_TABLES = 32
const stopTables = new Map<string, readonly ColorRampStop[]>()

// The same stop list for the same declaration, so a LUT cached on the list
// is built once per ramp rather than once per recolor.
function stopsOf(ramp: {
  range?: readonly string[]
  scheme?: ColorSchemeName
  reverse?: boolean
}) {
  const key = `${ramp.scheme ?? ''}|${ramp.range?.join(' ') ?? ''}|${!!ramp.reverse}`
  let stops = stopTables.get(key)
  if (!stops) {
    if (stopTables.size >= MAX_STOP_TABLES) {
      stopTables.delete(stopTables.keys().next().value!)
    }
    stops = colorRampStops(ramp)
    stopTables.set(key, stops)
  }
  return stops
}

/** The observed span of one numeric attribute across the features in hand. */
export interface AttributeSpan {
  min: number
  max: number
  /** some row carried no number, so the missing-value color was painted */
  missing?: boolean
}

/**
 * The distinct labels of one text attribute, in first-seen order, plus any
 * color the file itself put beside a label (a `color` attribute on the same
 * row). A fetch's own list doubles as its dictionary: a feature's channel value
 * is an index into `labels`.
 */
export interface AttributeLabels {
  labels: string[]
  colors: Record<string, string>
  /** some row carried no label, so the unlabelled grey was painted */
  missing?: boolean
  /** the view's declared `color.domain`, which orders the labels and colors them */
  domain?: readonly string[]
  /** the view's declared `color.range`, the colors the domain takes in order */
  palette?: readonly string[]
  /** `labels` in first-seen order, where a declared domain sorted them */
  seen?: readonly string[]
}

export type AttributeRange = AttributeSpan | AttributeLabels

export function isAttributeLabels(
  range: AttributeRange,
): range is AttributeLabels {
  return 'labels' in range
}

export interface CategoricalMode {
  attribute: string
  labels: string[]
  /** the labels in the order the view first saw them, which deals their colors */
  seen: readonly string[]
  colors: Record<string, string>
  missing: boolean
  domain: readonly string[]
  palette: readonly string[]
}

/**
 * How a column carrying text paints: one color per distinct label, dealt in
 * the order the view first saw them under the declared domain and range, so
 * a label keeps its color as others arrive. Undefined for a field whose
 * values are numbers, a preset, or the constant.
 */
export function resolveCategoricalMode(
  field: string,
  ranges?: Record<string, AttributeRange>,
): CategoricalMode | undefined {
  const range = field ? ranges?.[field] : undefined
  return range && isAttributeLabels(range)
    ? {
        attribute: field,
        labels: range.labels,
        seen: range.seen ?? range.labels,
        colors: range.colors,
        missing: range.missing ?? false,
        domain: range.domain ?? [],
        palette: range.palette ?? [],
      }
    : undefined
}

const STRANDS = ['1', '-1'] as const

/**
 * #api
 * Each strand's color under `paint`, forward then reverse: the universal
 * strand preset's, or `range`'s in `domain` order where the color object
 * writes them, and the name `labels` gives it, if any.
 */
export function strandLevels(
  { domain = [], range = [] }: SyntenyColorPaint,
  labels: readonly string[] = [],
) {
  const filled = withPreset(
    { field: 'strand', scale: 'categorical', domain, range },
    SYNTENY_FIELD_PRESETS,
  )
  const color = categoricalColorScale(filled.domain, filled.range)
  const named = keyNames(filled.domain, labels)
  return STRANDS.map(value => ({
    value,
    color: color(value),
    label: named.get(value),
  }))
}

/**
 * #api
 * How a numeric field paints under `paint`: a preset measurement through its
 * preset, and a column a track declares on a viridis ramp over the span seen,
 * labelled with the actual numbers, the honest reading when nothing declares
 * what the column's range is supposed to be. A written `scale` names a ramp
 * or a threshold's bins either way. Undefined for the constant, a structural
 * field and a text column.
 */
export function resolveNumericMode(
  field: string,
  ranges: Record<string, AttributeRange> = {},
  paint: SyntenyColorPaint = {},
): NumericMode | undefined {
  if (!field || STRUCTURAL_FIELDS.has(field)) {
    return undefined
  }
  const attribute = attributeOf(field)
  const observed = ranges[attribute]
  const measure = isMeasureField(field)
  if (!measure && observed && isAttributeLabels(observed)) {
    return undefined
  }
  const written =
    paint.scale === 'linear' || paint.scale === 'threshold'
      ? paint.scale
      : undefined
  const encoding = colorEncodingOf(
    {
      ...paint,
      value: undefined,
      field,
      scale: written ?? (measure ? undefined : 'linear'),
      domain: paint.domain ?? [],
      range: paint.range ?? [],
    },
    SYNTENY_FIELD_PRESETS,
  )
  if (encoding?.scale === 'threshold') {
    const cuts = thresholdCuts(encoding.domain ?? [])
    return {
      scale: 'threshold',
      attribute,
      cuts,
      colors: thresholdPalette(cuts.length + 1, encoding.range),
    }
  }
  if (encoding?.scale !== 'linear') {
    return undefined
  }
  const span = observed && !isAttributeLabels(observed) ? observed : undefined
  const [minValue, maxValue] = rampDomain(
    encoding.domainMin,
    encoding.domainMax,
    [span?.min ?? 0, span?.max ?? 0],
  )
  const { domainMid } = encoding
  const format = formatOf(field)
  return {
    scale: 'linear',
    attribute,
    stops: stopsOf(encoding),
    minValue,
    maxValue,
    midNorm:
      domainMid === undefined
        ? undefined
        : rampMidNorm(minValue, maxValue, SCALE_TYPE_LINEAR, domainMid),
    minLabel: `${span && span.min < minValue ? '≤' : ''}${format(minValue)}`,
    maxLabel: `${span && span.max > maxValue ? '≥' : ''}${format(maxValue)}`,
  }
}

/**
 * A raw per-feature value in [0,1] ramp space, read linearly across the mode's
 * domain and clamped, so the linear-synteny LUT and the dotplot's per-feature
 * evaluation cannot answer it differently — the two views have already
 * disagreed once over MAPQ scaling.
 */
export function rampNorm(
  config: { minValue?: number; maxValue: number },
  value: number,
) {
  const lo = config.minValue ?? 0
  const span = config.maxValue - lo
  // a flat domain (one distinct value, or an attribute with no data) has no
  // gradient to place anything on; the ramp's bottom is the one safe answer
  return span > 0 ? Math.max(0, Math.min(1, (value - lo) / span)) : 0
}

/**
 * dN/dS for a link, from the two rates rather than a precomputed ratio: the
 * sources that carry this — Ensembl Compara's homology export, anything derived
 * from a codeml run — publish dN and dS separately, and both are worth having in
 * the detail panel on their own.
 *
 * NaN is "no answer", which is not 0: Compara leaves dS unestimated for a
 * distant pair, and a ratio of 0 reads as total purifying selection rather than
 * as a missing measurement. A dS at or below 0 is the same case — the ratio is
 * undefined, not infinite.
 *
 * Shared by the linear-synteny and dotplot workers so the two views cannot
 * disagree about which links have an answer.
 */
export function dnDsRatio(feature: { get: (key: string) => unknown }): number {
  const dn = feature.get('dn')
  const ds = feature.get('ds')
  return typeof dn === 'number' && typeof ds === 'number' && ds > 0 && dn >= 0
    ? dn / ds
    : Number.NaN
}

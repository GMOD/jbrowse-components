import { VIRIDIS_STOPS, colorRampStops } from '@jbrowse/core/util/colorRamp'
import { formatScore } from '@jbrowse/core/util/numericUtils'

import type { ColorRampStop } from '@jbrowse/core/util/colorRamp'

// The continuous "color by" ramps of the synteny, dotplot and multi-way views,
// which bake these stops into one LUT per ramp and sample it per feature. The
// stops are core's where the ramp is one of core's named ones, so a viridis
// here is the viridis every other display paints.

// ColorBrewer RdYlBu, reversed so low reads cool and high reads hot: the one
// diverging ramp here, its pale middle the pivot a diverging quantity is read
// against.
const RD_YL_BU_R: readonly ColorRampStop[] = [
  [69, 117, 180, 255],
  [116, 173, 209, 255],
  [171, 217, 233, 255],
  [224, 243, 248, 255],
  [255, 255, 191, 255],
  [254, 224, 144, 255],
  [253, 174, 97, 255],
  [244, 109, 67, 255],
  [215, 48, 39, 255],
]

/**
 * dN/dS is read against 1: below it a gene is under purifying selection, above
 * it under positive selection. The ramp spans 0 to 2, so 1 lands on its pale
 * middle, and anything at or above 2 takes its top: nearly every gene sits well
 * under 1, and a domain stretched to a few fast-evolving outliers would flatten
 * the rest into one blue.
 */
export const DNDS_MAX = 2

/**
 * A continuous colour field: which feature attribute it paints, the ramp's
 * stops, and the domain a raw value is read against.
 *
 * A value rather than a switch arm, so the field list does not grow by one
 * enum member, one menu entry, one legend arm, one LUT, one typed array and
 * one RPC transfer entry per measurement someone wants to see. A column nobody
 * anticipated is built from this same shape at read time.
 */
export interface ContinuousMode {
  /** the per-feature numeric attribute this reads */
  attribute: string
  stops: readonly ColorRampStop[]
  /** domain bottom; 0 unless the mode says otherwise */
  minValue?: number
  maxValue: number
  minLabel: string
  maxLabel: string
}

// The preset fields, keyed by the attribute each reads. Each carries domain
// knowledge a column name cannot: that identity is a fraction, that MAPQ tops
// out at minimap2's 60, that dN/dS is read against 1 rather than against its
// own maximum.
export const continuousRampConfig: Record<
  'identity' | 'mappingQual' | 'dnds',
  ContinuousMode
> = {
  identity: {
    attribute: 'identity',
    stops: VIRIDIS_STOPS,
    maxValue: 1,
    minLabel: '0%',
    maxLabel: '100%',
  },
  mappingQual: {
    attribute: 'mappingQual',
    stops: colorRampStops({ scheme: 'cividis' }),
    maxValue: 60,
    minLabel: '0',
    maxLabel: '60',
  },
  dnds: {
    attribute: 'dnds',
    stops: RD_YL_BU_R,
    maxValue: DNDS_MAX,
    minLabel: '0',
    maxLabel: '≥2',
  },
}

/**
 * #api
 * The preset ramp a field names, if it names one. An own-property lookup: a
 * field spelled `toString` is a column nobody declared, not `Object`'s method.
 */
export function presetRamp(field: string): ContinuousMode | undefined {
  return Object.hasOwn(continuousRampConfig, field)
    ? (continuousRampConfig as Record<string, ContinuousMode>)[field]
    : undefined
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
  /** the view's declared `colorBy.domain`, which orders the labels and colors them */
  domain?: readonly string[]
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
  colors: Record<string, string>
  missing: boolean
  domain: readonly string[]
}

/**
 * How a column carrying text paints: one color per distinct label, which
 * depends only on the label and the declared domain, so every window, session
 * and view agrees on it. Undefined for a field whose values are numbers, a
 * preset, or the constant.
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
        colors: range.colors,
        missing: range.missing ?? false,
        domain: range.domain ?? [],
      }
    : undefined
}

/**
 * How a numeric field paints: a preset's fixed ramp, or a viridis ramp over
 * the observed span of a declared column, labelled with the actual numbers —
 * a RELATIVE scale, the honest reading when nothing declares what the
 * column's range is supposed to be. Undefined for a text column and the
 * constant. A structural field (strand, query, track, ...) is the caller's
 * to dispatch before asking here.
 */
export function resolveContinuousMode(
  field: string,
  ranges?: Record<string, AttributeRange>,
): ContinuousMode | undefined {
  if (!field) {
    return undefined
  }
  const preset = presetRamp(field)
  if (preset) {
    return preset
  }
  const range = ranges?.[field]
  if (range && isAttributeLabels(range)) {
    return undefined
  }
  // no data yet, or a column nothing carried: a flat domain would divide by
  // zero, and rampNorm answers 0 for it, so the ribbons stay at the ramp's
  // bottom rather than painting garbage
  const min = range?.min ?? 0
  const max = range?.max ?? 0
  return {
    attribute: field,
    stops: VIRIDIS_STOPS,
    minValue: min,
    maxValue: max,
    minLabel: formatScore(min),
    maxLabel: formatScore(max),
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

import { TAG_FIELD_PREFIX, facetTag } from './groupByLabels.ts'

import type {
  BaseLayer,
  BaseLayerType,
  ColorBy,
  ColorSchemeType,
  ModificationColorBy,
  ReadColorBy,
  ReadColorSchemeType,
} from './types.ts'

export const ALIGNMENTS_COLOR_SCALES = [
  'none',
  'categorical',
  'linear',
  'threshold',
] as const
export type AlignmentsColorScale = (typeof ALIGNMENTS_COLOR_SCALES)[number]

/** The ramp an empty `ramp` paints. */
export const DEFAULT_RAMP = 'viridis'

/** The `color` object as written on an alignments display. */
export interface AlignmentsColorSetting {
  value: string | undefined
  field: string
  scale: AlignmentsColorScale | undefined
  domain: readonly string[]
  palette: readonly string[]
  ramp: readonly string[]
  domainMid: number | undefined
}

type PresetScheme = Exclude<ReadColorSchemeType, 'normal' | 'tag'>

/**
 * The read fields with a vocabulary or ramp of their own. The read dimensions
 * share the facet's names, so `facet` and `color` over one variable are one
 * word.
 */
export const COLOR_FIELDS: Record<PresetScheme, string> = {
  strand: 'strand',
  mappingQuality: 'mapq',
  insertSize: 'insertSize',
  firstOfPairStrand: 'firstOfPairStrand',
  pairOrientation: 'pairOrientation',
  insertSizeAndOrientation: 'insertSizeAndOrientation',
  mateRefName: 'mateRefName',
}

/** The per-base variables `baseColor` paints a cell per base from. */
export const BASE_COLOR_FIELDS: Record<BaseLayerType, string> = {
  perBaseQuality: 'baseQuality',
  perBaseLetter: 'base',
  modifications: 'modifications',
  bisulfite: 'bisulfite',
}

const SCHEME_OF_FIELD = new Map(
  Object.entries(COLOR_FIELDS).map(([scheme, field]) => [
    field,
    scheme as PresetScheme,
  ]),
)

const LAYER_OF_FIELD = new Map(
  Object.entries(BASE_COLOR_FIELDS).map(([layer, field]) => [
    field,
    layer as BaseLayerType,
  ]),
)

const READS_MODIFICATION_SETTINGS = new Set<BaseLayerType>([
  'modifications',
  'bisulfite',
])

/** The field a read scheme paints, `''` for the plain fill. */
export function colorFieldOf(colorBy: ColorBy) {
  return colorBy.type === 'tag'
    ? colorBy.tag
      ? `${TAG_FIELD_PREFIX}${colorBy.tag}`
      : (colorBy.attribute ?? '')
    : (Object.entries(COLOR_FIELDS).find(([k]) => k === colorBy.type)?.[1] ??
        '')
}

/**
 * The read scheme a `color` object selects: a preset field its own scheme,
 * `tags.XX` the tag scheme, any other name a feature attribute through the
 * same per-read bake. A field under `none`, or a per-base variable, which
 * `baseColor` draws, paints the plain fill.
 */
export function colorByOf({
  field,
  scale,
}: Pick<AlignmentsColorSetting, 'field' | 'scale'>): ReadColorBy {
  if (!field || scale === 'none' || LAYER_OF_FIELD.has(field)) {
    return { type: 'normal' }
  }
  const scheme = SCHEME_OF_FIELD.get(field)
  if (scheme) {
    return { type: scheme }
  }
  const tag = facetTag(field)
  return tag ? { type: 'tag', tag } : { type: 'tag', attribute: field }
}

/** The `baseColor` object as written. */
export interface BaseColorSetting {
  field: string | undefined
  scale: 'none' | undefined
}

/**
 * The per-base layer a `baseColor` object selects, with the settings the
 * modification fields read beside it. Undefined while no per-base field is
 * named, or one waits under `none`.
 */
export function baseLayerOf(
  { field, scale }: BaseColorSetting,
  modifications?: ModificationColorBy,
): BaseLayer | undefined {
  const type =
    scale === 'none' || field === undefined
      ? undefined
      : LAYER_OF_FIELD.get(field)
  return type === undefined
    ? undefined
    : READS_MODIFICATION_SETTINGS.has(type) && modifications
      ? { type, modifications }
      : { type }
}

/**
 * What the read body paints as: the read scheme, or under the plain fill the
 * modification layer's own body, a pale strand tint the marks read against.
 */
export function bodyColorScheme(
  colorBy: ReadColorBy,
  baseLayer: BaseLayer | undefined,
): ColorSchemeType {
  return colorBy.type === 'normal' &&
    baseLayer &&
    READS_MODIFICATION_SETTINGS.has(baseLayer.type)
    ? baseLayer.type
    : colorBy.type
}

/**
 * The scale a tag or attribute field paints through: the written `scale`, or
 * unset, `linear` beside a `ramp` and `categorical` without, as on the mark
 * display's colour.
 */
export function bakedScaleOf({
  scale,
  ramp,
}: Pick<AlignmentsColorSetting, 'scale' | 'ramp'>) {
  return scale ?? (ramp.length > 0 ? 'linear' : 'categorical')
}

/** Whether the main thread bakes a colour per read from a value the worker ships. */
export function isBakedScheme(colorBy: ColorBy) {
  return (
    colorBy.type === 'mateRefName' ||
    (colorBy.type === 'tag' && !!(colorBy.tag ?? colorBy.attribute))
  )
}

/**
 * The `color` object a scheme pick writes. The plain fill keeps the field
 * under `none` for the way back, with the default ramp written out where a
 * linear scale painted it, and a field re-picked keeps its order, palette and
 * ramp, so its unset scale reads linear again beside the ramp; a new field
 * starts from none of them.
 */
export function colorSnapshotFor(
  colorBy: ColorBy,
  current: AlignmentsColorSetting,
): Partial<AlignmentsColorSetting> {
  const field = colorFieldOf(colorBy)
  const kept = Object.fromEntries(
    Object.entries(current).filter(([, v]) => v !== undefined),
  )
  return field === ''
    ? current.field
      ? {
          ...kept,
          scale: 'none',
          ...(current.scale === 'linear' && current.ramp.length === 0
            ? { ramp: [DEFAULT_RAMP] }
            : {}),
        }
      : kept
    : field === current.field
      ? { ...kept, scale: current.scale === 'none' ? undefined : current.scale }
      : current.value === undefined
        ? { field }
        : { value: current.value, field }
}

const INSERT_SIZE_FIELDS = new Set([
  COLOR_FIELDS.insertSize,
  COLOR_FIELDS.insertSizeAndOrientation,
])

/**
 * The short/long cut points an insert-size field's `domain` pins, in place of
 * the band sampled from the reads. Undefined unless it lists two ascending
 * numbers.
 *
 * Insert size stays a threshold scale. A gradient from the neutral toward each
 * endpoint by severity shipped once (`insertSizeGradient`) and was retired:
 * two half-ramped reads on opposite sides of the band both came out faintly
 * tinted grey, closest exactly where a deletion signature has to be told from
 * an insertion one.
 */
export function pinnedInsertSizeBand({
  field,
  scale,
  domain,
}: Pick<AlignmentsColorSetting, 'field' | 'scale' | 'domain'>) {
  const [lower, upper] = domain.map(Number)
  return INSERT_SIZE_FIELDS.has(field) &&
    scale !== 'none' &&
    domain.length === 2 &&
    lower !== undefined &&
    upper !== undefined &&
    lower < upper
    ? { lower, upper }
    : undefined
}

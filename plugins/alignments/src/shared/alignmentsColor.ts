import { thresholdCuts } from '@jbrowse/core/util/thresholdScale'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'

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
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

export const ALIGNMENTS_COLOR_SCALES = [
  'none',
  'categorical',
  'linear',
  'threshold',
] as const
export type AlignmentsColorScale = (typeof ALIGNMENTS_COLOR_SCALES)[number]

/** The `color` object as written on an alignments display. */
export interface AlignmentsColorSetting extends ColorSetting {
  scale: AlignmentsColorScale | undefined
  scheme: ColorSchemeName | undefined
  reverse: boolean
  domainMin: number | undefined
  domainMax: number | undefined
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

const INSERT_SIZE_FIELDS = new Set([
  COLOR_FIELDS.insertSize,
  COLOR_FIELDS.insertSizeAndOrientation,
])

/**
 * The `color` object as it paints. Unset beside a field, the scale follows the
 * field: an insert-size field is a threshold, whose `domain` is the cuts
 * between short, normal and long, and any other field is categorical.
 */
export function alignmentsColorEncoding(setting: AlignmentsColorSetting) {
  return colorEncodingOf(
    setting,
    INSERT_SIZE_FIELDS.has(setting.field) ? 'threshold' : 'categorical',
  )
}

export type AlignmentsColorEncoding = ReturnType<typeof alignmentsColorEncoding>

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
 * The read scheme a resolved `color` selects: a preset field its own scheme,
 * `tags.XX` the tag scheme, any other name a feature attribute through the
 * same per-read bake. A constant, or a per-base variable, which `baseColor`
 * draws, paints the plain fill.
 */
export function colorByOf(encoding: AlignmentsColorEncoding): ReadColorBy {
  if (typeof encoding !== 'object' || LAYER_OF_FIELD.has(encoding.field)) {
    return { type: 'normal' }
  }
  const { field } = encoding
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
  { field = '', scale }: BaseColorSetting,
  modifications?: ModificationColorBy,
): BaseLayer | undefined {
  const encoding = colorEncodingOf(
    { value: undefined, field, scale, domain: [], range: [] },
    'categorical',
  )
  const type =
    typeof encoding === 'object'
      ? LAYER_OF_FIELD.get(encoding.field)
      : undefined
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

/** Whether the main thread bakes a colour per read from a value the worker ships. */
export function isBakedScheme(colorBy: ColorBy) {
  return (
    colorBy.type === 'mateRefName' ||
    (colorBy.type === 'tag' && !!(colorBy.tag ?? colorBy.attribute))
  )
}

/**
 * The `color` object a scheme pick writes. The plain fill keeps the field
 * under `none` for the way back, and a field re-picked keeps its order, range
 * and ends; a new field starts from none of them. A re-picked field paints
 * through its own default scale: `none` and a declared `linear` or `threshold`
 * share the one `scale` slot, so the plain fill cannot keep the kind.
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
      ? { ...kept, scale: 'none' }
      : kept
    : field === current.field
      ? { ...kept, scale: current.scale === 'none' ? undefined : current.scale }
      : current.value === undefined
        ? { field }
        : { value: current.value, field }
}

/**
 * The short/long cut points an insert-size field's threshold pins, in place of
 * the band sampled from the reads. Undefined unless its `domain` names two
 * distinct numbers.
 *
 * Insert size stays a threshold scale. A gradient from the neutral toward each
 * endpoint by severity shipped once (`insertSizeGradient`) and was retired:
 * two half-ramped reads on opposite sides of the band both came out faintly
 * tinted grey, closest exactly where a deletion signature has to be told from
 * an insertion one.
 */
export function pinnedInsertSizeBand(encoding: AlignmentsColorEncoding) {
  if (
    typeof encoding !== 'object' ||
    encoding.scale !== 'threshold' ||
    !INSERT_SIZE_FIELDS.has(encoding.field)
  ) {
    return undefined
  }
  const cuts = thresholdCuts(encoding.domain ?? [])
  const [lower, upper] = cuts
  return cuts.length === 2 &&
    lower !== undefined &&
    upper !== undefined &&
    lower < upper
    ? { lower, upper }
    : undefined
}

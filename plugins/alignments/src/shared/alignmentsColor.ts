import { keyNames } from '@jbrowse/core/util/categoricalField'
import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'
import {
  MEASURE_FIELD_PRESETS,
  withImpliedField,
} from '@jbrowse/core/util/colorScale'
import {
  thresholdCuts,
  thresholdLabels,
} from '@jbrowse/core/util/thresholdScale'
import {
  colorEncodingOf,
  colorForField,
  colorSettingOf,
  colorSnapshotOf,
  definedColor,
  impliedFieldOf,
} from '@jbrowse/display-kit/colorConfigSchema'

import { COLOR_SCHEMES } from './colorSchemes.ts'
import { TAG_FIELD_PREFIX, fieldTag } from './facetLabels.ts'
import {
  INSERT_SIZE_LEVELS,
  MAPQ_UNAVAILABLE_LEVEL,
  PAIR_ORIENTATION_LEVELS,
} from './readFieldLevels.ts'
import {
  BASE_COLOR_FIELDS,
  COLOR_FIELDS,
  FACET_ONLY_DIMENSIONS,
} from './types.ts'

import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { RGBColor } from '../shaders/colors.ts'
import type {
  BaseLayer,
  BaseLayerType,
  ColorBy,
  ColorSchemeType,
  ModificationColorBy,
  ReadColorBy,
  ReadColorSchemeType,
  TagColorScale,
} from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  ColorSlots,
  FieldPreset,
  FieldPresets,
} from '@jbrowse/core/util/colorScale'
import type {
  ColorScaleSetting,
  ColorSetting,
} from '@jbrowse/display-kit/colorConfigSchema'

export const ALIGNMENTS_COLOR_SCALES = [
  'ordinal',
  'linear',
  'threshold',
] as const
export type AlignmentsColorScale = (typeof ALIGNMENTS_COLOR_SCALES)[number]

/** The `encoding.color` channel as written on an alignments display. */
export interface AlignmentsColorSetting extends ColorSetting {
  scale: ColorScaleSetting & { type: AlignmentsColorScale | undefined }
}

/**
 * The `encoding.color` channel's painted members, with the schema's
 * `impliedField` where it names neither a field nor a constant
 * (LGVSyntenyColor's `strand`).
 */
export function alignmentsColorSettingOf(
  color: AnyConfigurationModel,
): AlignmentsColorSetting {
  return withImpliedField(
    colorSettingOf(color) as AlignmentsColorSetting,
    impliedFieldOf(color),
  )
}

/** {@link alignmentsColorSettingOf} with the key's `scale.names` and `legend`. */
export function alignmentsColorSnapshotOf(
  color: AnyConfigurationModel,
): AlignmentsColorSetting {
  return withImpliedField(
    colorSnapshotOf(color) as AlignmentsColorSetting,
    impliedFieldOf(color),
  )
}

export { BASE_COLOR_FIELDS, COLOR_FIELDS }

type PresetScheme = (typeof COLOR_FIELDS)[number]

function isPresetField(field: string): field is PresetScheme {
  const fields: readonly string[] = COLOR_FIELDS
  return fields.includes(field)
}

/** The per-base layer `field` draws, if it names one. */
export function baseLayerOfField(field: string) {
  const fields: readonly string[] = BASE_COLOR_FIELDS
  return fields.includes(field) ? (field as BaseLayerType) : undefined
}

const FACET_ONLY_FIELDS = new Set<string>(FACET_ONLY_DIMENSIONS)

const READS_MODIFICATION_SETTINGS = new Set<BaseLayerType>([
  'modifications',
  'bisulfite',
])

const INSERT_SIZE_FIELDS = new Set<string>([
  'insertSize',
  'insertSizeAndOrientation',
])

/**
 * The `encoding.color` channel as it paints. While `scale.type` is unset the
 * field picks it: an insert-size field is a threshold, whose `scale.domain` is
 * the cuts between short, normal and long, and any other field is ordinal.
 */
export function alignmentsColorEncoding(setting: AlignmentsColorSetting) {
  return colorEncodingOf(setting, ALIGNMENTS_FIELD_PRESETS)
}

/**
 * What the `encoding.color` channel says beside the schema's rules that the
 * reads cannot paint as written: a per-base field, which `pileup.bases`
 * paints, or levels its field does not have.
 */
export function alignmentsColorProblems(setting: AlignmentsColorSetting) {
  const encoding = alignmentsColorEncoding(setting)
  if (typeof encoding !== 'object') {
    return []
  }
  const { field } = encoding
  return baseLayerOfField(field)
    ? [
        `encoding.color.field: ${field} is drawn a cell per base, which pileup.bases paints over the reads`,
      ]
    : FACET_ONLY_FIELDS.has(field)
      ? [
          `encoding.color.field: ${field} colors nothing, since reads keep their arcs' colors; facet: "${field}" sections the reads by it`,
        ]
      : levelNotices(encoding)
}

export type AlignmentsColorEncoding = ReturnType<typeof alignmentsColorEncoding>

/** The field a read scheme paints, `''` for the plain fill. */
export function colorFieldOf(colorBy: ColorBy) {
  return colorBy.type === 'tag'
    ? colorBy.tag
      ? `${TAG_FIELD_PREFIX}${colorBy.tag}`
      : (colorBy.attribute ?? '')
    : colorBy.type === 'normal'
      ? ''
      : colorBy.type
}

/**
 * The read scheme a resolved `encoding.color` selects: a preset field its own
 * scheme, `tags.XX` the tag scheme, any other name a feature attribute through
 * the same per-read bake. A constant, a per-base variable, which `pileup.bases`
 * draws, or a read category only a facet answers paints the plain fill.
 */
export function colorByOf(encoding: AlignmentsColorEncoding): ReadColorBy {
  if (
    typeof encoding !== 'object' ||
    baseLayerOfField(encoding.field) ||
    FACET_ONLY_FIELDS.has(encoding.field)
  ) {
    return { type: 'normal' }
  }
  const { field } = encoding
  if (isPresetField(field)) {
    return { type: field }
  }
  const tag = fieldTag(field)
  return tag ? { type: 'tag', tag } : { type: 'tag', attribute: field }
}

/**
 * The per-base layer `pileup.bases` draws, with the settings the modification
 * fields read beside it. Undefined while it is hidden or names no field.
 */
export function baseLayerOf(
  { show, field }: { show: boolean; field: string },
  modifications?: ModificationColorBy,
): BaseLayer | undefined {
  const type = show ? baseLayerOfField(field) : undefined
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
 * Whether the main thread bakes a color per read through the `encoding.color`
 * scale:
 * from a value the worker ships, or from the read's MAPQ.
 */
export function isBakedScheme(colorBy: ColorBy) {
  return (
    colorBy.type === 'mapq' ||
    colorBy.type === 'mateRefName' ||
    (colorBy.type === 'tag' && !!(colorBy.tag ?? colorBy.attribute))
  )
}

type ReadColorLevel = readonly [value: string, category: ReadColorCategory]

const INSERT_SIZE_CATEGORY = {
  short: 'shortInsert',
  normal: 'normalInsert',
  long: 'longInsert',
} as const satisfies Record<
  (typeof INSERT_SIZE_LEVELS)[number],
  ReadColorCategory
>

const INSERT_SIZE_COLOR_LEVELS: readonly ReadColorLevel[] =
  INSERT_SIZE_LEVELS.map(value => [value, INSERT_SIZE_CATEGORY[value]])

const PAIR_COLOR_LEVELS: readonly ReadColorLevel[] =
  PAIR_ORIENTATION_LEVELS.map(dir => [dir, `pair${dir}`])

const STRAND_LEVELS: readonly ReadColorLevel[] = [
  ['1', 'fwdStrand'],
  ['-1', 'revStrand'],
]

const NO_VALUE_LEVEL: ReadColorLevel = ['', 'noTagValue']

// The levels a mate-aware field paints that no facet section shares: a mate
// with no placement or on another chromosome, and in a chain a split mate's
// junction and an unpaired segment's strand against its molecule's.
const MATE_LEVELS: readonly ReadColorLevel[] = [
  ['unmappedMate', 'unmappedMate'],
  ['interchrom', 'interchrom'],
]

const CHAIN_LEVELS: readonly ReadColorLevel[] = [
  ['splitInverted', 'splitInversion'],
  ['splitSameStrand', 'splitDeletion'],
  ['segmentInverted', 'revStrand'],
  ['segmentSameStrand', 'fwdStrand'],
]

/**
 * Each read scheme's levels, by the value a `domain` names them with, in the
 * order a `range` beside no `domain` colors them. `''` is a read with no
 * value for the field.
 */
const READ_COLOR_LEVELS: Record<
  ReadColorSchemeType,
  readonly ReadColorLevel[]
> = {
  normal: [],
  strand: STRAND_LEVELS,
  firstOfPairStrand: STRAND_LEVELS,
  pairOrientation: [...PAIR_COLOR_LEVELS, ['', 'noOrientation']],
  insertSize: INSERT_SIZE_COLOR_LEVELS,
  // an LR pair of normal size is the normal insert
  insertSizeAndOrientation: [
    ...INSERT_SIZE_COLOR_LEVELS,
    ...PAIR_COLOR_LEVELS.filter(([dir]) => dir !== 'LR'),
  ],
  mapq: [[MAPQ_UNAVAILABLE_LEVEL, 'mapqUnavailable']],
  mateRefName: [NO_VALUE_LEVEL],
  tag: [NO_VALUE_LEVEL],
}

/**
 * Every level a field paints: the levels its facet sections share, then the
 * mate and chain levels a mate-aware field adds, so a `scale.domain`,
 * `scale.range` or `scale.names` reaches every color on screen.
 */
function paintedLevels(type: ReadColorSchemeType): readonly ReadColorLevel[] {
  const { mateAware, orientation } = COLOR_SCHEMES[type]
  return [
    ...READ_COLOR_LEVELS[type],
    ...(mateAware ? MATE_LEVELS : []),
    ...(orientation ? CHAIN_LEVELS : []),
  ]
}

const LEVEL_KEYS = new Map(
  Object.entries(READ_COLOR_LEVELS).map(([type, levels]) => [
    type,
    Object.fromEntries(
      levels.map(([value, category]) => [category, value]),
    ) as Partial<Record<ReadColorCategory, string>>,
  ]),
)

/**
 * The value each of a field's read buckets names, which is also the key of
 * the section a facet over that field files the bucket's reads under.
 */
export function levelKeysOf(type: ColorSchemeType) {
  return LEVEL_KEYS.get(type)
}

/**
 * What each field paints through while `scale.type` is unset: an insert-size
 * field a threshold, and any other field ordinal, a preset scheme's field over
 * its own levels, which `scale.range` and `scale.names` then index while
 * `scale.domain` is unwritten.
 */
export const ALIGNMENTS_FIELD_PRESETS: FieldPresets = {
  ...Object.fromEntries(
    COLOR_FIELDS.map((field): [string, FieldPreset] => [
      field,
      INSERT_SIZE_FIELDS.has(field)
        ? { scale: { type: 'threshold' } }
        : isBakedScheme({ type: field })
          ? { scale: { type: 'ordinal' } }
          : {
              scale: {
                type: 'ordinal',
                domain: paintedLevels(field).map(([value]) => value),
              },
            },
    ]),
  ),
  mapq: MEASURE_FIELD_PRESETS.mapq,
  '*': { scale: { type: 'ordinal' } },
}

/** The schemes whose levels are their whole vocabulary, so a `domain` names them. */
const LEVEL_SCHEMES = new Set<ReadColorSchemeType>([
  'strand',
  'firstOfPairStrand',
  'pairOrientation',
  'insertSize',
  'insertSizeAndOrientation',
])

function levelNotices(encoding: AlignmentsColorEncoding): string[] {
  if (typeof encoding !== 'object') {
    return []
  }
  const { type } = colorByOf(encoding)
  if (!LEVEL_SCHEMES.has(type)) {
    return []
  }
  const levels = paintedLevels(type).map(([value]) => value)
  const named = levels.filter(level => level !== '').join(', ')
  if (encoding.scale === 'threshold') {
    return Array.from(encoding.domain ?? [], String).some(value =>
      levels.includes(value),
    )
      ? [
          `encoding.color.scale.domain: names a level of ${encoding.field} (${named}), which a threshold scale reads as a cut point; scale.type: "ordinal" colors the levels`,
        ]
      : []
  }
  if (encoding.scale !== 'ordinal') {
    return []
  }
  return Array.from(encoding.domain ?? [], String)
    .filter(value => !levels.includes(value))
    .map(
      value =>
        `encoding.color.scale.domain: "${value}" names no level of ${encoding.field}, whose levels are ${named}`,
    )
}

function declaredOrder(
  encoding: Exclude<AlignmentsColorEncoding, string | undefined>,
  levels: readonly ReadColorLevel[],
  bakesValues: boolean,
) {
  if (encoding.scale === 'threshold') {
    return INSERT_SIZE_FIELDS.has(encoding.field) ? INSERT_SIZE_LEVELS : []
  }
  if (encoding.scale !== 'ordinal') {
    return []
  }
  return (
    encoding.domain?.map(String) ??
    (bakesValues ? [] : levels.map(([value]) => value))
  )
}

// The levels `scale.range` and `scale.names` index, in their order, and the
// read bucket each one is: the levels `scale.domain` names, or with none the
// field's own,
// and a threshold over an insert-size field its short, normal and long bins.
function declaredLevels(
  encoding: Exclude<AlignmentsColorEncoding, string | undefined>,
) {
  const colorBy = colorByOf(encoding)
  const levels = paintedLevels(colorBy.type)
  return {
    order: declaredOrder(encoding, levels, isBakedScheme(colorBy)),
    categoryOf: new Map(levels),
  }
}

function filled(
  color: string | undefined,
  categories: readonly ReadColorCategory[],
) {
  const rgb = color ? cssColorToNormalizedRgb(color) : undefined
  return rgb ? Object.fromEntries(categories.map(c => [c, rgb])) : {}
}

/**
 * The read category colors the `encoding.color` channel sets over the
 * palette's: `value` fills a read no field colors, `scale.invalid` one its tag
 * or mate scheme found no value for, before its bake too, and
 * `declaredReadCategoryColors` goes over both.
 */
export function writtenReadCategoryColors(
  { value, scale }: Pick<ColorSetting, 'value' | 'scale'>,
  encoding: AlignmentsColorEncoding,
): Partial<Record<ReadColorCategory, RGBColor>> {
  return {
    ...filled(value, ['plain']),
    ...filled(scale.invalid, ['tag', 'noTagValue']),
    ...declaredReadCategoryColors(encoding),
  }
}

/**
 * The read category colors the `encoding.color` channel declares, over the
 * palette's defaults: `scale.range[i]` colors the i-th of `declaredLevels`. A
 * level left out keeps its default.
 */
export function declaredReadCategoryColors(
  encoding: AlignmentsColorEncoding,
): Partial<Record<ReadColorCategory, RGBColor>> {
  if (typeof encoding !== 'object' || !encoding.range) {
    return {}
  }
  const { range } = encoding
  const { order, categoryOf } = declaredLevels(encoding)
  const colors: Partial<Record<ReadColorCategory, RGBColor>> = {}
  order.forEach((value, i) => {
    const category = categoryOf.get(value)
    const color = range[i]
    if (category && color !== undefined && !(category in colors)) {
      colors[category] = cssColorToNormalizedRgb(color)
    }
  })
  return colors
}

/** What `encoding.color.scale.names` names: read buckets, and a baked scheme's values. */
export interface DeclaredReadLabels {
  categories: Partial<Record<ReadColorCategory, string>>
  // a tag or mate value by the value, or a threshold bin by its interval
  values: ReadonlyMap<string, string>
}

/**
 * `scale.names` against the levels and values it names, in the order
 * `scale.range` colors them: `names[i]` names the i-th of `declaredLevels`,
 * and under a baked scheme the i-th `scale.domain` value, or a threshold's
 * i-th bin. Read apart from the encoding, so a renamed key entry re-bakes no
 * read.
 */
export function declaredReadLabels(
  encoding: AlignmentsColorEncoding,
  written: readonly string[],
): DeclaredReadLabels {
  const preset =
    typeof encoding === 'object' && 'names' in encoding
      ? encoding.names
      : undefined
  const labels = written.length > 0 ? written : (preset ?? written)
  if (typeof encoding !== 'object' || labels.length === 0) {
    return { categories: {}, values: new Map() }
  }
  const { order, categoryOf } = declaredLevels(encoding)
  const categories: Partial<Record<ReadColorCategory, string>> = {}
  for (const [value, name] of keyNames(order, labels)) {
    const category = categoryOf.get(value)
    if (category) {
      categories[category] ??= name
    }
  }
  return {
    categories,
    values: isBakedScheme(colorByOf(encoding))
      ? keyNames(bakedKeys(encoding), labels)
      : new Map(),
  }
}

function bakedKeys(
  encoding: Exclude<AlignmentsColorEncoding, string | undefined>,
) {
  return encoding.scale === 'threshold'
    ? thresholdLabels(thresholdCuts(encoding.domain ?? []))
    : encoding.scale === 'ordinal'
      ? (encoding.domain ?? [])
      : []
}

/**
 * The `encoding.color` channel the Tag dialog writes over `current`: the tag's
 * field as a Color by pick writes it, `parked` included, on a ramp under
 * `linear` and a color per value otherwise.
 */
export function tagColorFor(
  current: ColorSlots,
  tag: string,
  scale: TagColorScale,
  parked?: ColorSlots,
): ColorSlots {
  const picked = colorForField(current, `${TAG_FIELD_PREFIX}${tag}`, parked)
  return definedColor({
    ...picked,
    scale: { ...picked.scale, type: scale === 'linear' ? 'linear' : undefined },
  })
}

/**
 * The short/long cut points an insert-size field's threshold pins, in place of
 * the band sampled from the reads. Undefined unless its `scale.domain` names
 * two distinct numbers.
 *
 * Insert size stays a threshold scale. A gradient from the neutral toward each
 * endpoint by severity was tried in the v5 betas (`insertSizeGradient`):
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

import { keyNames } from '@jbrowse/core/util/categoricalField'
import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'
import {
  thresholdCuts,
  thresholdLabels,
} from '@jbrowse/core/util/thresholdScale'
import {
  colorEncodingOf,
  colorForField,
} from '@jbrowse/display-kit/colorConfigSchema'
import { colorNotices } from '@jbrowse/display-kit/colorScale'

import { TAG_FIELD_PREFIX, facetTag } from './groupByLabels.ts'
import { MAPQ_UNAVAILABLE } from './util.ts'

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
} from './types.ts'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { FieldPresets } from '@jbrowse/display-kit/colorScale'

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
  return colorEncodingOf(setting, ALIGNMENTS_FIELD_PRESETS)
}

/** What the `color` object's slots say together that it cannot paint as written. */
export function alignmentsColorNotices(setting: AlignmentsColorSetting) {
  return [
    ...colorNotices(setting, ALIGNMENTS_FIELD_PRESETS),
    ...levelNotices(alignmentsColorEncoding(setting)),
  ]
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
  const encoding = colorEncodingOf({
    value: undefined,
    field,
    scale,
    domain: [],
    range: [],
  })
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

type ReadColorLevel = readonly [value: string, category: ReadColorCategory]

const INSERT_SIZE_LEVELS: readonly ReadColorLevel[] = [
  ['short', 'shortInsert'],
  ['normal', 'normalInsert'],
  ['long', 'longInsert'],
]

const STRAND_LEVELS: readonly ReadColorLevel[] = [
  ['1', 'fwdStrand'],
  ['-1', 'revStrand'],
]

const NO_VALUE_LEVEL: ReadColorLevel = ['', 'noTagValue']

/**
 * Each read scheme's levels, by the value a `domain` names them with, in the
 * order a `range` beside no `domain` colours them. `''` is a read with no
 * value for the field.
 */
const READ_COLOR_LEVELS: Record<
  ReadColorSchemeType,
  readonly ReadColorLevel[]
> = {
  normal: [],
  strand: STRAND_LEVELS,
  firstOfPairStrand: STRAND_LEVELS,
  pairOrientation: [
    ['LR', 'pairLR'],
    ['RL', 'pairRL'],
    ['RR', 'pairRR'],
    ['LL', 'pairLL'],
    ['', 'nonSplit'],
  ],
  insertSize: INSERT_SIZE_LEVELS,
  insertSizeAndOrientation: [
    ...INSERT_SIZE_LEVELS,
    ['RL', 'pairRL'],
    ['RR', 'pairRR'],
    ['LL', 'pairLL'],
  ],
  mappingQuality: [[`${MAPQ_UNAVAILABLE}`, 'mapqUnavailable']],
  mateRefName: [NO_VALUE_LEVEL],
  tag: [NO_VALUE_LEVEL],
}

/**
 * What each field paints through while `scale` is unset: an insert-size field
 * a threshold, and any other field categorical, a preset scheme's field over
 * its own levels, which `range` and `labels` then index while `domain` is
 * unwritten.
 */
export const ALIGNMENTS_FIELD_PRESETS = {
  ...Object.fromEntries(
    Object.entries(COLOR_FIELDS).map(([scheme, field]) => [
      field,
      INSERT_SIZE_FIELDS.has(field)
        ? { scale: 'threshold' }
        : isBakedScheme({ type: scheme as PresetScheme })
          ? { scale: 'categorical' }
          : {
              scale: 'categorical',
              domain: READ_COLOR_LEVELS[scheme as PresetScheme].map(
                ([value]) => value,
              ),
            },
    ]),
  ),
  '*': { scale: 'categorical' },
} satisfies FieldPresets

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
  const levels = READ_COLOR_LEVELS[type].map(([value]) => value)
  const named = levels.filter(level => level !== '').join(', ')
  if (encoding.scale === 'threshold') {
    return Array.from(encoding.domain ?? [], String).some(value =>
      levels.includes(value),
    )
      ? [
          `color.domain: names a level of ${encoding.field} (${named}), which a threshold scale reads as a cut point; scale: "categorical" colours the levels`,
        ]
      : []
  }
  if (encoding.scale !== 'categorical') {
    return []
  }
  return Array.from(encoding.domain ?? [], String)
    .filter(value => !levels.includes(value))
    .map(
      value =>
        `color.domain: "${value}" names no level of ${encoding.field}, whose levels are ${named}`,
    )
}

function levelOrder(
  encoding: Exclude<AlignmentsColorEncoding, string | undefined>,
  levels: readonly ReadColorLevel[],
  bakesValues: boolean,
) {
  if (encoding.scale === 'threshold') {
    return INSERT_SIZE_FIELDS.has(encoding.field)
      ? INSERT_SIZE_LEVELS.map(([value]) => value)
      : []
  }
  if (encoding.scale !== 'categorical') {
    return []
  }
  return (
    encoding.domain?.map(String) ??
    (bakesValues ? [] : levels.map(([value]) => value))
  )
}

// The levels `range` and `labels` index, in their order, and the read bucket
// each one is: the levels `domain` names, or with no `domain` the field's own,
// and a threshold over an insert-size field its short, normal and long bins.
function declaredLevels(
  encoding: Exclude<AlignmentsColorEncoding, string | undefined>,
) {
  const colorBy = colorByOf(encoding)
  const levels = READ_COLOR_LEVELS[colorBy.type]
  return {
    order: levelOrder(encoding, levels, isBakedScheme(colorBy)),
    categoryOf: new Map(levels),
  }
}

const VALUE_FILLED: readonly ReadColorCategory[] = [
  'plain',
  'tag',
  'noTagValue',
]

/**
 * The read category colours the `color` object sets over the palette's:
 * `value` fills a read no field colours and one its tag or mate scheme found
 * no value for, and `declaredReadCategoryColors` goes over that.
 */
export function writtenReadCategoryColors(
  value: string | undefined,
  encoding: AlignmentsColorEncoding,
): Partial<Record<ReadColorCategory, RGBColor>> {
  const fill = value ? cssColorToNormalizedRgb(value) : undefined
  return {
    ...(fill ? Object.fromEntries(VALUE_FILLED.map(c => [c, fill])) : {}),
    ...declaredReadCategoryColors(encoding),
  }
}

/**
 * The read category colours the `color` object declares, over the palette's
 * defaults: `range[i]` colours the i-th of `declaredLevels`. A level left out
 * keeps its default.
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

/** What `color.labels` names: read buckets, and a baked scheme's values. */
export interface DeclaredReadLabels {
  categories: Partial<Record<ReadColorCategory, string>>
  // a tag or mate value by the value, or a threshold bin by its interval
  values: ReadonlyMap<string, string>
}

/**
 * `color.labels` against the levels and values it names, in the order
 * `range` colours them: `labels[i]` names the i-th of `declaredLevels`, and
 * under a baked scheme the i-th `domain` value, or a threshold's i-th bin.
 * Read apart from the encoding, so a renamed key entry re-bakes no read.
 */
export function declaredReadLabels(
  encoding: AlignmentsColorEncoding,
  labels: readonly string[],
): DeclaredReadLabels {
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
    : encoding.scale === 'categorical'
      ? (encoding.domain ?? [])
      : []
}

/** The `color` object a scheme pick writes: `colorForField` over the scheme's field. */
export function colorSnapshotFor(
  colorBy: ColorBy,
  current: AlignmentsColorSetting,
): Partial<AlignmentsColorSetting> {
  return colorForField(current, colorFieldOf(colorBy))
}

/**
 * The short/long cut points an insert-size field's threshold pins, in place of
 * the band sampled from the reads. Undefined unless its `domain` names two
 * distinct numbers.
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

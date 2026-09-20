import { TAG_FIELD_PREFIX, facetTag } from './groupByLabels.ts'

import type { ColorBy, ColorSchemeType, ModificationColorBy } from './types.ts'

export const ALIGNMENTS_COLOR_SCALES = [
  'none',
  'categorical',
  'linear',
  'threshold',
] as const
export type AlignmentsColorScale = (typeof ALIGNMENTS_COLOR_SCALES)[number]

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

type PresetScheme = Exclude<ColorSchemeType, 'normal' | 'tag'>

/**
 * The fields with a vocabulary, ramp or layer of their own. The read
 * dimensions share the facet's names, so `facet` and `color` over one variable
 * are one word.
 */
export const COLOR_FIELDS: Record<PresetScheme, string> = {
  strand: 'strand',
  mappingQuality: 'mapq',
  insertSize: 'insertSize',
  firstOfPairStrand: 'firstOfPairStrand',
  pairOrientation: 'pairOrientation',
  insertSizeAndOrientation: 'insertSizeAndOrientation',
  perBaseQuality: 'baseQuality',
  perBaseLetter: 'base',
  mateRefName: 'mateRefName',
  modifications: 'modifications',
  bisulfite: 'bisulfite',
}

const SCHEME_OF_FIELD = new Map(
  Object.entries(COLOR_FIELDS).map(([scheme, field]) => [
    field,
    scheme as PresetScheme,
  ]),
)

const READS_MODIFICATION_SETTINGS = new Set<ColorSchemeType>([
  'modifications',
  'bisulfite',
])

/** The field a runtime scheme paints, `''` for the plain fill. */
export function colorFieldOf(colorBy: ColorBy) {
  return colorBy.type === 'normal'
    ? ''
    : colorBy.type === 'tag'
      ? colorBy.tag
        ? `${TAG_FIELD_PREFIX}${colorBy.tag}`
        : (colorBy.attribute ?? '')
      : COLOR_FIELDS[colorBy.type]
}

/**
 * The runtime scheme a `color` object selects: a preset field its own scheme,
 * `tags.XX` the tag scheme, any other name a feature attribute through the
 * same per-read bake. A field under `none` paints the plain fill.
 */
export function colorByOf(
  { field, scale }: Pick<AlignmentsColorSetting, 'field' | 'scale'>,
  modifications?: ModificationColorBy,
): ColorBy {
  if (!field || scale === 'none') {
    return { type: 'normal' }
  }
  const scheme = SCHEME_OF_FIELD.get(field)
  if (scheme) {
    return READS_MODIFICATION_SETTINGS.has(scheme) && modifications
      ? { type: scheme, modifications }
      : { type: scheme }
  }
  const tag = facetTag(field)
  return tag ? { type: 'tag', tag } : { type: 'tag', attribute: field }
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
 * under `none` for the way back, and a field re-picked keeps its order, palette
 * and ramp; a new field starts from none of them.
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

const INSERT_SIZE_FIELDS = new Set([
  COLOR_FIELDS.insertSize,
  COLOR_FIELDS.insertSizeAndOrientation,
])

/**
 * The short/long cut points an insert-size field's `domain` pins, in place of
 * the band sampled from the reads. Undefined unless it lists two ascending
 * numbers.
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

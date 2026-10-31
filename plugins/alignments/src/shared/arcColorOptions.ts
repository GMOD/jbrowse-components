import {
  FACET_LABELS,
  INSERT_SIZE_AND_ORIENTATION_LABEL,
} from './facetLabels.ts'

/**
 * The read fields a paired-end arc and the read cloud can paint, and the
 * radios the 'Read connections color' submenu builds from them. They are the
 * reads' own field names, so `arcColor` and `encoding.color` over one variable
 * are one word.
 *
 * A leaf module because the website's figure recipes name these labels in a
 * click path, and the node script that builds them cannot load a module
 * importing React, MUI or a lazy `.tsx`.
 */
export const ARC_COLOR_OPTIONS = [
  {
    value: 'insertSizeAndOrientation',
    label: INSERT_SIZE_AND_ORIENTATION_LABEL,
  },
  {
    value: 'pairOrientation',
    label: FACET_LABELS.pairOrientation,
  },
] as const

export type ArcColorField = (typeof ARC_COLOR_OPTIONS)[number]['value']

export const ARC_COLOR_FIELDS = ARC_COLOR_OPTIONS.map(o => o.value)

export const SAME_AS_READS_LABEL = 'Same as reads'

/** What an arc paints when neither it nor the reads name a field it can. */
export const DEFAULT_ARC_COLOR_FIELD: ArcColorField = 'insertSizeAndOrientation'

export function isArcColorField(field?: string): field is ArcColorField {
  return (ARC_COLOR_FIELDS as readonly (string | undefined)[]).includes(field)
}

/**
 * The field the arcs paint: `own`, the `arcColor` object's, unless it is
 * unset, then `readField`, the reads' `encoding.color` field, where an arc can
 * paint it, else {@link DEFAULT_ARC_COLOR_FIELD}.
 */
export function arcColorFieldOf(
  own: string | undefined,
  readField: string | undefined,
) {
  return isArcColorField(own)
    ? own
    : isArcColorField(readField)
      ? readField
      : DEFAULT_ARC_COLOR_FIELD
}

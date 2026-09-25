/**
 * The read fields a paired-end arc and the read cloud can paint, and the
 * radios the 'Arc color' submenu builds from them. They are the reads' own
 * field names, so `arcColor` and `color` over one variable are one word.
 *
 * A leaf module because the website's figure recipes name these labels in a
 * click path, and the node script that builds them cannot load a module
 * importing React, MUI or a lazy `.tsx`.
 */
export const ARC_COLOR_OPTIONS = [
  {
    value: 'insertSizeAndOrientation',
    label: 'Insert size and orientation',
    helpText:
      'Combined SV view. A short insert always paints pink regardless of orientation — at a short insert the useful signal is just "something is here", so orientation is not worth distinguishing. Otherwise an abnormal pair orientation wins (inversion, tandem duplication), and a large insert with normal orientation paints as a long insert (the classic deletion signature). Insert-size thresholds are robust to the long tail of large inserts (median ± 3·1.4826·MAD) so the short-insert signal is not washed out by a few very large outliers.',
  },
  {
    value: 'insertSize',
    label: 'Insert size',
    helpText:
      'Colors only by template length: short inserts pink, long inserts red, normal grey — orientation ignored. Thresholds use a robust median ± 3·1.4826·MAD spread so a tight insert-size distribution with a few very large outliers still flags genuinely short inserts.',
  },
  {
    value: 'pairOrientation',
    label: 'Orientation',
    helpText:
      'Colors only by pair orientation (LR/RL/RR/LL), ignoring insert size. Useful when you only care about inversion/duplication signatures.',
  },
] as const

export type ArcColorField = (typeof ARC_COLOR_OPTIONS)[number]['value']

export const ARC_COLOR_FIELDS = ARC_COLOR_OPTIONS.map(o => o.value)

export const SAME_AS_READS_LABEL = 'Same as reads'

export const SAME_AS_READS_HELP =
  "Arcs take the reads' color when the reads are colored by insert size, pair orientation, or both. Under any other read color they paint by insert size and orientation."

/** What an arc paints when neither it nor the reads name a field it can. */
export const DEFAULT_ARC_COLOR_FIELD: ArcColorField = 'insertSizeAndOrientation'

function isArcColorField(field: string): field is ArcColorField {
  return (ARC_COLOR_FIELDS as readonly string[]).includes(field)
}

/**
 * The field the arcs paint: `own`, the `arcColor` object's, unless it is
 * empty, then `readField`, the reads' `color` field, where an arc can paint
 * it, else {@link DEFAULT_ARC_COLOR_FIELD}.
 */
export function arcColorFieldOf(own: string, readField: string) {
  return isArcColorField(own)
    ? own
    : isArcColorField(readField)
      ? readField
      : DEFAULT_ARC_COLOR_FIELD
}

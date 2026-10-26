import { COLOR_FIELD_DEFS } from './colorFieldDefs.ts'
import { BASE_COLOR_FIELDS, COLOR_FIELDS } from './types.ts'

import type { ColorGroup } from './colorFieldDefs.ts'

/** A Color by radio: the field it paints by, undefined for the plain fill. */
export interface ColorFieldOption {
  field: string | undefined
  label: string
  /** offered only while it paints (`ColorFieldMenu`'s `whileActive`) */
  whileActive?: true
}

const PAINTED_FIELDS = new Set<string>([...COLOR_FIELDS, ...BASE_COLOR_FIELDS])

const RADIOS = Object.values(COLOR_FIELD_DEFS).flatMap(({ kind, menu }) =>
  menu.kind === 'radio' && (kind === 'normal' || PAINTED_FIELDS.has(kind))
    ? [
        {
          field: kind === 'normal' ? undefined : kind,
          label: menu.label,
          group: menu.group,
          whileActive: menu.whileActive,
        },
      ]
    : [],
)

const LABELS = new Map<string | undefined, string>(
  RADIOS.map(({ field, label }) => [field, label]),
)

/** The Color by radios of a menu group, in the registry's order. */
export function radioColorFieldOptions(group: ColorGroup): ColorFieldOption[] {
  return RADIOS.filter(r => r.group === group).map(
    ({ field, label, whileActive }) => ({
      field,
      label,
      ...(whileActive ? { whileActive } : {}),
    }),
  )
}

/**
 * Color by radios for a display offering a curated few fields, in the order
 * given, each labelled as the alignments menu labels it, undefined the plain
 * fill; an entry naming its own label is for a field whose name is right on
 * one display and wrong on another (`mateRefName`: a mate's chromosome on a
 * BAM, a query contig on a PAF).
 */
export function colorFieldOptions(
  ...fields: (string | undefined | ColorFieldOption)[]
): ColorFieldOption[] {
  return fields.map(f =>
    typeof f === 'object' ? f : { field: f, label: LABELS.get(f) ?? String(f) },
  )
}

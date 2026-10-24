import { COLOR_FIELD_DEFS } from './colorFieldDefs.ts'
import { BASE_COLOR_FIELDS, COLOR_FIELDS } from './types.ts'

import type { ColorGroup } from './colorFieldDefs.ts'
import type { ColorFieldKind } from './types.ts'

/** A Color by radio: the field it paints by, `''` for the plain fill. */
export interface ColorFieldOption {
  field: string
  label: string
}

const PAINTED_FIELDS = new Set<string>([...COLOR_FIELDS, ...BASE_COLOR_FIELDS])

function fieldOfKind(kind: ColorFieldKind) {
  return kind === 'normal' ? '' : PAINTED_FIELDS.has(kind) ? kind : undefined
}

const RADIOS = Object.values(COLOR_FIELD_DEFS).flatMap(({ kind, menu }) => {
  const field = fieldOfKind(kind)
  return menu.kind === 'radio' && field !== undefined
    ? [{ field, label: menu.label, group: menu.group }]
    : []
})

const LABELS = new Map(RADIOS.map(({ field, label }) => [field, label]))

/** The Color by radios of a menu group, in the registry's order. */
export function radioColorFieldOptions(group: ColorGroup): ColorFieldOption[] {
  return RADIOS.filter(r => r.group === group).map(({ field, label }) => ({
    field,
    label,
  }))
}

/**
 * Color by radios for a display offering a curated few fields, in the order
 * given, each labelled as the alignments menu labels it; an entry naming its
 * own label is for a field whose name is right on one display and wrong on
 * another (`mateRefName`: a mate's chromosome on a BAM, a query contig on a
 * PAF).
 */
export function colorFieldOptions(
  ...fields: (string | ColorFieldOption)[]
): ColorFieldOption[] {
  return fields.map(f =>
    typeof f === 'string' ? { field: f, label: LABELS.get(f) ?? f } : f,
  )
}

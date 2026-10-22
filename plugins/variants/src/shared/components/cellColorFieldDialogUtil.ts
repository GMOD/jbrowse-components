import {
  colorForField,
  definedColor,
} from '@jbrowse/display-kit/colorConfigSchema'

import type { JexlFilterField } from '@jbrowse/core/ui/JexlFilterDialog'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

/** The field ref a picker entry colors by: a path, or a variant function. */
export function fieldRefOf(field: JexlFilterField) {
  return 'path' in field ? field.path.join('.') : `jexl:${field.call}(feature)`
}

/**
 * Cut points typed as a comma- or space-separated list, ascending; `[]` for a
 * blank list and undefined for one holding something that is no number.
 */
export function parseCuts(text: string): number[] | undefined {
  const cuts = text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  return cuts.every(Number.isFinite) ? cuts.sort((a, b) => a - b) : undefined
}

/**
 * The `encoding.color` a field pick writes over `current`: a threshold where
 * it has cuts. Re-picking the field already painting, or the one `parked`
 * holds, keeps its key names and colors, its range only while the number of
 * cuts holds.
 */
export function cellColorOfField(
  current: ColorSlots,
  field: string,
  cuts: readonly number[],
  parked?: ColorSlots,
): ColorSlots {
  const next = colorForField(current, field, parked)
  const { scale = {}, ...rest } = next
  if (scale.type !== 'threshold' && !cuts.length) {
    return next
  }
  const { type, domain: _cuts, range, ...kept } = scale
  return definedColor({
    ...rest,
    scale: cuts.length
      ? {
          ...kept,
          type: 'threshold',
          domain: cuts.map(String),
          ...(type === 'threshold' && range?.length === cuts.length + 1
            ? { range }
            : {}),
        }
      : kept,
  })
}

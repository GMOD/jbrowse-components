import type { JexlFilterField } from '@jbrowse/core/ui/JexlFilterDialog'

/** The field ref a picker entry colours by: a path, or a variant function. */
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

/** The `color` object a field pick writes: a threshold where it has cuts. */
export function cellColorOfField(field: string, cuts: readonly number[]) {
  return cuts.length
    ? { field, scale: 'threshold', domain: cuts.map(String) }
    : { field }
}

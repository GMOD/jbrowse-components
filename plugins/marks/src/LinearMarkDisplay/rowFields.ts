import { BED_COLOR_FIELDS } from '@jbrowse/core/util/colorBits'

// Values a block paints by, never names a row stands for.
const PAINT_FIELDS = new Set<string>([
  'strand',
  'score',
  'phase',
  ...BED_COLOR_FIELDS,
])

/** Whether a row may stand for a value of `field`. */
export function isRowField(field: string) {
  return !PAINT_FIELDS.has(field)
}

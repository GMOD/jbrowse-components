import { baseDisplayConfig } from '@jbrowse/tree-sidebar'

import { SOURCE_FIELD } from '../shared/wiggleColorConfigSchema.ts'

/**
 * The colour object behind "Color rows by → Each row": a colour per subtrack is
 * two settings on this display, the `rowColor` naming each row and this one
 * turning the palette on. Only this one makes `sourcePalette` answer, and the
 * shared arrangement dialog writes `rowColor` alone.
 */
export const PER_SOURCE_COLOR = {
  field: SOURCE_FIELD,
  scale: 'categorical',
} as const

/** Whether a colour object is that switch, whoever wrote it. */
export function isPerSourceColor(color: {
  field?: string
  scale?: string | undefined
}) {
  return color.field === SOURCE_FIELD && color.scale === 'categorical'
}

/**
 * The `color` the display's base declares, as far as the switch is concerned. A
 * string names no field, so it is not the switch.
 */
export function baseColorChannel(self: object) {
  const base = baseDisplayConfig(self).color
  return typeof base === 'object' && base !== null
    ? (base as { field?: string; scale?: string })
    : {}
}

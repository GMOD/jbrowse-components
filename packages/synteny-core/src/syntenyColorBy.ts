import {
  colorEncodingOf,
  colorForField,
} from '@jbrowse/display-kit/colorConfigSchema'

import type { SyntenyColorSnapshot } from './syntenyColorConfigSchema.ts'

/**
 * #api
 * The field a synteny color channel paints by, or undefined while it names
 * none. Read through the one resolver every display's color channel goes
 * through.
 */
export function paintedField({
  value,
  scale,
  field = '',
}: SyntenyColorSnapshot) {
  const encoding = colorEncodingOf({
    value,
    field,
    scale: { type: scale?.type, domain: scale?.domain ?? [], range: [] },
    legend: {},
  })
  return typeof encoding === 'object' ? encoding.field : undefined
}

/**
 * #api
 * The color channel that paints by `field`, written over `current`, undefined
 * clearing the field: display-kit's `colorForField`, the rule every display's
 * Color by pick writes by.
 */
export function syntenyColorFor(
  field: string | undefined,
  current: SyntenyColorSnapshot,
) {
  return colorForField(current, field)
}

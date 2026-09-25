import {
  colorEncodingOf,
  colorForField,
} from '@jbrowse/display-kit/colorConfigSchema'

import type { SyntenyColorSnapshot } from './syntenyColorConfigSchema.ts'

/**
 * #api
 * The field a synteny colour object paints by, or `''` while it paints its
 * constant: `scale: 'none'`, or no field named. Read through the one resolver
 * every display's colour object goes through.
 */
export function paintedField({
  value,
  scale,
  field = '',
  domain = [],
}: SyntenyColorSnapshot) {
  const encoding = colorEncodingOf({ value, field, scale, domain, range: [] })
  return typeof encoding === 'object' ? encoding.field : ''
}

/**
 * #api
 * The colour object that paints by `field`, written over `current`: display-kit's
 * `colorForField`, the rule every display's Color by pick writes by.
 */
export function syntenyColorFor(
  field: string,
  current: SyntenyColorSnapshot,
): SyntenyColorSnapshot {
  return colorForField(current, field)
}

import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'

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
  const encoding = colorEncodingOf(
    { value, field, scale, domain, range: [] },
    'categorical',
  )
  return typeof encoding === 'object' ? encoding.field : ''
}

/**
 * #api
 * The colour object that paints by `field`, written over `current`: `''`
 * keeps the field and its order under `scale: 'none'` for a switch back, and
 * a field keeps its order only when it is the one already named.
 */
export function syntenyColorFor(
  field: string,
  current: SyntenyColorSnapshot,
): SyntenyColorSnapshot {
  if (field === '') {
    return { ...current, scale: 'none' }
  }
  const { scale, domain, ...rest } = current
  return { ...rest, field, ...(field === current.field ? { domain } : {}) }
}

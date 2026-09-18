import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'

import type { SyntenyColorSnapshot } from './syntenyColorConfigSchema.ts'

/**
 * #api
 * The field a synteny colour object paints by, or `''` while it paints its
 * constant: `scale: 'none'`, or no field named.
 */
export function paintedField({ scale, field = '' }: SyntenyColorSnapshot) {
  return paintedScale({ scale, field }, 'categorical') === 'none' ? '' : field
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

import { SimpleFeature } from '@jbrowse/core/util'
import { svMateLocus } from '@jbrowse/sv-core'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

/**
 * How big a structural variant is, which `end - start` is not: an insertion
 * occupies one reference base and states its size in `INFO.SVLEN`.
 *
 * - Ends on two chromosomes have no size, whatever SVLEN says: Sniffles writes
 *   one on `<TRA>` records that measures nothing.
 * - Otherwise a declared SVLEN wins.
 * - Failing that, the farther of the record's own end and its mate.
 */
export function svSize(
  data: SimpleFeatureSerialized,
  mate = svMateLocus(new SimpleFeature(data)),
) {
  if (mate !== undefined && mate.refName !== data.refName) {
    return undefined
  }

  const info = data.INFO as Record<string, unknown[]> | undefined
  const declared = info?.SVLEN?.[0]
  // narrowed rather than coerced: `Number(null)` and `Number([])` are both 0,
  // so a malformed SVLEN would otherwise report a zero-length SV rather than
  // falling through to the endpoints
  const svLen =
    typeof declared === 'number'
      ? declared
      : typeof declared === 'string'
        ? Number(declared)
        : Number.NaN
  if (!Number.isNaN(svLen)) {
    return Math.abs(svLen)
  }

  const footprint = data.end - data.start
  if (mate === undefined) {
    return footprint
  }
  // a `<DEL>`'s `end` is INFO.END already; a breakend's is only REF.length
  return Math.max(footprint, Math.abs(mate.pos - data.start))
}

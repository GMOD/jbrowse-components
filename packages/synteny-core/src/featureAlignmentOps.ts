import { parseCigar2Typed, parseCoarseCigar } from '@jbrowse/cigar-utils'

import type { Feature } from '@jbrowse/core/util'

export function getCigar(feature: Feature) {
  const cigar = feature.get('CIGAR')
  return typeof cigar === 'string' ? cigar : undefined
}

export function getCoarseCigar(feature: Feature) {
  const coarse = feature.get('coarseCigar')
  return typeof coarse === 'string' ? coarse : undefined
}

export function hasAlignmentString(feature: Feature) {
  return (
    getCigar(feature) !== undefined || getCoarseCigar(feature) !== undefined
  )
}

// the per-base CIGAR when the record carries one, else the coarse tier's fold
export function getAlignmentOps(feature: Feature) {
  const cigar = getCigar(feature)
  const coarse = cigar === undefined ? getCoarseCigar(feature) : undefined
  return cigar !== undefined
    ? parseCigar2Typed(cigar)
    : coarse !== undefined
      ? parseCoarseCigar(coarse)
      : undefined
}

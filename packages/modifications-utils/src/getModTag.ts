import { getTag, getTagAlt } from './getTagAlt.ts'

import type { Feature } from '@jbrowse/core/util'

function seqLength(feature: Feature) {
  const len = feature.get('seq_length')
  return typeof len === 'number'
    ? len
    : (feature.get('seq') as string | undefined)?.length
}

/**
 * #api
 * The read's MM tag, or undefined when its MN tag says MM was computed on a
 * sequence of a different length than SEQ. Per SAMtags, MN catches a hard clip
 * or trim that shifted the bases MM's deltas count, so on a mismatch every
 * position MM would place is wrong.
 */
export function getModTag(feature: Feature) {
  const mm = getTagAlt(feature, 'MM', 'Mm') as string | undefined
  if (!mm) {
    return undefined
  }
  const mn = getTag(feature, 'MN')
  return mn === undefined || Number(mn) === seqLength(feature) ? mm : undefined
}

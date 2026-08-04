import { getStrand } from '../../shared/util.ts'

import type { GapData } from '../../shared/webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * The transcript strand a skip (`N`) implies: the XS/TS library strand if the
 * aligner tagged one, else the ts orientation tag applied to the read's own
 * strand, else 0 (unknown).
 *
 * A property of the READ, so compute it once per read — not once per skip. It
 * used to be called from inside `emitGap`, i.e. per gap, and an ultra-long
 * nanopore read carries hundreds of skips (1117 on the longest in
 * chr22_nanopore_subset), so a single read re-derived the same answer a thousand
 * times over, each time re-entering `feature.get()` twice.
 */
export function getEffectiveStrand(feature: Feature) {
  const tags = feature.get('tags') as Record<string, string> | undefined
  const fstrand = getStrand(feature)
  const xs = tags?.XS ?? tags?.TS
  const ts = tags?.ts
  if (xs === '+') {
    return 1
  } else if (xs === '-') {
    return -1
  }
  return (ts === '+' ? 1 : ts === '-' ? -1 : 0) * fstrand
}

export function emitGap(
  type: 'deletion' | 'skip',
  start: number,
  length: number,
  readIndex: number,
  featureStart: number,
  strand: number,
  // Transcript strand for a skip (see getEffectiveStrand), resolved once per
  // read by the caller. Ignored for a deletion, which uses the read's strand.
  skipStrand: number,
  gapsData: GapData[],
) {
  gapsData.push({
    readIndex,
    start: featureStart + start,
    end: featureStart + start + length,
    type,
    strand: type === 'deletion' ? strand : skipStrand,
    featureStrand: strand,
  })
}

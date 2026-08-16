import { getTag, getTagAlt } from '@jbrowse/modifications-utils'

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
 *
 * **Targeted lookups, never `get('tags')`.** Three tag names are wanted and that
 * accessor is the FULL decode — `BamRecord._computeTags` allocates a
 * null-prototype object and decodes every tag value on the read, then memoizes
 * it onto a record that lives in `@gmod/bam`'s shared chunk LRU, so the object
 * is retained for as long as the chunk is cached. Reading three names instead
 * measures 5.7-9.2x on the three spliced fixtures in the repo
 * (`benches/gapStrand.bench.ts`, controls 1.00-1.11x) — and this runs once per
 * spliced read, which on RNA-seq is most of them.
 *
 * `getTagAlt` resolves the XS/TS pair in ONE pass; `ts` costs a second pass, and
 * only when neither answered. Two passes rather than one full decode is the
 * whole trade, and it inverts when a read's tag block is dominated by a long
 * `MD`: on a 9 kB MD each pass byte-scans to the null terminator, so two of them
 * lose to one decode (measured 0.68x on `200x.longread`). That fixture carries
 * no skips, so this function never runs on it — but a long-read RNA library
 * aligned WITH `--MD` would be the case that regresses, and is the one to
 * re-measure on if this ever looks slow.
 *
 * The full decode was also incidentally warming the `MM`/`Mm` lookup that
 * `extractModifications` makes later in the same pass; that lookup now walks
 * again. A walk is ~0.1us against ~1.5us for the decode, so the trade stays
 * heavily positive, but it is why the win here is not the whole saving.
 */
export function getEffectiveStrand(feature: Feature) {
  const xs = getTagAlt(feature, 'XS', 'TS') as string | undefined
  if (xs === '+') {
    return 1
  } else if (xs === '-') {
    return -1
  }
  // Branch rather than multiply by 0 for the unknown case: `0 * -1` is `-0`,
  // which this returned for every untagged reverse-strand read. Nothing
  // downstream could see it — a Map keys -0 and 0 the same (SameValueZero), and
  // `gapStrands` is an Int8Array, which stores both as 0 — but a function whose
  // contract is "0 (unknown)" should return that. Found by extract.test.ts.
  const ts = getTag(feature, 'ts') as string | undefined
  if (ts !== '+' && ts !== '-') {
    return 0
  }
  const fstrand = getStrand(feature)
  if (fstrand === 0) {
    return 0
  }
  return ts === '+' ? fstrand : (-fstrand as -1 | 1)
}

export function emitGap(
  type: 'deletion' | 'skip',
  start: number,
  length: number,
  readIndex: number,
  featureStart: number,
  strand: number,
  // The strand the gap itself carries — the caller's to decide. A deletion has
  // no strand of its own and passes the read's; a skip passes the transcript
  // strand `getEffectiveStrand` resolved once for the read.
  gapStrand: number,
  gapsData: GapData[],
) {
  gapsData.push({
    readIndex,
    start: featureStart + start,
    end: featureStart + start + length,
    type,
    strand: gapStrand,
    featureStrand: strand,
  })
}

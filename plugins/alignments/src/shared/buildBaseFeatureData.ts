import { pairDirection } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { readKeyOf } from './readIdentity.ts'
import { getFlags, getMappingQuality, getStrand } from './util.ts'

import type { ChainFeatureData, FeatureData } from './webglRpcTypes.ts'
import type { PairDirection } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'

// GPU-uniform encoding of the shared PairDirection categories (0 = unknown).
// Also the linked-read connector's color index: `pairedColorType` passes an
// orientNum straight through as a palette slot, so features/linkedReads
// derives its LINKED_READ_COLOR_PAIR_* from this rather than restating it.
export const PAIR_DIRECTION_NUM: Record<PairDirection, number> = {
  LR: 1,
  RL: 2,
  RR: 3,
  LL: 4,
}

export function pairOrientationToNum(pairOrientation: string | undefined) {
  const dir = pairDirection(pairOrientation)
  return dir ? PAIR_DIRECTION_NUM[dir] : 0
}

/**
 * The ordinary, uninteresting pair: the aligner flagged it properly paired, it
 * is not a chimeric segment, and its mates face each other. THE definition of
 * "concordant" for anything that hides the boring case — the read filter behind
 * "Show proper pairs" (`isProperPairChain`, worker side) and the arc filter
 * behind "Show concordant-pair arcs" (`resolveArcs`, main thread) — so the two
 * cannot come to hide different sets of pairs.
 *
 * Written over the NUMBERS both sides already hold rather than over a `Feature`,
 * because only one of the two callers has features: the arc path works from
 * `readFlags` / `readPairOrientations`, and giving it a feature-shaped predicate
 * would have meant a second implementation, which is the drift this exists to
 * prevent. The worker converts with `pairOrientationToNum` above.
 *
 * Unknown orientation (0) counts as concordant, matching the FR classifier this
 * replaced: an aberrant orientation is positive evidence, and its absence is not
 * a reason to call a flagged proper pair interesting.
 *
 * A SUPPLEMENTARY segment is never concordant however it is flagged. Aligners
 * like BWA-MEM propagate 0x2 onto supplementary records because the flag
 * describes the pair and not the segment, so a chimeric read carrying
 * split-read SV evidence would otherwise be filtered away as routine. Same rule,
 * same reason, as `PRIMARY_PROPER_PAIR_MASK` in computePairedInsertSizeStats.
 *
 * NOT the read cloud's `isConcordantFRPair`, which is deliberately a different
 * question: that one asks whether |TLEN| sits in the modal insert-size band, so
 * the cloud can surface anything anomalous in SIZE even when the flags call it
 * proper. This one asks what the aligner concluded. A pair can satisfy either
 * without the other, and both readings are wanted where they are used.
 */
export function isConcordantPairRead(
  flags: number,
  pairOrientationNum: number,
) {
  return (
    !!(flags & SAM_FLAG_PROPER_PAIR) &&
    !(flags & SAM_FLAG_SUPPLEMENTARY) &&
    (pairOrientationNum === 0 || pairOrientationNum === PAIR_DIRECTION_NUM.LR)
  )
}

/**
 * `readIdPrefix` is the fetch's verified `${adapter.id}-` (see
 * `readIdPrefixOf`), or undefined when these features have no numeric record id
 * — and it is what decides which form `id` takes. Undefined means read the
 * string, so a numeric key can never exist without a prefix to rebuild its
 * string from.
 */
export function buildBaseFeatureData(
  feature: Feature,
  readIdPrefix: string | undefined,
): FeatureData {
  return {
    id: readIdPrefix === undefined ? feature.id() : readKeyOf(feature),
    start: feature.get('start'),
    end: feature.get('end'),
    flags: getFlags(feature),
    mapq: getMappingQuality(feature),
    // SAM spec: TLEN 0 means insert size is unset (e.g. unpaired reads)
    insertSize: Math.abs(
      (feature.get('template_length') as number | undefined) ?? 0,
    ),
    pairOrientation: pairOrientationToNum(
      feature.get('pair_orientation') as string | undefined,
    ),
    // The normalization lives in getStrand, so `readStrands` and every
    // feature-side strand read resolve it identically.
    strand: getStrand(feature),
  }
}

export function buildChainFeatureData(
  feature: Feature,
  readIdPrefix: string | undefined,
): ChainFeatureData {
  return {
    ...buildBaseFeatureData(feature, readIdPrefix),
    name: feature.get('name') ?? '',
    nextRef: feature.get('next_ref') as string | undefined,
  }
}

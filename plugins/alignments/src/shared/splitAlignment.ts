import { SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/cigar-utils'

import { extractFeatureTagValue } from './extractFeatureTagValue.ts'
import { getFlags } from './util.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * Whether a read is one piece of a chimeric (split) alignment.
 *
 * SA is the signal, not the supplementary flag: the aligner writes SA on **every**
 * segment of the split, the primary included, while the flag marks only the pieces
 * after the first. Grouping on the flag alone therefore filed a split read's own
 * first piece with the reads that never split at all — sections cutting through
 * the evidence instead of around it, which is the bug the `splitRead` dimension
 * was rewritten to fix.
 *
 * The flag stays as an OR because it is a conformance backstop, not a second
 * concept: a supplementary record IS by definition part of a split, and one whose
 * SA the source dropped would otherwise read as unsplit. It also short-circuits
 * the tag scan for the segments that need no lookup.
 *
 * `extractFeatureTagValue`, not `@jbrowse/modifications-utils`' `getTag`, so a
 * source that keeps the value as a plain field (the flagless PAF/synteny blocks
 * this pipeline also serves) answers the same way as a BAM.
 */
export function isSplitAlignment(feature: Feature) {
  return (
    (getFlags(feature) & SAM_FLAG_SUPPLEMENTARY) !== 0 ||
    extractFeatureTagValue(feature, 'SA') !== ''
  )
}

/**
 * Whether a chain carries split evidence — the fragment-level question, which no
 * single read answers: a chain is keyed by read name and so holds both mates, and
 * one mate can be split where the other is not.
 *
 * The one predicate behind both surfaces that speak for split reads, so "Show only
 * split alignments" and "Group by → Split read" cannot come to disagree about
 * which chains are split. They did, over the supplementary flag: the filter
 * counted it, the grouping did not.
 */
export function chainIsSplit(chain: Feature[]) {
  return chain.some(isSplitAlignment)
}

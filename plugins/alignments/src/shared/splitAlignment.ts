import {
  SAM_FLAG_SUPPLEMENTARY,
  connectionEndpointBps,
  featurizeSAEntries,
  getClip,
  splitSA,
} from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { extractFeatureTagValue } from './extractFeatureTagValue.ts'
import { getFlags, getStrand } from './util.ts'

import type { Feature } from '@jbrowse/core/util'
import type { PanelStop } from '@jbrowse/sv-core'

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

export interface AlignedSegment {
  refName: string
  start: number
  end: number
  strand: number
  clip: number
}

/**
 * Every locus a split read aligns to — the record's own plus each one its SA
 * tag names, each with its mapping strand — ordered along the read by
 * clip-at-start, so a fusion lists its donor before its acceptor. Empty for a
 * read with no SA tag, so a caller can gate on the length. A truncated SA
 * record parses to an empty span and is dropped rather than shown as a locus.
 */
export function splitAlignmentSegments(feature: Feature): AlignedSegment[] {
  const records = splitSA(extractFeatureTagValue(feature, 'SA'))
  if (records.length === 0) {
    return []
  }
  const cigar = (feature.get('CIGAR') as string | undefined) ?? ''
  const strand = getStrand(feature)
  const own: AlignedSegment = {
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
    strand,
    clip: getClip(cigar, strand),
  }
  const others = featurizeSAEntries(records, feature.id(), undefined, undefined)
    .filter(s => Number.isFinite(s.start) && s.end > s.start)
    .map(s => ({
      refName: s.refName,
      start: s.start,
      end: s.end,
      strand: s.strand,
      clip: s.clipLengthAtStartOfRead,
    }))
  return [own, ...others].sort((a, b) => a.clip - b.clip)
}

/**
 * A split read as a breakpoint split view launch: its first two segments as
 * the read-plus-mate feature the launcher frames, the shape
 * `buildPairedEndMateFeature` gives a mate, and each junction's two ends as
 * stops in read order, the edge the read leaves one segment by and the edge
 * it enters the next by, which the launcher folds into a panel per locus.
 */
export function splitReadLaunch(
  id: string,
  name: string | undefined,
  segments: AlignedSegment[],
) {
  const end = (suffix: string, s: AlignedSegment) => ({
    uniqueId: `${id}-${suffix}`,
    refName: s.refName,
    start: s.start,
    end: s.end,
    strand: s.strand,
  })
  return {
    feature: new SimpleFeature({
      ...end('split', segments[0]!),
      name,
      mate: end('split-mate', segments[1]!),
    }),
    stops: segments.slice(0, -1).flatMap((s1, i): PanelStop[] => {
      const s2 = segments[i + 1]!
      const { bp1, bp2 } = connectionEndpointBps({
        s1: s1.strand,
        start1: s1.start,
        end1: s1.end,
        s2: s2.strand,
        start2: s2.start,
        end2: s2.end,
        isSplit: true,
      })
      return [
        { refName: s1.refName, pos: bp1 },
        { refName: s2.refName, pos: bp2 },
      ]
    }),
  }
}

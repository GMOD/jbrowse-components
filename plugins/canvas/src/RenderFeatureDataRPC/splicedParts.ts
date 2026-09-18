import {
  isGeneLikeType,
  isSequenceMatchType,
  mergeIntervals,
} from '@jbrowse/core/util'

import { featureType, getSubfeatures } from './util.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * The two type families whose parts are separated by introns: a gene or one of
 * its transcripts, and a sequence alignment, whose `match_part` children are
 * the aligned blocks. A gene answers by type rather than by what its glyph
 * drew, because its own introns belong to the transcripts it stacks.
 */
export function offersCollapseIntrons(type: string | undefined) {
  return isGeneLikeType(type) || isSequenceMatchType(type)
}

// The child shapes whose gaps are introns: exon/CDS on an annotation,
// match_part on a sequence alignment, and block on a BED12 the gene heuristic
// declined to promote — an unstranded one, or a track with
// `disableGeneHeuristic` set.
const SPLICED_PART_TYPES = new Set(['exon', 'cds', 'match_part', 'block'])

export function isSplicedPartType(type: string | undefined) {
  return type !== undefined && SPLICED_PART_TYPES.has(type.toLowerCase())
}

const isSplicedPart = (f: Feature) => isSplicedPartType(featureType(f))

export function getSplicedParts(transcripts: Feature[]) {
  return transcripts.flatMap(transcript =>
    getSubfeatures(transcript).filter(isSplicedPart),
  )
}

export function featureHasSplicedParts(feature: Feature) {
  return getSubfeatures(feature).some(isSplicedPart)
}

export function exonIntervals(transcripts: Feature[]) {
  return getSplicedParts(transcripts).map(f => ({
    start: f.get('start'),
    end: f.get('end'),
  }))
}

// A transcript carries spliced parts without being one, and wins over the
// feature's own parts: a gene carrying both mRNA children and stray exon
// children of its own is still a gene, and reading it as one transcript would
// silently merge every isoform.
export function getTranscripts(feature?: Feature): Feature[] {
  const children = feature
    ? getSubfeatures(feature).filter(
        f => !isSplicedPart(f) && featureHasSplicedParts(f),
      )
    : []
  return children.length > 0
    ? children
    : feature && featureHasSplicedParts(feature)
      ? [feature]
      : []
}

export function hasIntrons(transcripts: Feature[]) {
  const intervals = exonIntervals(transcripts)
  return intervals.length > 1 && mergeIntervals(intervals, 0).length > 1
}

// The dialog offers each transcript as well as their union, so any scope with
// an intron is worth opening it for: an isoform that retains an intron another
// splices out makes the union contiguous while the spliced isoform collapses.
export function hasCollapsibleIntrons(transcripts: Feature[]) {
  return transcripts.some(t => hasIntrons([t])) || hasIntrons(transcripts)
}

// The answer the "Collapse introns" row is offered on. It belongs to the worker
// because only the worker holds the whole feature: the main thread sees the
// isoforms the trim kept and the parts the `subParts` slot drew, so a
// single-exon gene and a gene whose exons went undrawn look alike there.
export function collapsibleIntronsOf(feature: Feature) {
  return (
    offersCollapseIntrons(feature.get('type')) &&
    hasCollapsibleIntrons(getTranscripts(feature))
  )
}

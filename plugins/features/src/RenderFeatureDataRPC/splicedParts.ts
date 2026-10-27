import {
  isGeneLikeType,
  isSequenceMatchType,
  mergeIntervals,
} from '@jbrowse/core/util'

import { impliedUTRs } from './impliedUTRs.ts'
import { featureType, getSubfeatures, isCDS, isExon, isUTR } from './util.ts'

import type { Span } from '../shared/mergeSpans.ts'
import type { Feature } from '@jbrowse/core/util'

// The child shapes whose gaps are introns: exon/CDS on an annotation,
// match_part on a sequence alignment, and block on a BED12 the gene heuristic
// declined to promote — an unstranded one, or a track with
// `disableGeneHeuristic` set.
const SPLICED_PART_TYPES = new Set(['exon', 'cds', 'match_part', 'block'])

function isSplicedPartType(type: string | undefined) {
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

const spanOf = (f: Feature): Span => [f.get('start'), f.get('end')]

/**
 * A transcript's spliced parts, plus its UTRs where it names a CDS and no
 * exons: its CDS rows alone leave out the untranslated ends the track draws.
 */
export function transcribedSpans(transcript: Feature): Span[] {
  const subs = getSubfeatures(transcript)
  const parts = subs.filter(isSplicedPart).map(spanOf)
  return subs.some(isExon) || !subs.some(isCDS)
    ? parts
    : [
        ...parts,
        ...subs.filter(isUTR).map(spanOf),
        ...impliedUTRs(transcript, subs).map((u): Span => [u.start, u.end]),
      ]
}

export function exonIntervals(transcripts: Feature[]) {
  return transcripts.flatMap(transcribedSpans).map(([start, end]) => ({
    start,
    end,
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

/**
 * Whether "Collapse introns" has a gap to close on this feature. A gap alone is
 * not enough — a repeat_region's parts leave gaps too — so the type has to be
 * one whose parts introns separate: a gene or one of its transcripts, or a
 * sequence alignment, whose `match_part` children are the aligned blocks.
 */
export function collapsibleIntronsOf(feature: Feature) {
  const type = feature.get('type')
  return (
    (isGeneLikeType(type) || isSequenceMatchType(type)) &&
    hasCollapsibleIntrons(getTranscripts(feature))
  )
}

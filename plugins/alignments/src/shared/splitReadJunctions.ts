import { getClip } from '@jbrowse/cigar-utils'

import {
  forEachSAEntry,
  splitJoin,
} from '../features/sashimi/splitJunctions.ts'
import { isMismatchFeature } from './extractCigarFeatures.ts'
import { getMappingQuality, getStrand } from './util.ts'

import type { ArcSplitCategory } from '../features/arcs/arcSplitCategory.ts'
import type { SvChannel } from './readFieldLevels.ts'
import type { Feature } from '@jbrowse/core/util'

// A split class files with the pairs across the same junction, as
// `ARC_SPLIT_SWATCH` pairs them: duplication-type with RL, either inversion
// type with LL and RR pairs, and deletion-type with the stretched LR pairs of a
// deletion.
const CHANNEL_OF_SPLIT: Record<ArcSplitCategory, SvChannel> = {
  splitForward: 'LR',
  splitBack: 'RL',
  splitInvLL: 'inversion',
  splitInvRR: 'inversion',
}

/**
 * Which channel wins where one read's junctions, or one chain's records, name
 * several. A local event outranks a partner elsewhere: a long read through a
 * local event often carries a stray supplementary on a repeat elsewhere, which
 * would otherwise pull it out of the band its event fills.
 */
export const SV_CHANNEL_PRECEDENCE: readonly SvChannel[] = [
  'inversion',
  'RL',
  'LR',
  'svInsertion',
  'partnerElsewhere',
  'none',
]

export interface ReadPiece {
  refName: string
  start: number
  end: number
  strand: number
  clip: number
  placed: boolean
}

// Feet on one base: the read leaves the reference and comes back where it
// left, the bases between them inserted.
function sameReferenceChannel(a: ReadPiece, b: ReadPiece) {
  const join = splitJoin(a.strand, a.start, a.end, b.strand, b.start, b.end)
  return join === undefined
    ? undefined
    : join.category === undefined
      ? 'svInsertion'
      : CHANNEL_OF_SPLIT[join.category]
}

function junctionChannel(a: ReadPiece, b: ReadPiece) {
  return a.refName === b.refName
    ? sameReferenceChannel(a, b)
    : 'partnerElsewhere'
}

/**
 * One channel for a whole split read, from the junctions between its
 * read-adjacent pieces. A junction counts only between two placed pieces
 * (ADR-229): a MAPQ-0 piece joins nothing, and its neighbours are not joined
 * across it, since the molecule never made that junction. Every piece's SA tag
 * lists the others with their MAPQ, so each record of the read reaches the
 * same answer.
 */
export function splitReadChannel(pieces: ReadPiece[]) {
  const ordered = pieces.toSorted((a, b) => a.clip - b.clip)
  const seen = new Set<SvChannel>()
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1]!
    const b = ordered[i]!
    const channel = a.placed && b.placed ? junctionChannel(a, b) : undefined
    if (channel !== undefined) {
      seen.add(channel)
    }
  }
  return SV_CHANNEL_PRECEDENCE.find(c => seen.has(c))
}

function ownPiece(feature: Feature): ReadPiece {
  const strand = getStrand(feature)
  return {
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
    strand,
    clip: isMismatchFeature(feature)
      ? feature.clipLengthAtStartOfRead
      : getClip((feature.get('CIGAR') as string | undefined) ?? '', strand),
    placed: getMappingQuality(feature) !== 0,
  }
}

export function piecesOf(feature: Feature, sa: string) {
  const pieces = [ownPiece(feature)]
  forEachSAEntry(sa, (nameStart, nameEnd, start, end, strand, clip, mapq) => {
    pieces.push({
      refName: sa.slice(nameStart, nameEnd),
      start,
      end,
      strand,
      clip,
      placed: mapq !== 0,
    })
  })
  return pieces
}

/**
 * Whether a split read joins two read-adjacent placed pieces, the junction its
 * arcs draw and its SV channel files by: what makes it SV evidence (ADR-229).
 */
export function makesJunction(feature: Feature, sa: string) {
  return sa !== '' && splitReadChannel(piecesOf(feature, sa)) !== undefined
}

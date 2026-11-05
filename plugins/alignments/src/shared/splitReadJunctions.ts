import { getClip } from '@jbrowse/cigar-utils'

import {
  forEachSAEntry,
  splitJoin,
} from '../features/sashimi/splitJunctions.ts'
import { isMismatchFeature } from './extractCigarFeatures.ts'
import { getMappingQuality, getStrand } from './util.ts'

import type { ArcSplitCategory } from '../features/arcs/arcSplitCategory.ts'
import type { SvKind } from './readFieldLevels.ts'
import type { Feature } from '@jbrowse/core/util'

// A split class files with the pairs across the same junction, as
// `ARC_SPLIT_SWATCH` pairs them: duplication-type with RL, either inversion
// type with LL and RR pairs, and deletion-type with the LR pairs the aligner
// did not pair.
const KIND_OF_SPLIT: Record<ArcSplitCategory, SvKind> = {
  splitForward: 'deletionType',
  splitBack: 'duplicationType',
  splitInvLL: 'inversion',
  splitInvRR: 'inversion',
}

/**
 * Which kind wins where one read's junctions, or one chain's records, name
 * several. A local event outranks a partner elsewhere: a long read through a
 * local event often carries a stray supplementary on a repeat elsewhere, which
 * would otherwise pull it out of the band its event fills.
 */
export const SV_KIND_PRECEDENCE: readonly SvKind[] = [
  'inversion',
  'duplicationType',
  'deletionType',
  'insertion',
  'elsewhere',
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
function sameReferenceKind(a: ReadPiece, b: ReadPiece) {
  const join = splitJoin(a.strand, a.start, a.end, b.strand, b.start, b.end)
  return join === undefined
    ? undefined
    : join.category === undefined
      ? 'insertion'
      : KIND_OF_SPLIT[join.category]
}

function junctionKind(a: ReadPiece, b: ReadPiece) {
  return a.refName === b.refName ? sameReferenceKind(a, b) : 'elsewhere'
}

/**
 * One kind for a whole split read, from the junctions between its
 * read-adjacent pieces. A junction counts only between two placed pieces
 * (ADR-229): a MAPQ-0 piece joins nothing, and its neighbours are not joined
 * across it, since the molecule never made that junction. Every piece's SA tag
 * lists the others with their MAPQ, so each record of the read reaches the
 * same answer.
 */
export function splitReadKind(pieces: ReadPiece[]) {
  const ordered = pieces.toSorted((a, b) => a.clip - b.clip)
  const seen = new Set<SvKind>()
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1]!
    const b = ordered[i]!
    const kind = a.placed && b.placed ? junctionKind(a, b) : undefined
    if (kind !== undefined) {
      seen.add(kind)
    }
  }
  return SV_KIND_PRECEDENCE.find(c => seen.has(c))
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
 * arcs draw and its `svKind` band follows: what makes it SV evidence (ADR-229).
 */
export function makesJunction(feature: Feature, sa: string) {
  return sa !== '' && splitReadKind(piecesOf(feature, sa)) !== undefined
}

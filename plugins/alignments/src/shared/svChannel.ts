import {
  READ_DISCORDANT,
  READ_SV_DELETION,
  READ_SV_INSERTION,
  pairDirection,
  pairOrientationToNum,
  svSignalTier,
} from '@jbrowse/alignments-core'
import { getClip } from '@jbrowse/cigar-utils'

import {
  forEachSAEntry,
  splitJoin,
} from '../features/sashimi/splitJunctions.ts'
import { isMismatchFeature } from './extractCigarFeatures.ts'
import { SV_SIGNAL_OF_TIER } from './readFieldLevels.ts'
import { categoryBitsOf, saTagOf } from './splitAlignment.ts'
import { getFlags, getMappingQuality, getStrand } from './util.ts'

import type { ArcSplitCategory } from '../features/arcs/arcSplitCategory.ts'
import type { SvChannel } from './readFieldLevels.ts'
import type { PairDirection } from '@jbrowse/alignments-core'
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

const CHANNEL_OF_PAIR: Record<PairDirection, SvChannel> = {
  LR: 'LR',
  RL: 'RL',
  LL: 'inversion',
  RR: 'inversion',
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

function piecesOf(feature: Feature, sa: string) {
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

// A discordant pair files by its orientation; one with none has its mate
// unmapped or on another reference, which the arcs draw alike, as a tick.
function discordantPairChannel(orientation: string | undefined) {
  const direction = pairDirection(orientation)
  return direction === undefined
    ? 'partnerElsewhere'
    : CHANNEL_OF_PAIR[direction]
}

// A read with no split class, by the rest of its `svSignal` evidence, in the
// order `svSignalTier` ranks it: an SV-size indel, then a discordant pair. A
// read `svSignal` does not count, concordant pairs included, files as `none`.
function evidenceChannel(
  feature: Feature,
  sa: string,
  orientation: string | undefined,
) {
  const bits = categoryBitsOf(
    feature,
    getFlags(feature),
    sa,
    pairOrientationToNum(orientation),
  )
  return SV_SIGNAL_OF_TIER[svSignalTier(bits)] === 'none'
    ? 'none'
    : bits & READ_SV_DELETION
      ? 'LR'
      : bits & READ_SV_INSERTION
        ? 'svInsertion'
        : bits & READ_DISCORDANT
          ? discordantPairChannel(orientation)
          : 'none'
}

/**
 * A read's SV channel: the kind of SV its `svSignal` evidence points at
 * (ADR-229, ADR-258). A split read files by its junctions whether or not it is
 * paired, as its arcs color it: a supplementary's own pair orientation comes
 * from its own strand and would file an inverted piece apart from its primary.
 * Any other evidence files by its indel or its pair, and every read without
 * evidence, concordant pairs included, files as `none`, the depth baseline.
 */
export function svChannelOf(feature: Feature): SvChannel {
  const sa = saTagOf(feature)
  return (
    (sa === '' ? undefined : splitReadChannel(piecesOf(feature, sa))) ??
    evidenceChannel(
      feature,
      sa,
      feature.get('pair_orientation') as string | undefined,
    )
  )
}

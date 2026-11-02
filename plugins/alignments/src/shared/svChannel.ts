import {
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
import {
  getFlags,
  getMappingQuality,
  getMateRefName,
  getStrand,
} from './util.ts'

import type { ArcSplitCategory } from '../features/arcs/arcSplitCategory.ts'
import type { SvChannel } from './readFieldLevels.ts'
import type { PairDirection } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'

// A split class files with the pairs across the same junction: duplication-type
// with RL, either inversion type with LL and RR pairs, and deletion-type with
// LR, where a deletion's stretched pairs sit beside every concordant pair.
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

// Across one read's junctions. A junction on the read's own reference outranks
// one leaving it: a long read through a local event often carries a stray
// supplementary on a repeat elsewhere, which would otherwise pull it out of
// the band its event fills.
const READ_PRECEDENCE: readonly SvChannel[] = [
  'inversion',
  'RL',
  'LR',
  'svInsertion',
  'otherChromosome',
]

/**
 * Across a chain's members, the most specific first: LR also holds every
 * concordant pair, so it ranks below any channel only SV evidence reaches.
 */
export const CHAIN_PRECEDENCE: readonly SvChannel[] = [
  'inversion',
  'RL',
  'otherChromosome',
  'svInsertion',
  'LR',
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
    : 'otherChromosome'
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
  return READ_PRECEDENCE.find(c => seen.has(c))
}

function ownPiece(feature: Feature): ReadPiece {
  const strand = getStrand(feature)
  const mapq = getMappingQuality(feature)
  return {
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
    strand,
    clip: isMismatchFeature(feature)
      ? feature.clipLengthAtStartOfRead
      : getClip((feature.get('CIGAR') as string | undefined) ?? '', strand),
    placed: mapq !== 0,
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

// A read with no split class, by the rest of its `svSignal` evidence.
function evidenceChannel(feature: Feature, sa: string, orientation: number) {
  const bits = categoryBitsOf(feature, getFlags(feature), sa, orientation)
  const signal = SV_SIGNAL_OF_TIER[svSignalTier(bits)]
  const mateRefName = getMateRefName(feature)
  return signal === 'none'
    ? 'none'
    : bits & READ_SV_DELETION
      ? 'LR'
      : bits & READ_SV_INSERTION
        ? 'svInsertion'
        : mateRefName !== undefined && mateRefName !== feature.get('refName')
          ? 'otherChromosome'
          : 'none'
}

/**
 * A read's SV channel. A split read files by its junctions whether or not it
 * is paired, as its arcs color it: a supplementary's own pair orientation comes
 * from its own strand and would file an inverted piece apart from its primary.
 * Otherwise a pair files by its orientation, and any other read (unpaired, mate
 * unmapped, mate on another reference) by its own evidence, gated as
 * `svSignal` gates it (ADR-229).
 */
export function svChannelOf(feature: Feature): SvChannel {
  const sa = saTagOf(feature)
  const orientation = feature.get('pair_orientation') as string | undefined
  const direction = pairDirection(orientation)
  return (
    (sa === '' ? undefined : splitReadChannel(piecesOf(feature, sa))) ??
    (direction === undefined
      ? evidenceChannel(feature, sa, pairOrientationToNum(orientation))
      : CHANNEL_OF_PAIR[direction])
  )
}

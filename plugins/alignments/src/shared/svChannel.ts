import {
  READ_DISCORDANT,
  READ_SV_DELETION,
  READ_SV_INSERTION,
  pairDirection,
  pairOrientationToNum,
  svSignalTier,
} from '@jbrowse/alignments-core'

import { categoryBitsOf, saTagOf } from './splitAlignment.ts'
import { piecesOf, splitReadChannel } from './splitReadJunctions.ts'
import { getFlags } from './util.ts'

import type { SvChannel } from './readFieldLevels.ts'
import type { PairDirection } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'

const CHANNEL_OF_PAIR: Record<PairDirection, SvChannel> = {
  LR: 'LR',
  RL: 'RL',
  LL: 'inversion',
  RR: 'inversion',
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
  return svSignalTier(bits) === 0
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

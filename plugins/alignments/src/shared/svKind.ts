import {
  READ_DISCORDANT,
  READ_SV_DELETION,
  READ_SV_INSERTION,
  pairDirection,
  pairOrientationToNum,
  svSignalTier,
} from '@jbrowse/alignments-core'

import { classifyInsertSize } from './insertSizeStats.ts'
import { categoryBitsOf, saTagOf } from './splitAlignment.ts'
import { piecesOf, splitReadKind } from './splitReadJunctions.ts'
import { getFlags } from './util.ts'

import type { InsertSizeBand } from './insertSizeStats.ts'
import type { SvKind } from './readFieldLevels.ts'
import type { PairDirection } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'

const KIND_OF_PAIR: Record<PairDirection, SvKind> = {
  LR: 'deletionType',
  RL: 'duplicationType',
  LL: 'inversion',
  RR: 'inversion',
}

function isTooClose(feature: Feature, band: InsertSizeBand | undefined) {
  return (
    classifyInsertSize(
      Math.abs((feature.get('template_length') as number | undefined) ?? 0),
      band,
    ) === 'short'
  )
}

// A discordant pair files by its orientation, and an LR pair the insert-size
// band calls short as an insertion: its mates sit closer than the library's
// fragments because the reference lacks the bases between them. One with no
// orientation has its mate unmapped or on another reference, which the arcs
// draw alike, as a tick.
function discordantPairKind(
  feature: Feature,
  orientation: string | undefined,
  band: InsertSizeBand | undefined,
) {
  const direction = pairDirection(orientation)
  return direction === undefined
    ? 'elsewhere'
    : direction === 'LR' && isTooClose(feature, band)
      ? 'insertion'
      : KIND_OF_PAIR[direction]
}

// A read with no split class, by the rest of its `svSignal` evidence, in the
// order `svSignalTier` ranks it: an SV-size indel, then a discordant pair. A
// read `svSignal` does not count, concordant pairs included, files as `none`.
function evidenceKind(
  feature: Feature,
  sa: string,
  orientation: string | undefined,
  band: InsertSizeBand | undefined,
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
      ? 'deletionType'
      : bits & READ_SV_INSERTION
        ? 'insertion'
        : bits & READ_DISCORDANT
          ? discordantPairKind(feature, orientation, band)
          : 'none'
}

/**
 * A read's `svKind`: the kind of SV its `svSignal` evidence points at
 * (ADR-229, ADR-258). A split read files by its junctions whether or not it is
 * paired, as its arcs color it: a supplementary's own pair orientation comes
 * from its own strand and would file an inverted piece apart from its primary.
 * Any other evidence files by its indel or its pair, an LR pair by `band`, the
 * insert sizes its colors read, and every read without evidence, concordant
 * pairs included, files as `none`, the depth baseline.
 */
export function svKindOf(
  feature: Feature,
  band: InsertSizeBand | undefined,
): SvKind {
  const sa = saTagOf(feature)
  return (
    (sa === '' ? undefined : splitReadKind(piecesOf(feature, sa))) ??
    evidenceKind(
      feature,
      sa,
      feature.get('pair_orientation') as string | undefined,
      band,
    )
  )
}

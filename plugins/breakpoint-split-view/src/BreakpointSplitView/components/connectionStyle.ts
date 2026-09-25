import {
  CONNECTION_LABELS,
  SPLIT_JUNCTION_LABELS,
  splitJunctionKind,
} from '@jbrowse/alignments-core'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import {
  alpha,
  colorInterchrom,
  colorLongInsert,
  colorSplitReadInversion,
} from '@jbrowse/core/ui/palette'

import type { ConnectionKind, PairDirection } from '@jbrowse/alignments-core'

// Every connector this view draws is evidence — a pair the aligner did not
// call proper, or a split read — so the kinds the pileup draws in its faded
// concordant grey and its pale supplementary orange take long-insert red here.
export function connectionKind({
  isSplit,
  interchrom,
  pairDirection,
  s1,
  s2,
}: {
  isSplit: boolean
  interchrom: boolean
  pairDirection: PairDirection | undefined
  s1: number
  s2: number
}): ConnectionKind {
  if (interchrom) {
    return 'interchrom'
  } else if (isSplit) {
    const kind = splitJunctionKind(s1, s2)
    return kind === 'inversion'
      ? 'splitInversion'
      : kind === 'deletion'
        ? 'splitDeletion'
        : 'readPair'
  } else {
    return pairDirection ? `pair${pairDirection}` : 'readPair'
  }
}

export function isAbnormalConnection(kind: ConnectionKind) {
  return (
    kind === 'pairRL' ||
    kind === 'pairRR' ||
    kind === 'pairLL' ||
    kind === 'splitInversion'
  )
}

export function connectionColor(
  kind: ConnectionKind,
  alignmentFill: Record<'pairRL' | 'pairRR' | 'pairLL', string>,
) {
  switch (kind) {
    case 'readPair':
    case 'pairLR':
    case 'splitDeletion':
      return colorLongInsert
    case 'pairRL':
    case 'pairRR':
    case 'pairLL':
      return alignmentFill[kind]
    case 'splitInversion':
      return colorSplitReadInversion
    case 'interchrom':
      return colorInterchrom
  }
}

export function useConnectionStyle() {
  const palette = usePalette()
  return (kind: ConnectionKind, isSplit: boolean) => ({
    abnormal: isAbnormalConnection(kind),
    color: alpha(connectionColor(kind, palette.alignmentFill), 0.8),
    label:
      kind === 'interchrom' && isSplit
        ? SPLIT_JUNCTION_LABELS.interchrom
        : CONNECTION_LABELS[kind],
  })
}

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

function colorSlot(kind: ConnectionKind) {
  return kind === 'readPair' || kind === 'pairLR' || kind === 'splitDeletion'
    ? 'longInsert'
    : kind
}

export function connectionColor(
  kind: ConnectionKind,
  alignmentFill: Record<'pairRL' | 'pairRR' | 'pairLL', string>,
) {
  const slot = colorSlot(kind)
  switch (slot) {
    case 'longInsert':
      return colorLongInsert
    case 'pairRL':
    case 'pairRR':
    case 'pairLL':
      return alignmentFill[slot]
    case 'splitInversion':
      return colorSplitReadInversion
    case 'interchrom':
      return colorInterchrom
  }
}

// An LR pair reaches this view only without the proper-pair flag, so the
// display's "Normal pair orientation" would misname it.
export function connectionLabel(kind: ConnectionKind, isSplit: boolean) {
  return kind === 'interchrom' && isSplit
    ? SPLIT_JUNCTION_LABELS.interchrom
    : kind === 'pairLR'
      ? 'LR - Not a proper pair'
      : CONNECTION_LABELS[kind]
}

export function useConnectionStyle() {
  const palette = usePalette()
  return (kind: ConnectionKind, isSplit: boolean) => ({
    abnormal: isAbnormalConnection(kind),
    color: alpha(connectionColor(kind, palette.alignmentFill), 0.8),
    label: connectionLabel(kind, isSplit),
  })
}

export interface KeyEntry {
  kind: ConnectionKind
  isSplit: boolean
}

// One row per colour: kinds that share a swatch share a row, their labels
// joined.
export function connectionKeyRows(entries: KeyEntry[]) {
  const rows = new Map<string, { kind: ConnectionKind; labels: string[] }>()
  for (const { kind, isSplit } of entries) {
    const label = connectionLabel(kind, isSplit)
    const row = rows.get(colorSlot(kind))
    if (row) {
      row.labels.push(label)
    } else {
      rows.set(colorSlot(kind), { kind, labels: [label] })
    }
  }
  return [...rows.values()]
}

export function useConnectionKeyRows(entries: KeyEntry[]) {
  const connectionStyle = useConnectionStyle()
  return connectionKeyRows(entries).map(({ kind, labels }) => ({
    key: kind,
    color: connectionStyle(kind, false).color,
    label: labels.join(' / '),
  }))
}

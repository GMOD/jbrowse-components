import {
  CONNECTION_LABELS,
  isAbnormalConnection,
} from '@jbrowse/alignments-core'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import {
  alpha,
  colorInterchrom,
  colorLongInsert,
  colorSplitReadInversion,
} from '@jbrowse/core/ui/palette'

import type { ConnectionKind } from '@jbrowse/alignments-core'

// Every connector this view draws is evidence — a pair the aligner did not
// call proper, or a split read — so the kinds the pileup draws in its faded
// concordant grey and its pale supplementary orange take long-insert red here.
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
export function connectionLabel(kind: ConnectionKind) {
  return kind === 'pairLR' ? 'LR - Not a proper pair' : CONNECTION_LABELS[kind]
}

export function useConnectionStyle() {
  const palette = usePalette()
  return (kind: ConnectionKind) => ({
    abnormal: isAbnormalConnection(kind),
    color: alpha(connectionColor(kind, palette.alignmentFill), 0.8),
    label: connectionLabel(kind),
  })
}

// One row per colour: kinds that share a swatch share a row, their labels
// joined.
export function connectionKeyRows(kinds: ConnectionKind[]) {
  const rows = new Map<string, { kind: ConnectionKind; labels: string[] }>()
  for (const kind of kinds) {
    const row = rows.get(colorSlot(kind))
    if (row) {
      row.labels.push(connectionLabel(kind))
    } else {
      rows.set(colorSlot(kind), { kind, labels: [connectionLabel(kind)] })
    }
  }
  return [...rows.values()]
}

export function useConnectionKeyRows(kinds: ConnectionKind[]) {
  const connectionStyle = useConnectionStyle()
  return connectionKeyRows(kinds).map(({ kind, labels }) => ({
    key: kind,
    color: connectionStyle(kind).color,
    label: labels.join(' / '),
  }))
}

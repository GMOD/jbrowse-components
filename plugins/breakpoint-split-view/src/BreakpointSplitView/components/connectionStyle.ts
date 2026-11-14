import { CONNECTION_LABELS } from '@jbrowse/alignments-core'
import { alpha } from '@jbrowse/core/ui/palette'
import {
  THROUGH_HIDDEN_LABEL,
  throughHiddenKeyLabel,
  throughHiddenRefNames,
} from '@jbrowse/sv-core'

import type { ConnectionKind } from '@jbrowse/alignments-core'

/** The opacity a connector curve and its key swatch draw at. */
export const CONNECTION_ALPHA = 0.8

const KIND_ORDER = Object.keys(CONNECTION_LABELS) as ConnectionKind[]

export interface StyledConnection {
  kind: ConnectionKind
  color: string
  label: string
  hiddenSegments?: readonly { refName: string }[]
}

// One row per color, since kinds that share a swatch read as one meaning,
// their labels joined; rows in CONNECTION_LABELS order of their first kind.
// The connections through segments not in view key one row of their own,
// last, naming the refNames they pass through.
export function connectionKeyRows(styled: Iterable<StyledConnection>) {
  const rows = new Map<string, { kind: ConnectionKind; labels: string[] }>()
  const throughHidden: StyledConnection[] = []
  for (const connection of styled) {
    const { kind, color, label, hiddenSegments } = connection
    if (hiddenSegments?.length) {
      throughHidden.push(connection)
    } else {
      const row = rows.get(color)
      if (!row) {
        rows.set(color, { kind, labels: [label] })
      } else {
        if (!row.labels.includes(label)) {
          row.labels.push(label)
        }
        if (KIND_ORDER.indexOf(kind) < KIND_ORDER.indexOf(row.kind)) {
          row.kind = kind
        }
      }
    }
  }
  const first = throughHidden[0]
  return [
    ...[...rows]
      .sort(
        ([, a], [, b]) =>
          KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
      )
      .map(([color, { labels }]) => ({
        key: color,
        color: alpha(color, CONNECTION_ALPHA),
        label: labels.join(' / '),
      })),
    ...(first
      ? [
          {
            key: THROUGH_HIDDEN_LABEL,
            color: alpha(first.color, CONNECTION_ALPHA),
            label: throughHiddenKeyLabel(
              throughHiddenRefNames(throughHidden.map(c => c.hiddenSegments)),
            ),
          },
        ]
      : []),
  ]
}

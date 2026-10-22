import { CONNECTION_LABELS } from '@jbrowse/alignments-core'
import { alpha } from '@jbrowse/core/ui/palette'

import type { ConnectionKind } from '@jbrowse/alignments-core'

/** The opacity a connector curve and its key swatch draw at. */
export const CONNECTION_ALPHA = 0.8

const KIND_ORDER = Object.keys(CONNECTION_LABELS) as ConnectionKind[]

export interface StyledConnection {
  kind: ConnectionKind
  color: string
  label: string
}

// One row per color, since kinds that share a swatch read as one meaning,
// their labels joined; rows in CONNECTION_LABELS order of their first kind.
export function connectionKeyRows(styled: Iterable<StyledConnection>) {
  const rows = new Map<string, { kind: ConnectionKind; labels: string[] }>()
  for (const { kind, color, label } of styled) {
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
  return [...rows]
    .sort(
      ([, a], [, b]) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
    )
    .map(([color, { labels }]) => ({
      key: color,
      color: alpha(color, CONNECTION_ALPHA),
      label: labels.join(' / '),
    }))
}

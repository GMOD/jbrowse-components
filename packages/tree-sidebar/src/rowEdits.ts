import { isCssColor } from '@jbrowse/core/util/cssColorParse'

/** What a dialog row says beyond what the adapter supplied. */
export interface RowEdit {
  label?: string
  color?: string
}

/**
 * What the arrangement dialog's submit writes to `rows.labels` and the
 * display's colour pairs: the config's entries as they stand, with the rows the
 * dialog showed written over them. A row the dialog never showed keeps its
 * entry, so a submit over a window holding a fraction of the rows leaves the
 * rest of a declared map standing. A colour the painters cannot parse is left
 * out. The pairs keep the config.json's order first, so a submit that changes
 * no colour writes the declared pairs back unchanged.
 */
export function rowEdits<S extends { name: string }>({
  rows,
  labels: liveLabels,
  colors: liveColors,
  baseOrder,
  edited,
}: {
  rows: readonly S[]
  labels: Readonly<Record<string, string>>
  colors: ReadonlyMap<string, string>
  baseOrder: readonly string[]
  edited: (row: S) => RowEdit
}): {
  labels: Record<string, string>
  rowColor: { domain: string[]; range: string[] }
} {
  const shown = new Set(rows.map(row => row.name))
  const labels = Object.fromEntries(
    Object.entries(liveLabels).filter(([name]) => !shown.has(name)),
  )
  const colors = new Map([...liveColors].filter(([name]) => !shown.has(name)))
  for (const row of rows) {
    const { label, color } = edited(row)
    if (label !== undefined) {
      labels[row.name] = label
    }
    if (color !== undefined && isCssColor(color)) {
      colors.set(row.name, color)
    }
  }
  const domain = [
    ...new Set([...baseOrder, ...liveColors.keys(), ...colors.keys()]),
  ].filter(name => colors.has(name))
  return {
    labels,
    rowColor: { domain, range: domain.map(name => colors.get(name)!) },
  }
}

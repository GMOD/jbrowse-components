import { isCssColor } from '@jbrowse/core/util/cssColorParse'

import type { IdentityChannel, RowAlias } from './arrangeRows.ts'
import type { RowSource } from './types.ts'

/**
 * What the arrangement dialog's submit writes to `rows.labels` and the
 * `rowColor` pairs: the config's entries, with each row the reader changed
 * written over them. A row's value is its label, and its colour on the
 * display's identity channel.
 *
 * An entry the config holds stands unless the reader changed that row's
 * value, so a submit that changes nothing writes the config back as it was,
 * even where an entry repeats the adapter's value. A changed value is stored,
 * or, where it is what the row shows with no entry of its own (its alias's
 * entry, else the adapter's), its entry is removed. A row the dialog never
 * showed keeps its entry, a dialog row the current rows no longer hold writes
 * nothing, and a colour the painters cannot parse is not stored. The pairs
 * keep the config.json's order first.
 */
export function rowEdits<S extends RowSource>({
  rows,
  shown,
  adapter,
  labels,
  colors,
  baseOrder,
  identityChannel,
  rowAlias,
}: {
  rows: readonly S[]
  shown: readonly S[]
  adapter: readonly S[]
  labels: Readonly<Record<string, string>>
  colors: ReadonlyMap<string, string>
  baseOrder: readonly string[]
  identityChannel: IdentityChannel
  rowAlias: RowAlias | undefined
}): {
  labels: Record<string, string>
  rowColor: { domain: string[]; range: string[] }
} {
  const before = new Map(shown.map(row => [row.name, row]))
  const fromAdapter = new Map(adapter.map(row => [row.name, row]))
  const nextLabels = new Map(Object.entries(labels))
  const nextColors = new Map(colors)
  for (const row of rows) {
    const seed = before.get(row.name)
    if (!seed) {
      continue
    }
    const own = fromAdapter.get(row.name)
    const alias = rowAlias?.(row.name)
    const other = alias === row.name ? undefined : alias
    if (row.label !== seed.label) {
      const fallback =
        other !== undefined && Object.hasOwn(labels, other)
          ? labels[other]
          : own?.label
      nextLabels.delete(row.name)
      if (row.label !== undefined && row.label !== fallback) {
        nextLabels.set(row.name, row.label)
      }
    }
    const color = row[identityChannel]
    if (color !== seed[identityChannel]) {
      const fallback =
        (other === undefined ? undefined : colors.get(other)) ??
        own?.[identityChannel]
      nextColors.delete(row.name)
      if (color !== undefined && color !== fallback && isCssColor(color)) {
        nextColors.set(row.name, color)
      }
    }
  }
  const domain = [
    ...new Set([...baseOrder, ...colors.keys(), ...nextColors.keys()]),
  ].filter(name => nextColors.has(name))
  return {
    labels: Object.fromEntries(nextLabels),
    rowColor: { domain, range: domain.map(name => nextColors.get(name)!) },
  }
}

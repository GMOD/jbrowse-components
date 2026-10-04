import type { RowAlias } from './arrangeRows.ts'
import type { RowSource } from './types.ts'

/**
 * What the arrangement dialog's submit writes to `rows.labels`: the config's
 * entries, with each row the reader relabelled written over them.
 *
 * An entry the config holds stands unless the reader changed that row's
 * label, so a submit that changes nothing writes the config back as it was,
 * even where an entry repeats the adapter's label. A changed label is stored,
 * or, where it is what the row shows with no entry of its own (its alias's
 * entry, else the adapter's label), its entry is removed. A row the dialog
 * never showed keeps its entry, and a dialog row the current rows no longer
 * hold writes nothing.
 */
export function labelEdits<S extends RowSource>({
  rows,
  shown,
  adapter,
  labels,
  rowAlias,
}: {
  rows: readonly S[]
  shown: readonly S[]
  adapter: readonly S[]
  labels: Readonly<Record<string, string>>
  rowAlias: RowAlias | undefined
}): Record<string, string> {
  const before = new Map(shown.map(row => [row.name, row]))
  const fromAdapter = new Map(adapter.map(row => [row.name, row]))
  const next = new Map(Object.entries(labels))
  for (const row of rows) {
    const seed = before.get(row.name)
    if (!seed || row.label === seed.label) {
      continue
    }
    const alias = rowAlias?.(row.name)
    const other = alias === row.name ? undefined : alias
    const fallback =
      other !== undefined && Object.hasOwn(labels, other)
        ? labels[other]
        : fromAdapter.get(row.name)?.label
    next.delete(row.name)
    if (row.label !== undefined && row.label !== fallback) {
      next.set(row.name, row.label)
    }
  }
  return Object.fromEntries(next)
}

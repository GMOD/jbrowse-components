import TableCheckbox from './TableCheckbox.tsx'
import { CHECKBOX_WIDTH } from './tableStyles.ts'

import type { VirtualTableLeading } from './VirtualTable.tsx'

/**
 * A leading checkbox column over a selection of row ids: a box per row, and a
 * header box that selects or clears the rows on show, leaving the selection
 * of rows a search hides as it was.
 */
export function checkboxLeading<R extends { id: string | number }>({
  selected,
  onChange,
  label,
  allLabel,
}: {
  selected: ReadonlySet<R['id']>
  onChange: (next: Set<R['id']>) => void
  /** names a row's box */
  label: (row: R) => string
  /** names the header's box */
  allLabel: string
}) {
  return {
    width: CHECKBOX_WIDTH,
    header: rows => {
      const all = rows.length > 0 && rows.every(row => selected.has(row.id))
      const some = rows.some(row => selected.has(row.id))
      return (
        <TableCheckbox
          checked={all}
          indeterminate={some && !all}
          label={allLabel}
          onChange={() => {
            const next = new Set(selected)
            for (const row of rows) {
              if (all) {
                next.delete(row.id)
              } else {
                next.add(row.id)
              }
            }
            onChange(next)
          }}
        />
      )
    },
    cell: row => (
      <TableCheckbox
        checked={selected.has(row.id)}
        label={label(row)}
        onChange={() => {
          const next = new Set(selected)
          if (next.has(row.id)) {
            next.delete(row.id)
          } else {
            next.add(row.id)
          }
          onChange(next)
        }}
      />
    ),
  } satisfies VirtualTableLeading<R>
}

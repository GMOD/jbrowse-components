import { SanitizedHTML } from '@jbrowse/core/ui'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'

import type { GridColDef } from '@mui/x-data-grid'

/**
 * The colors pinned on rows, which the swatch column edits: the colors
 * picked by row name, and what a pick writes.
 */
export interface EachRowPicks {
  picks: ReadonlyMap<string, string>
  onPick: (picked: ReadonlyMap<string, string>) => void
}

export function buildSourceColumns<S extends { name: string }>({
  colors,
  eachRow,
  extras,
  rows,
  cellClassName,
}: {
  colors: ReadonlyMap<string, string>
  eachRow: EachRowPicks
  extras: string[]
  rows: S[]
  cellClassName: string
}): GridColDef<S>[] {
  return [
    {
      field: 'rowColorSwatch',
      headerName: 'Color',
      width: 70,
      sortable: false,
      renderCell: ({ row }) => (
        <PopoverPicker
          color={colors.get(row.name) ?? 'auto'}
          unset={!eachRow.picks.has(row.name)}
          onChange={next => {
            eachRow.onPick(new Map([[row.name, next]]))
          }}
        />
      ),
    } satisfies GridColDef<S>,
    {
      field: 'name',
      headerName: 'Name',
      width: measureGridWidth(rows.map(r => r.name)),
    },
    ...extras.map(
      field =>
        ({
          field,
          renderCell: ({ value }) => (
            <div className={cellClassName}>
              <SanitizedHTML html={getStr(value ?? '')} />
            </div>
          ),
          width: measureGridWidth(
            rows.map(r => getStr((r as Record<string, unknown>)[field] ?? '')),
          ),
        }) satisfies GridColDef<S>,
    ),
  ]
}

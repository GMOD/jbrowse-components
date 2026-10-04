import { SanitizedHTML } from '@jbrowse/core/ui'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'

import type { GridColDef } from '@mui/x-data-grid'

/**
 * Each Row's picks, which the swatch column edits: the colours picked by row
 * name, and what a pick writes.
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
  eachRow?: EachRowPicks
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
      renderCell: ({ row }) => {
        const color = colors.get(row.name)
        return eachRow ? (
          <PopoverPicker
            color={color ?? 'auto'}
            unset={!eachRow.picks.has(row.name)}
            onChange={next => {
              eachRow.onPick(new Map([[row.name, next]]))
            }}
          />
        ) : color ? (
          <span
            data-testid="row-color-swatch"
            title="Pick a row's color under Each row"
            style={{
              display: 'inline-block',
              width: 24,
              height: 14,
              verticalAlign: 'middle',
              background: color,
            }}
          />
        ) : null
      },
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

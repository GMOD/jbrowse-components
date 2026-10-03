import { SanitizedHTML } from '@jbrowse/core/ui'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'

import { updateRows } from '../sourcesGridUtils.ts'

import type { GridColDef } from '@mui/x-data-grid'

export function buildSourceColumns<
  S extends { name: string; rowColor?: string },
>({
  editsColor,
  swatchOf,
  extras,
  rows,
  onChange,
  cellClassName,
}: {
  editsColor: boolean
  swatchOf?: (row: S) => string | undefined
  extras: string[]
  rows: S[]
  onChange: (arg: S[]) => void
  cellClassName: string
}): GridColDef<S>[] {
  return [
    ...(swatchOf
      ? [
          {
            field: 'rowColorSwatch',
            headerName: 'Color',
            width: 70,
            sortable: false,
            renderCell: ({ row }) => {
              const color = swatchOf(row)
              return color ? (
                <span
                  data-testid="row-color-swatch"
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
        ]
      : []),
    ...(editsColor
      ? [
          {
            field: 'rowColor',
            headerName: 'Color',
            width: 100,
            renderCell: ({ value, id }) => (
              <PopoverPicker
                // Unset rows show an "auto" swatch, so the grid never
                // misrepresents on-screen state with a placeholder color.
                color={value || 'auto'}
                unset={!value}
                onChange={color => {
                  onChange(
                    updateRows(rows, [id], {
                      rowColor: color,
                    } as Partial<S>),
                  )
                }}
              />
            ),
          } satisfies GridColDef<S>,
        ]
      : []),
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

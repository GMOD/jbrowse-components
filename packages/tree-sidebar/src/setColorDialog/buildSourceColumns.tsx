import { SanitizedHTML } from '@jbrowse/core/ui'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'

import { updateRows } from '../sourcesGridUtils.ts'

import type { ColorColumn } from './SourceGrid.tsx'
import type { GridColDef } from '@mui/x-data-grid'

export function buildSourceColumns<S extends { name: string; color?: string }>({
  colorColumn,
  extras,
  rows,
  onChange,
  cellClassName,
}: {
  colorColumn: ColorColumn<S> | undefined
  extras: string[]
  rows: S[]
  onChange: (arg: S[]) => void
  cellClassName: string
}): GridColDef<S>[] {
  return [
    ...(colorColumn
      ? [
          {
            field: colorColumn.field,
            headerName: colorColumn.headerName,
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
                      [colorColumn.field]: color,
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

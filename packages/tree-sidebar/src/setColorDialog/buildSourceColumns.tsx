import { SanitizedHTML } from '@jbrowse/core/ui'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'

import { updateRows } from '../sourcesGridUtils.ts'

import type { ColorColumn } from './SourceGrid.tsx'
import type { GridColDef } from '@mui/x-data-grid'

export function buildSourceColumns<S extends { name: string; color?: string }>({
  colorColumns,
  extras,
  rows,
  onChange,
  cellClassName,
}: {
  colorColumns: ColorColumn<S>[]
  extras: string[]
  rows: S[]
  onChange: (arg: S[]) => void
  cellClassName: string
}): GridColDef<S>[] {
  return [
    ...colorColumns.map(
      c =>
        ({
          field: c.field,
          headerName: c.headerName,
          width: 100,
          renderCell: ({ value, id }) => (
            <PopoverPicker
              // Unset rows show the effective color they actually render with
              // (auto), so the swatch never misrepresents on-screen state.
              color={value || c.defaultColor || 'auto'}
              unset={!value}
              onChange={color => {
                onChange(
                  updateRows(rows, [id], { [c.field]: color } as Partial<S>),
                )
              }}
            />
          ),
        }) satisfies GridColDef<S>,
    ),
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
              <SanitizedHTML html={getStr(value)} />
            </div>
          ),
          width: measureGridWidth(
            rows.map(r => `${(r as Record<string, unknown>)[field] ?? ''}`),
          ),
        }) satisfies GridColDef<S>,
    ),
  ]
}

import { ActionLink } from '@jbrowse/core/ui'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { HIGHLIGHT_ALPHA } from '../model.ts'
import { colWidth } from '../utils.ts'

import type {
  GridApi,
  GridCellParams,
  GridColDef,
  GridRenderCellParams,
  GridValidRowModel,
} from '@mui/x-data-grid'

// tighter than MUI's "compact" density (36px) for the narrow sidebar; still
// clears the 24px color swatch
export const COMPACT_ROW_HEIGHT = 32

// shared by both the bookmark and highlight grids, which differ only in how
// their location links navigate and where their color lives. The `cell` class
// is consumed cross-file (the lint rule only checks same-file usage)
export const useCellStyles = makeStyles()({
  // eslint-disable-next-line tss-unused-classes/unused-classes
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

// single-click to edit the label, but only from view mode (else MUI throws
// because the cell is already transitioning into/out of edit mode)
export function startLabelEditOnClick(apiRef: { current: GridApi | null }) {
  return (params: GridCellParams) => {
    if (params.field === 'label' && params.cellMode === 'view') {
      apiRef.current?.startCellEditMode({ id: params.id, field: 'label' })
    }
  }
}

export function locationColumn<R extends GridValidRowModel>(
  cellClass: string,
  headerName: string,
  onNavigate: (row: R) => void,
): GridColDef<R> {
  return {
    field: 'locString',
    headerName,
    flex: 1.5,
    minWidth: 100,
    renderCell: ({ value, row }: GridRenderCellParams<R>) => (
      <ActionLink
        className={cellClass}
        title={value}
        onClick={() => {
          onNavigate(row)
        }}
      >
        {value}
      </ActionLink>
    ),
  }
}

export function labelColumn<R extends GridValidRowModel>(
  cellClass: string,
): GridColDef<R> {
  return {
    field: 'label',
    headerName: 'Label',
    editable: true,
    flex: 1,
    minWidth: 80,
    renderCell: ({ value }: GridRenderCellParams<R>) =>
      value ? (
        <span className={cellClass} title={value}>
          {value}
        </span>
      ) : (
        <span style={{ color: 'grey', fontStyle: 'italic' }}>Add label...</span>
      ),
  }
}

// hide the redundant Assembly column when every visible row shares one assembly
// (the common case, already reflected by the header selector). Returns 0 or 1
// columns so it spreads cleanly into the column list
export function assemblyColumn<R extends GridValidRowModel>(
  assemblyNames: string[],
): GridColDef<R>[] {
  return new Set(assemblyNames).size > 1
    ? [
        {
          field: 'assemblyName',
          headerName: 'Assembly',
          width: colWidth('Assembly', assemblyNames),
        },
      ]
    : []
}

export function colorColumn<R extends GridValidRowModel>(
  field: string,
  getColor: (row: R) => string,
  onChange: (row: R, color: string) => void,
): GridColDef<R> {
  return {
    field,
    headerName: 'Color',
    width: 50,
    renderCell: ({ row }: GridRenderCellParams<R>) => (
      <PopoverPicker
        color={getColor(row)}
        presetAlpha={HIGHLIGHT_ALPHA}
        onChange={color => {
          onChange(row, color)
        }}
      />
    ),
  }
}

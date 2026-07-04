import { type ComponentType, lazy } from 'react'

// Every entry lazy-loads the same '@mui/x-data-grid' chunk and picks one named
// export off it, so they're generated from a name list rather than written out
// 45 times. The static import specifier means webpack still emits a single
// x-data-grid chunk shared by all entries.
const names = [
  'DataGrid',
  'GridActionsCellItem',
  'GridAddIcon',
  'GridArrowDownwardIcon',
  'GridArrowUpwardIcon',
  'GridCellCheckboxForwardRef',
  'GridCellCheckboxRenderer',
  'GridCheckCircleIcon',
  'GridCheckIcon',
  'GridCloseIcon',
  'GridColumnHeaderSeparator',
  'GridColumnHeaderSortIcon',
  'GridColumnIcon',
  'GridColumnMenu',
  'GridColumnMenuContainer',
  'GridDragIcon',
  'GridExpandMoreIcon',
  'GridFilterAltIcon',
  'GridFilterForm',
  'GridFilterListIcon',
  'GridFilterPanel',
  'GridFooter',
  'GridFooterContainer',
  'GridHeader',
  'GridHeaderCheckbox',
  'GridKeyboardArrowRight',
  'GridLoadIcon',
  'GridLoadingOverlay',
  'GridMenuIcon',
  'GridMoreVertIcon',
  'GridNoRowsOverlay',
  'GridOverlay',
  'GridPagination',
  'GridPanel',
  'GridPanelWrapper',
  'GridRemoveIcon',
  'GridRoot',
  'GridRowCount',
  'GridSearchIcon',
  'GridSelectedRowCount',
  'GridSeparatorIcon',
  'GridTableRowsIcon',
  'GridToolbarExportContainer',
  'GridTripleDotsVerticalIcon',
  'GridViewHeadlineIcon',
  'GridViewStreamIcon',
]

export const DataGridEntries: Record<
  string,
  ComponentType<any>
> = Object.fromEntries(
  names.map(name => [
    name,
    lazy(() =>
      import('@mui/x-data-grid').then(m => ({
        default: (m as unknown as Record<string, ComponentType<any>>)[name]!,
      })),
    ),
  ]),
)

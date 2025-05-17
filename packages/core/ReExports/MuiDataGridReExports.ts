import { type LazyExoticComponent, lazy } from 'react'

export const DataGridEntries: Record<string, LazyExoticComponent<any>> = {
  DataGrid: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.DataGrid })),
  ),
  GridActionsCellItem: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridActionsCellItem,
    })),
  ),
  GridAddIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridAddIcon,
    })),
  ),
  GridArrowDownwardIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridArrowDownwardIcon,
    })),
  ),
  GridArrowUpwardIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridArrowUpwardIcon,
    })),
  ),
  GridCellCheckboxForwardRef: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCellCheckboxForwardRef,
    })),
  ),
  GridCellCheckboxRenderer: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCellCheckboxRenderer,
    })),
  ),
  GridCheckCircleIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCheckCircleIcon,
    })),
  ),
  GridCheckIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCheckIcon,
    })),
  ),
  GridCloseIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCloseIcon,
    })),
  ),
  GridColumnHeaderSeparator: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnHeaderSeparator,
    })),
  ),
  GridColumnHeaderSortIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnHeaderSortIcon,
    })),
  ),
  GridColumnIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnIcon,
    })),
  ),
  GridColumnMenu: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnMenu,
    })),
  ),
  GridColumnMenuContainer: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnMenuContainer,
    })),
  ),
  GridDragIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridDragIcon,
    })),
  ),
  GridExpandMoreIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridExpandMoreIcon,
    })),
  ),
  GridFilterAltIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFilterAltIcon,
    })),
  ),
  GridFilterForm: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFilterForm,
    })),
  ),
  GridFilterListIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFilterListIcon,
    })),
  ),
  GridFilterPanel: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFilterPanel,
    })),
  ),
  GridFooter: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.GridFooter })),
  ),
  GridFooterContainer: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFooterContainer,
    })),
  ),
  GridHeader: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.GridHeader })),
  ),
  GridHeaderCheckbox: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridHeaderCheckbox,
    })),
  ),
  GridKeyboardArrowRight: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridKeyboardArrowRight,
    })),
  ),
  GridLoadIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridLoadIcon,
    })),
  ),
  GridLoadingOverlay: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridLoadingOverlay,
    })),
  ),
  GridMenuIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridMenuIcon,
    })),
  ),
  GridMoreVertIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridMoreVertIcon,
    })),
  ),
  GridNoRowsOverlay: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridNoRowsOverlay,
    })),
  ),
  GridOverlay: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridOverlay,
    })),
  ),
  GridPagination: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridPagination,
    })),
  ),
  GridPanel: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.GridPanel })),
  ),
  GridPanelWrapper: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridPanelWrapper,
    })),
  ),
  GridRemoveIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridRemoveIcon,
    })),
  ),
  GridRoot: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.GridRoot })),
  ),
  GridRowCount: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridRowCount,
    })),
  ),
  GridSearchIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridSearchIcon,
    })),
  ),
  GridSelectedRowCount: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridSelectedRowCount,
    })),
  ),
  GridSeparatorIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridSeparatorIcon,
    })),
  ),
  GridTableRowsIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridTableRowsIcon,
    })),
  ),
  GridToolbarExportContainer: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridToolbarExportContainer,
    })),
  ),

  GridTripleDotsVerticalIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridTripleDotsVerticalIcon,
    })),
  ),
  GridViewHeadlineIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridViewHeadlineIcon,
    })),
  ),
  GridViewStreamIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridViewStreamIcon,
    })),
  ),
}

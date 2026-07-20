import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import {
  assembleLocString,
  getSession,
  resolveSelectedIds,
} from '@jbrowse/core/util'
import {
  DataGrid,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  useGridApiRef,
} from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import { navToBookmark } from '../utils.ts'
import EmptyState from './EmptyState.tsx'
import SelectionActions from './SelectionActions.tsx'
import {
  COMPACT_ROW_HEIGHT,
  DEFAULT_PAGE_SIZE,
  assemblyColumn,
  colorColumn,
  labelColumn,
  locationColumn,
  startLabelEditOnClick,
  useCellStyles,
} from './columns.tsx'

import type {
  GridBookmarkModel,
  IExtendedLabeledRegionModel,
} from '../model.ts'

interface BookmarkRow extends IExtendedLabeledRegionModel {
  locString: string
}

// lets us pass a context-aware empty message through DataGrid's noRowsOverlay
// slotProps
declare module '@mui/x-data-grid' {
  interface NoRowsOverlayPropsOverrides {
    message?: string
  }
}

function NoBookmarksOverlay({ message }: { message?: string }) {
  return (
    <EmptyState
      message={
        message ??
        'No bookmarks yet. Drag across a view to bookmark a region, or import from the menu.'
      }
    />
  )
}

const BookmarkGrid = observer(function BookmarkGrid({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useCellStyles()
  const apiRef = useGridApiRef()
  const { visibleBookmarks, selectedBookmarks } = model

  const session = getSession(model)
  const hiddenCount = model.bookmarks.length - visibleBookmarks.length
  const emptyMessage =
    hiddenCount > 0
      ? `${hiddenCount} bookmark${hiddenCount === 1 ? '' : 's'} hidden because ${hiddenCount === 1 ? 'its' : 'their'} assembly is not open in a view. Open a view on that assembly to see ${hiddenCount === 1 ? 'it' : 'them'}.`
      : undefined
  const rows = visibleBookmarks.map((region, index): BookmarkRow => {
    const { assemblyName, ...rest } = region
    return {
      ...region,
      id: index,
      assemblyName,
      locString: assembleLocString(rest),
      correspondingObj: region,
    }
  })

  return (
    <DataGridFlexContainer>
      <SelectionActions
        count={selectedBookmarks.length}
        color={selectedBookmarks[0]?.highlight}
        onDelete={() => {
          model.clearSelectedBookmarks()
        }}
        onRecolor={color => {
          model.updateBulkBookmarkHighlights(color)
        }}
      />
      <DataGrid
        apiRef={apiRef}
        density="compact"
        rowHeight={COMPACT_ROW_HEIGHT}
        disableRowSelectionOnClick
        hideFooterSelectedRowCount
        onCellClick={startLabelEditOnClick(apiRef)}
        hideFooterPagination={rows.length <= DEFAULT_PAGE_SIZE}
        slots={{ noRowsOverlay: NoBookmarksOverlay }}
        slotProps={{ noRowsOverlay: { message: emptyMessage } }}
        rows={rows}
        columns={[
          { ...GRID_CHECKBOX_SELECTION_COL_DEF, width: 50 },
          locationColumn<BookmarkRow>(classes.cell, 'Bookmark link', row => {
            void navToBookmark(
              row.locString,
              row.assemblyName,
              session.views,
              model,
            )
          }),
          labelColumn<BookmarkRow>(classes.cell),
          ...assemblyColumn<BookmarkRow>(rows.map(row => row.assemblyName)),
          colorColumn<BookmarkRow>(
            'highlight',
            row => row.highlight,
            (row, color) => {
              model.updateBookmarkHighlight(row, color)
            },
          ),
        ]}
        processRowUpdate={row => {
          const target = rows[row.id]!
          model.updateBookmarkLabel(target, row.label)
          return row
        }}
        onProcessRowUpdateError={e => {
          session.notifyError(`${e}`, e)
        }}
        checkboxSelection
        onRowSelectionModelChange={newRowSelectionModel => {
          if (visibleBookmarks.length > 0) {
            const ids = resolveSelectedIds(
              newRowSelectionModel,
              rows.map(r => r.id),
            )
            model.setSelectedBookmarks(
              [...ids].map(value => ({
                ...rows[value as number]!,
              })),
            )
          }
        }}
        rowSelectionModel={{
          type: 'include',
          ids: new Set(selectedBookmarks.map(r => r.id)),
        }}
      />
    </DataGridFlexContainer>
  )
})

export default BookmarkGrid

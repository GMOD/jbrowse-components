import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { assembleLocString, getSession } from '@jbrowse/core/util'
import {
  DataGrid,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  useGridApiRef,
} from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import EmptyState from './EmptyState.tsx'
import SelectionActions from './SelectionActions.tsx'
import {
  COMPACT_ROW_HEIGHT,
  assemblyColumn,
  colorColumn,
  labelColumn,
  locationColumn,
  startLabelEditOnClick,
  useCellStyles,
} from './columns.tsx'
import { navToBookmark } from '../utils.ts'

import type { GridBookmarkModel, IExtendedLabeledRegionModel } from '../model.ts'

interface BookmarkRow extends IExtendedLabeledRegionModel {
  locString: string
}

// MUI DataGrid default page size for pagination; hide the footer pager when
// the row count fits in a single page
const DEFAULT_PAGE_SIZE = 100

function NoBookmarksOverlay() {
  return (
    <EmptyState message="No bookmarks yet. Drag across a view to bookmark a region, or import from the menu." />
  )
}

const BookmarkGrid = observer(function BookmarkGrid({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useCellStyles()
  const apiRef = useGridApiRef()
  const {
    bookmarks,
    bookmarksWithValidAssemblies,
    selectedAssemblies,
    selectedBookmarks,
  } = model

  const session = getSession(model)
  const selectedSet = new Set(selectedAssemblies)
  const rows = bookmarks
    .filter(r => selectedSet.has(r.assemblyName))
    .map((region, index): BookmarkRow => {
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
          if (bookmarksWithValidAssemblies.length > 0) {
            model.setSelectedBookmarks(
              [...newRowSelectionModel.ids].map(value => ({
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

import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import {
  assembleLocString,
  getSession,
  resolveSelectedIds,
} from '@jbrowse/core/util'
import { getHighlightColor } from '@jbrowse/core/util/highlights'
import { useTheme } from '@mui/material'
import {
  DataGrid,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  useGridApiRef,
} from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import { navToHighlight } from '../utils.ts'
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

import type { GridBookmarkModel } from '../model.ts'
import type { HighlightType } from '@jbrowse/core/util/highlights'

interface Row {
  id: string
  highlight: HighlightType
  locString: string
  label: string
  assemblyName: string
}

// lets us pass a context-aware empty message through DataGrid's noRowsOverlay
// slotProps
declare module '@mui/x-data-grid' {
  interface NoRowsOverlayPropsOverrides {
    message?: string
  }
}

function NoHighlightsOverlay({ message }: { message?: string }) {
  return (
    <EmptyState
      message={
        message ??
        'No highlights yet. Drag across a view to highlight a region, or import from the menu.'
      }
    />
  )
}

function hiddenMessage(count: number) {
  return count === 1
    ? '1 highlight hidden because its assembly is not open in a view. Open a view on that assembly to see it.'
    : `${count} highlights hidden because their assembly is not open in a view. Open a view on that assembly to see them.`
}

const HighlightGrid = observer(function HighlightGrid({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useCellStyles()
  const apiRef = useGridApiRef()
  const theme = useTheme()
  const session = getSession(model)
  const hiddenCount = session.highlights.length - model.rows.length
  const rows = model.rows.map(({ key, highlight }): Row => {
    const { assemblyName, refName, start, end, label } = highlight
    return {
      id: key,
      highlight,
      locString: assembleLocString({ refName, start, end }),
      label: label ?? '',
      assemblyName,
    }
  })
  const bandColor = (h: { color?: string }) =>
    getHighlightColor(h, theme).toRgbString()
  const [firstSelected] = model.selectedHighlights

  return (
    <DataGridFlexContainer>
      <SelectionActions
        count={model.selectedHighlights.length}
        color={bandColor(firstSelected ?? {})}
        onDelete={() => {
          model.removeSelectedHighlights()
        }}
        onRecolor={color => {
          model.recolorSelectedHighlights(color)
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
        slots={{ noRowsOverlay: NoHighlightsOverlay }}
        slotProps={{
          noRowsOverlay: {
            message: hiddenCount > 0 ? hiddenMessage(hiddenCount) : undefined,
          },
        }}
        rows={rows}
        columns={[
          { ...GRID_CHECKBOX_SELECTION_COL_DEF, width: 50 },
          locationColumn<Row>(classes.cell, 'Location', row => {
            void navToHighlight(row.highlight, model)
          }),
          labelColumn<Row>(classes.cell),
          ...assemblyColumn<Row>(rows.map(r => r.assemblyName)),
          colorColumn<Row>(
            'color',
            row => bandColor(row.highlight),
            (row, color) => {
              session.updateHighlight(row.highlight, { color })
            },
          ),
        ]}
        checkboxSelection
        onRowSelectionModelChange={selectionModel => {
          model.setSelectedKeys(
            new Set(
              [
                ...resolveSelectedIds(
                  selectionModel,
                  rows.map(r => r.id),
                ),
              ].map(String),
            ),
          )
        }}
        rowSelectionModel={{ type: 'include', ids: model.selectedKeys }}
        processRowUpdate={row => {
          session.updateHighlight(row.highlight, {
            label: row.label || undefined,
          })
          return row
        }}
        onProcessRowUpdateError={e => {
          session.notifyError(`${e}`, e)
        }}
      />
    </DataGridFlexContainer>
  )
})

export default HighlightGrid

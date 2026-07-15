import { useState } from 'react'

import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import {
  assembleLocString,
  getSession,
  resolveSelectedIds,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
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
  DEFAULT_PAGE_SIZE,
  assemblyColumn,
  colorColumn,
  labelColumn,
  locationColumn,
  startLabelEditOnClick,
  useCellStyles,
} from './columns.tsx'

import type { GridBookmarkModel, IExtendedLGV } from '../model.ts'
import type { GridRowId } from '@mui/x-data-grid'

function NoHighlightsOverlay() {
  return (
    <EmptyState message="No highlights yet. Highlights added to a view appear here." />
  )
}

type Highlight = IExtendedLGV['highlight'][number]

interface HighlightRow {
  id: string
  view: IExtendedLGV
  highlight: Highlight
  locString: string
  label: string
  assemblyName: string
  color?: string
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
  const [selectedIds, setSelectedIds] = useState(() => new Set<GridRowId>())
  const { assembliesInViews } = model
  const rows = session.views
    .filter(
      (v): v is IExtendedLGV =>
        v.type === 'LinearGenomeView' &&
        Array.isArray((v as IExtendedLGV).highlight),
    )
    .flatMap(view =>
      view.highlight.map((highlight, hIdx): HighlightRow => {
        const { assemblyName = '', refName, start, end } = highlight
        return {
          id: `${view.id}-${hIdx}`,
          view,
          highlight,
          locString: assembleLocString({ refName, start, end }),
          label: highlight.label ?? '',
          assemblyName,
          color: highlight.color,
        }
      }),
    )
    // only show highlights whose assembly is open in a view. highlights
    // without an assemblyName (pre-init session JSON) always pass through so
    // they're not hidden by the filter
    .filter(r => !r.assemblyName || assembliesInViews.has(r.assemblyName))

  return (
    <DataGridFlexContainer>
      <SelectionActions
        count={selectedIds.size}
        color={rows.find(r => selectedIds.has(r.id))?.color}
        onDelete={() => {
          const selectedRows = rows.filter(r => selectedIds.has(r.id))
          for (const r of selectedRows) {
            r.view.removeHighlight(r.highlight)
          }
          setSelectedIds(new Set())
        }}
        onRecolor={color => {
          const selectedRows = rows.filter(r => selectedIds.has(r.id))
          for (const r of selectedRows) {
            r.view.updateHighlight(r.highlight, { color })
          }
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
        rows={rows}
        columns={[
          { ...GRID_CHECKBOX_SELECTION_COL_DEF, width: 50 },
          locationColumn<HighlightRow>(classes.cell, 'Location', row => {
            row.view.navTo(
              {
                refName: row.highlight.refName,
                start: row.highlight.start,
                end: row.highlight.end,
                assemblyName: row.highlight.assemblyName,
              },
              // slightly zoom out so the highlighted region has context on
              // either side
              0.2,
            )
          }),
          labelColumn<HighlightRow>(classes.cell),
          ...assemblyColumn<HighlightRow>(rows.map(r => r.assemblyName)),
          colorColumn<HighlightRow>(
            'color',
            row => row.color ?? theme.palette.highlight.main,
            (row, color) => {
              row.view.updateHighlight(row.highlight, { color })
            },
          ),
        ]}
        checkboxSelection
        onRowSelectionModelChange={selectionModel => {
          setSelectedIds(
            resolveSelectedIds(
              selectionModel,
              rows.map(r => r.id),
            ),
          )
        }}
        rowSelectionModel={{ type: 'include', ids: selectedIds }}
        processRowUpdate={row => {
          row.view.updateHighlight(row.highlight, {
            label: row.label,
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

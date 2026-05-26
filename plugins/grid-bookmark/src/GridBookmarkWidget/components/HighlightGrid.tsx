import { useState } from 'react'

import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import {
  assembleLocString,
  getSession,
  measureGridWidth,
  measureText,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Delete from '@mui/icons-material/Delete'
import { IconButton, Link, Tooltip, useTheme } from '@mui/material'
import { DataGrid, GRID_CHECKBOX_SELECTION_COL_DEF } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { GridBookmarkModel, IExtendedLGV } from '../model.ts'
import type { GridRowId } from '@mui/x-data-grid'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

const HighlightGrid = observer(function HighlightGrid({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const session = getSession(model)
  const [selectedIds, setSelectedIds] = useState(new Set<GridRowId>())
  const selectedSet = new Set(model.selectedAssemblies)
  const rows = session.views
    .filter(
      (v): v is IExtendedLGV =>
        v.type === 'LinearGenomeView' &&
        Array.isArray((v as IExtendedLGV).highlight),
    )
    .flatMap(view =>
      view.highlight.map((highlight, hIdx) => {
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
    // honor the AssemblySelector in the widget header. highlights without an
    // assemblyName (pre-init session JSON) always pass through so they're not
    // hidden by the filter
    .filter(r => !r.assemblyName || selectedSet.has(r.assemblyName))

  return rows.length ? (
    <DataGridFlexContainer>
      {selectedIds.size > 0 ? (
        <Tooltip title={`Delete ${selectedIds.size} selected highlight(s)`}>
          <IconButton
            size="small"
            sx={{ ml: 1 }}
            onClick={() => {
              for (const r of rows.filter(r => selectedIds.has(r.id))) {
                r.view.removeHighlight(r.highlight)
              }
              setSelectedIds(new Set())
            }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
      <DataGrid
        density="compact"
        disableRowSelectionOnClick
        hideFooterSelectedRowCount
        hideFooterPagination={rows.length <= 100}
        rows={rows}
        columns={[
          {
            ...GRID_CHECKBOX_SELECTION_COL_DEF,
            width: 50,
          },
          {
            field: 'locString',
            headerName: 'Location',
            width: Math.max(
              measureText('Location', 12) + 30,
              measureGridWidth(rows.map(r => r.locString)),
            ),
            renderCell: ({ value, row }) => (
              <Link
                className={classes.cell}
                href="#"
                onClick={event => {
                  event.preventDefault()
                  row.view.navTo(
                    {
                      refName: row.highlight.refName,
                      start: row.highlight.start,
                      end: row.highlight.end,
                      assemblyName: row.highlight.assemblyName,
                    },
                    // slightly zoom out so the highlighted region has
                    // context on either side
                    0.2,
                  )
                }}
              >
                {value}
              </Link>
            ),
          },
          {
            field: 'label',
            headerName: 'Label',
            editable: true,
            width: Math.max(
              measureText('Label', 12) + 30,
              measureGridWidth(rows.map(r => r.label)),
            ),
          },
          {
            field: 'assemblyName',
            headerName: 'Assembly',
            width: Math.max(
              measureText('Assembly', 12) + 30,
              measureGridWidth(rows.map(r => r.assemblyName)),
            ),
          },
          {
            field: 'color',
            headerName: 'Color',
            width: 100,
            renderCell: ({ value, row }) => (
              <PopoverPicker
                color={value ?? theme.palette.highlight.main}
                onChange={newColor => {
                  row.view.updateHighlight(row.highlight, { color: newColor })
                }}
              />
            ),
          },
          {
            field: 'actions',
            headerName: '',
            width: 50,
            sortable: false,
            filterable: false,
            renderCell: ({ row }) => (
              <Tooltip title="Remove highlight">
                <IconButton
                  size="small"
                  onClick={() => {
                    row.view.removeHighlight(row.highlight)
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            ),
          },
        ]}
        checkboxSelection
        onRowSelectionModelChange={({ ids }) => {
          setSelectedIds(ids)
        }}
        rowSelectionModel={{ type: 'include', ids: selectedIds }}
        processRowUpdate={row => {
          row.view.updateHighlight(row.highlight, {
            label: row.label || undefined,
          })
          return row
        }}
        onProcessRowUpdateError={e => {
          session.notifyError(`${e}`, e)
        }}
      />
    </DataGridFlexContainer>
  ) : null
})

export default HighlightGrid

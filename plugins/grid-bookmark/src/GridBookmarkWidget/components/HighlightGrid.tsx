import { ActionLink } from '@jbrowse/core/ui'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { getSession, resolveSelectedIds } from '@jbrowse/core/util'
import {
  HIGHLIGHT_ALPHA,
  getHighlightColor,
} from '@jbrowse/core/util/highlights'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Stack, Typography } from '@mui/material'
import {
  DataGrid,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  useGridApiRef,
} from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import { colWidth, navToHighlight } from '../utils.ts'
import SelectionActions from './SelectionActions.tsx'

import type { GridBookmarkModel, HighlightRow } from '../model.ts'
import type { GridColDef } from '@mui/x-data-grid'

// tighter than MUI's "compact" density (36px) for the narrow sidebar; still
// clears the 24px color swatch
const ROW_HEIGHT = 32

// MUI DataGrid's default page size, so the pager shows only when it pages
const PAGE_SIZE = 100

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

const NoHighlightsOverlay = observer(function NoHighlightsOverlay() {
  return (
    <Stack
      sx={{
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary" align="center">
        No highlights yet. Drag across a view to highlight a region, or import
        from the menu.
      </Typography>
    </Stack>
  )
})

const HighlightGrid = observer(function HighlightGrid({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const apiRef = useGridApiRef()
  const theme = useStyleTheme()
  const session = getSession(model)
  const { rows, selectedHighlights } = model
  const bandColor = (h: { color?: string }) =>
    getHighlightColor(h, theme).toRgbString()
  const assemblyNames = rows.map(r => r.assemblyName)

  const columns: GridColDef<HighlightRow>[] = [
    { ...GRID_CHECKBOX_SELECTION_COL_DEF, width: 50 },
    {
      field: 'locString',
      headerName: 'Location',
      flex: 1.5,
      minWidth: 100,
      renderCell: ({ value, row }) => (
        <ActionLink
          className={classes.cell}
          title={value}
          onClick={() => {
            void navToHighlight(row.highlight, model)
          }}
        >
          {value}
        </ActionLink>
      ),
    },
    {
      field: 'label',
      headerName: 'Label',
      editable: true,
      flex: 1,
      minWidth: 80,
      renderCell: ({ value }) =>
        value ? (
          <span className={classes.cell} title={value}>
            {value}
          </span>
        ) : (
          <span style={{ color: 'grey', fontStyle: 'italic' }}>
            Add label...
          </span>
        ),
    },
    ...(new Set(assemblyNames).size > 1
      ? [
          {
            field: 'assemblyName',
            headerName: 'Assembly',
            width: colWidth('Assembly', assemblyNames),
          },
        ]
      : []),
    {
      field: 'color',
      headerName: 'Color',
      width: 50,
      renderCell: ({ row }) => (
        <PopoverPicker
          color={bandColor(row.highlight)}
          unset={!row.highlight.color}
          presetAlpha={HIGHLIGHT_ALPHA}
          onChange={color => {
            session.updateHighlight(row.highlight, { color })
          }}
        />
      ),
    },
  ]

  return (
    <DataGridFlexContainer>
      <SelectionActions
        count={selectedHighlights.length}
        color={bandColor(selectedHighlights[0] ?? {})}
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
        rowHeight={ROW_HEIGHT}
        disableRowSelectionOnClick
        hideFooterSelectedRowCount
        hideFooterPagination={rows.length <= PAGE_SIZE}
        slots={{ noRowsOverlay: NoHighlightsOverlay }}
        rows={rows}
        columns={columns}
        checkboxSelection
        onCellClick={params => {
          // MUI throws when a cell already moving between modes is told to edit
          if (params.field === 'label' && params.cellMode === 'view') {
            apiRef.current?.startCellEditMode({ id: params.id, field: 'label' })
          }
        }}
        onRowSelectionModelChange={selectionModel => {
          model.setSelectedIds(
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
        rowSelectionModel={{ type: 'include', ids: model.selectedIds }}
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

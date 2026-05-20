import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import {
  assembleLocString,
  getSession,
  measureGridWidth,
  measureText,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Delete from '@mui/icons-material/Delete'
import { IconButton, Tooltip, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { GridBookmarkModel, IExtendedLGV } from '../model.ts'

const useStyles = makeStyles()({
  swatch: {
    display: 'inline-block',
    width: 16,
    height: 16,
    borderRadius: 2,
    border: '1px solid rgba(0, 0, 0, 0.2)',
  },
  header: {
    margin: '8px 0 4px',
  },
})

const HighlightGrid = observer(function HighlightGrid({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
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
          color: highlight.color ?? '',
        }
      }),
    )

  return rows.length ? (
    <>
      <Typography variant="subtitle2" className={classes.header}>
        Highlights
      </Typography>
      <DataGridFlexContainer>
        <DataGrid
          density="compact"
          disableRowSelectionOnClick
          hideFooterSelectedRowCount
          hideFooterPagination={rows.length <= 100}
          rows={rows}
          columns={[
            {
              field: 'locString',
              headerName: 'Location',
              width: Math.max(
                measureText('Location', 12) + 30,
                measureGridWidth(rows.map(r => r.locString)),
              ),
            },
            {
              field: 'label',
              headerName: 'Label',
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
              width: 60,
              renderCell: ({ value }) =>
                value ? (
                  <span
                    className={classes.swatch}
                    style={{ background: value }}
                  />
                ) : null,
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
        />
      </DataGridFlexContainer>
    </>
  ) : null
})

export default HighlightGrid

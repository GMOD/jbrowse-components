import type { Dispatch, SetStateAction } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { TrackConfRow, TrackStatus } from './buildConfigs.ts'
import type { GridColDef } from '@mui/x-data-grid'

const useStyles = makeStyles()(theme => ({
  section: {
    marginTop: theme.spacing(2),
    height: 300,
  },
}))

interface PreviewGridRow {
  id: string
  name: string
  type: string
  index: string
  status: TrackStatus
}

function detectedTypeLabel(row: TrackConfRow) {
  if (row.status === 'ok') {
    return `${row.trackType} (${row.adapterType})`
  } else if (row.status === 'unsupported') {
    return 'Unsupported file type'
  } else {
    return 'Unrecognized file type'
  }
}

const TrackPreviewTable = observer(function TrackPreviewTable({
  rows,
  customNames,
  setCustomNames,
  onRemove,
}: {
  rows: TrackConfRow[]
  customNames: Record<string, string>
  setCustomNames: Dispatch<SetStateAction<Record<string, string>>>
  onRemove: (id: string) => void
}) {
  const { classes } = useStyles()
  const gridRows: PreviewGridRow[] = rows.map(row => ({
    id: row.id,
    name: customNames[row.id] ?? row.name,
    type: detectedTypeLabel(row),
    index: row.indexName ?? 'auto',
    status: row.status,
  }))

  const columns: GridColDef<PreviewGridRow>[] = [
    {
      field: 'name',
      headerName: 'Track name',
      flex: 1,
      editable: true,
    },
    {
      field: 'type',
      headerName: 'Detected type',
      flex: 1,
      renderCell: ({ row }) => (
        <Typography
          variant="body2"
          color={row.status === 'ok' ? 'text.primary' : 'error'}
        >
          {row.type}
        </Typography>
      ),
    },
    {
      field: 'index',
      headerName: 'Index',
      width: 120,
    },
    {
      field: 'actions',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: ({ row }) => (
        <IconButton
          size="small"
          aria-label="Remove track"
          onClick={() => {
            onRemove(row.id)
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      ),
    },
  ]

  return (
    <div className={classes.section}>
      <DataGrid
        rows={gridRows}
        columns={columns}
        rowHeight={30}
        columnHeaderHeight={35}
        hideFooter
        disableRowSelectionOnClick
        processRowUpdate={newRow => {
          setCustomNames(prev => ({ ...prev, [newRow.id]: newRow.name }))
          return newRow
        }}
      />
    </div>
  )
})

export default TrackPreviewTable

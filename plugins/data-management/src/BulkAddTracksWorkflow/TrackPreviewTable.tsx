import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { TrackConfRow, TrackStatus } from './buildConfigs.ts'
import type { CustomNamesState } from './customNames.ts'
import type { NamedRow } from './util.ts'
import type { GridColDef } from '@mui/x-data-grid'

const ROW_HEIGHT = 30
const HEADER_HEIGHT = 35
const MAX_HEIGHT = 300

const useStyles = makeStyles()(theme => ({
  section: {
    marginTop: theme.spacing(2),
  },
}))

interface PreviewGridRow {
  id: string
  name: string
  autoName: string
  type: string
  index: string
  status: TrackStatus
}

function detectedTypeLabel(row: TrackConfRow) {
  if (row.status === 'unknown') {
    return 'Unrecognized file type'
  }
  const type = `${row.trackType} (${row.adapterType})`
  // the type is right; what is missing is the config only the single-track form
  // collects, so say that rather than implying the format wasn't recognized
  return row.status === 'needsSetup' ? `${type} — needs setup` : type
}

// error for a row nothing could read, warning for one that was read fine but
// cannot be finished here
function statusColor(status: TrackStatus) {
  if (status === 'ok') {
    return 'text.primary'
  }
  return status === 'unknown' ? 'error' : 'warning'
}

const TrackPreviewTable = observer(function TrackPreviewTable({
  named,
  onRename,
  onRemove,
}: {
  named: NamedRow[]
  onRename: CustomNamesState['renameRow']
  onRemove: (id: string) => void
}) {
  const { classes } = useStyles()
  const gridRows: PreviewGridRow[] = named.map(({ row, name, autoName }) => ({
    id: row.id,
    name,
    autoName,
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
        <Typography variant="body2" color={statusColor(row.status)}>
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

  const height = Math.min(
    MAX_HEIGHT,
    HEADER_HEIGHT + gridRows.length * ROW_HEIGHT + 2,
  )

  return (
    <div className={classes.section} style={{ height }}>
      <DataGrid
        rows={gridRows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        columnHeaderHeight={HEADER_HEIGHT}
        hideFooter
        disableRowSelectionOnClick
        processRowUpdate={newRow => {
          const { id, name, autoName } = newRow
          onRename({ id, name, autoName })
          // an emptied cell falls back to the automatic name, which is what
          // onRename just recorded (i.e. nothing) — show the same thing
          return { ...newRow, name: name.trim() || autoName }
        }}
      />
    </div>
  )
})

export default TrackPreviewTable

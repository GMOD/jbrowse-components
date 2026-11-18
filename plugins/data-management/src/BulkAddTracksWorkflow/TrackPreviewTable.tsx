import { useState } from 'react'

import VirtualTable, { EditableTextCell } from '@jbrowse/core/ui/VirtualTable'
import { compareValues } from '@jbrowse/core/util/tableText'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { TrackConfRow, TrackStatus } from './buildConfigs.ts'
import type { CustomNamesState } from './customNames.ts'
import type { NamedRow } from './util.ts'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

const useStyles = makeStyles()(theme => ({
  section: {
    marginTop: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 300,
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  button: {
    padding: 0,
  },
}))

interface PreviewRow {
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
  return row.status === 'needsSetup'
    ? `${row.trackType} (needs setup)`
    : row.status === 'needsIndex'
      ? `${row.trackType} (needs index)`
      : row.trackType
}

// error for a row nothing could read, warning for one that was read fine but
// cannot be finished here
function statusColor(status: TrackStatus) {
  if (status === 'ok') {
    return 'text.primary'
  }
  return status === 'unknown' ? 'error' : 'warning'
}

const sortKeys: Record<string, (row: PreviewRow) => unknown> = {
  name: row => row.name,
  type: row => row.type,
  index: row => row.index,
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
  const [sortField, setSortField] = useState('')
  const [sortAscending, setSortAscending] = useState(true)
  const rows: PreviewRow[] = named.map(({ row, name, autoName }) => ({
    id: row.id,
    name,
    autoName,
    type: detectedTypeLabel(row),
    index: row.indexName ?? '',
    status: row.status,
  }))
  const sortKey = sortKeys[sortField]
  const direction = sortAscending ? 1 : -1
  const sortedRows = sortKey
    ? rows.toSorted((a, b) => compareValues(sortKey(a), sortKey(b), direction))
    : rows

  const columns: VirtualTableColumn<PreviewRow>[] = [
    {
      id: 'name',
      header: 'Track name',
      title: row => row.name,
      cell: row => (
        <div className={classes.nameCell}>
          <div className={classes.name}>
            <EditableTextCell
              value={row.name}
              label={`Rename ${row.name}`}
              allowBlank
              onCommit={name => {
                onRename({ id: row.id, name, autoName: row.autoName })
              }}
            />
          </div>
          <IconButton
            size="small"
            className={classes.button}
            aria-label="Remove track"
            onClick={() => {
              onRemove(row.id)
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      title: row => row.type,
      cell: row => (
        <Typography
          component="span"
          variant="body2"
          color={statusColor(row.status)}
        >
          {row.type}
        </Typography>
      ),
    },
    ...(rows.some(row => row.index)
      ? [
          {
            id: 'index',
            header: 'Index',
            title: (row: PreviewRow) => row.index,
            cell: (row: PreviewRow) => row.index,
          },
        ]
      : []),
  ]

  return (
    <div className={classes.section}>
      <VirtualTable
        rows={sortedRows}
        columns={columns.map((col, i) => ({
          ...col,
          fill: i === columns.length - 1,
        }))}
        widths={available =>
          Object.fromEntries(
            columns.map(col => [col.id, available / columns.length]),
          )
        }
        sortField={sortField}
        sortAscending={sortAscending}
        onSort={(field, ascending) => {
          setSortField(field)
          setSortAscending(ascending)
        }}
        resetKey={JSON.stringify([sortField, sortAscending])}
        emptyMessage="No tracks"
        testId="bulk-add-preview"
      />
    </div>
  )
})

export default TrackPreviewTable

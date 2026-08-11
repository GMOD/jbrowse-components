import { useState } from 'react'

import { LabeledCheckbox } from '@jbrowse/core/ui'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { measureGridWidth } from '@jbrowse/core/util'
import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import DeleteOldSessionsDialog from './DeleteOldSessionsDialog.tsx'
import { DeleteCell, FavoriteCell, LastUsedCell, NameCell } from './cells.tsx'
import { sessionLastUsed } from './util.ts'

import type { Row } from './cells.tsx'
import type { SessionModel } from './util.ts'

const useStyles = makeStyles()(theme => ({
  mb: {
    margin: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
}))

/**
 * The rows of the grid: the saved-session metadata the root model read out of
 * IndexedDB, in display shape. `undefined` in, `undefined` out — that is the
 * "database still opening" state, and it is deliberately not the same value as
 * an empty database (see the render below).
 */
function buildRows(
  session: SessionModel,
  showOnlyFavs: boolean,
): Row[] | undefined {
  return session.savedSessionMetadata
    ?.map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      lastUsed: sessionLastUsed(r),
      fav: r.favorite,
      current: r.id === session.id,
    }))
    .filter(f => !showOnlyFavs || f.fav)
}

// One entry per column, each deferring to a named cell in cells.tsx so this
// reads as the shape of the table rather than as four inline components.
function buildColumns(session: SessionModel, rows: Row[] | undefined) {
  return [
    {
      field: 'fav',
      headerName: 'Fav',
      width: 60,
      renderCell: ({ row }: { row: Row }) => (
        <FavoriteCell row={row} session={session} />
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      editable: true,
      width: measureGridWidth((rows ?? []).map(r => r.name)),
      renderCell: ({ row }: { row: Row }) => (
        <NameCell row={row} session={session} />
      ),
    },
    {
      field: 'lastUsed',
      headerName: 'Last used',
      renderCell: ({ row }: { row: Row }) => (
        <LastUsedCell row={row} session={session} />
      ),
    },
    {
      field: 'delete',
      headerName: 'Delete',
      width: 70,
      sortable: false,
      filterable: false,
      renderCell: ({ row }: { row: Row }) => (
        <DeleteCell row={row} session={session} />
      ),
    },
  ]
}

const SessionManager = observer(function SessionManager({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  const [deleteOldOpen, setDeleteOldOpen] = useState(false)
  const [showOnlyFavs, setShowOnlyFavs] = useLocalStorage(
    'sessionManager-showOnlyFavs',
    false,
  )
  const rows = buildRows(session, showOnlyFavs)

  return (
    <div>
      <div className={classes.mb}>
        <LabeledCheckbox
          checked={showOnlyFavs}
          onChange={val => {
            setShowOnlyFavs(val)
          }}
          label="Show favorites only?"
        />
        <Button
          variant="contained"
          disabled={!rows}
          onClick={() => {
            setDeleteOldOpen(true)
          }}
        >
          Delete old sessions...
        </Button>
      </div>
      {rows ? (
        <DataGridFlexContainer>
          <DataGrid
            disableRowSelectionOnClick
            columnHeaderHeight={35}
            rowHeight={25}
            hideFooter={rows.length < 100}
            showToolbar
            slotProps={{ toolbar: { showQuickFilter: true } }}
            rows={rows}
            columns={buildColumns(session, rows)}
            processRowUpdate={(newRow: Row, oldRow: Row) => {
              if (newRow.name !== oldRow.name) {
                void session.renameSavedSession(newRow.id, newRow.name)
              }
              return newRow
            }}
            onProcessRowUpdateError={e => {
              console.error(e)
              session.notifyError(`${e}`, e)
            }}
          />
        </DataGridFlexContainer>
      ) : (
        // undefined, not empty: the saved-session database has not finished
        // opening. An empty list renders the grid with its own "no rows" row.
        <Typography className={classes.mb}>
          Loading saved sessions...
        </Typography>
      )}
      {deleteOldOpen ? (
        <DeleteOldSessionsDialog
          session={session}
          onClose={() => {
            setDeleteOldOpen(false)
          }}
        />
      ) : null}
    </div>
  )
})

export default SessionManager

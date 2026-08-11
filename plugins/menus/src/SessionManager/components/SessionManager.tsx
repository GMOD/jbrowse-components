import { useState } from 'react'

import { LabeledCheckbox } from '@jbrowse/core/ui'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
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
  // The widget fills its drawer and the grid takes what is left below the
  // controls. Not cosmetic: MUI's DataGrid draws its horizontal scrollbar as an
  // absolutely positioned overlay at the bottom of its own box, so a grid sized
  // to its content puts that 14px bar *on top of the last row* — and z-index 60
  // wins the hit test, so the bottom session silently stops responding to
  // clicks. Given room, the bar lands below every row.
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  grid: {
    flex: 1,
    // a flex child defaults to min-height:auto, which refuses to shrink below
    // its content and would push the grid past the drawer instead of scrolling
    minHeight: 0,
  },
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
    ?.map(r => {
      const current = r.id === session.id
      return {
        id: r.id,
        name: r.name,
        label: current ? `${r.name} (current)` : r.name,
        createdAt: r.createdAt,
        lastUsed: sessionLastUsed(r),
        fav: r.favorite,
        current,
      }
    })
    .filter(f => !showOnlyFavs || f.fav)
}

/**
 * One entry per column, each deferring to a named cell in cells.tsx so this
 * reads as the shape of the table rather than as four inline components.
 *
 * Name takes the leftover width (`flex`) rather than a width measured from the
 * session names, and the three fixed columns are kept narrow enough that their
 * sum plus Name's minWidth fits a default-width drawer. `measureGridWidth`
 * hands back a *fixed* width — up to 1000px for a long session name — and any
 * total past the panel width grows the horizontal scrollbar this widget's
 * styles exist to keep off the rows (see useStyles).
 */
function buildColumns(session: SessionModel) {
  return [
    {
      field: 'fav',
      headerName: 'Fav',
      // the header of an icon column is short, and its sort arrow and column
      // menu are what push it into an ellipsis. Only sorting earns its space
      // here -- grouping the favorites is a real thing to want -- so the menu
      // goes and the header reads.
      width: 60,
      disableColumnMenu: true,
      renderCell: ({ row }: { row: Row }) => (
        <FavoriteCell row={row} session={session} />
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      editable: true,
      flex: 1,
      minWidth: 120,
      renderCell: ({ row }: { row: Row }) => (
        <NameCell row={row} session={session} />
      ),
    },
    {
      field: 'lastUsed',
      headerName: 'Last used',
      width: 100,
      renderCell: ({ row }: { row: Row }) => (
        <LastUsedCell row={row} session={session} />
      ),
    },
    {
      field: 'delete',
      headerName: 'Delete',
      // nothing to sort or filter on a column of buttons, and dropping both
      // gives the header room to say "Delete" instead of "Del..."
      width: 66,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
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
    <div className={classes.root}>
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
        <DataGridFlexContainer className={classes.grid}>
          <DataGrid
            disableRowSelectionOnClick
            columnHeaderHeight={35}
            rowHeight={25}
            hideFooter={rows.length < 100}
            showToolbar
            slotProps={{ toolbar: { showQuickFilter: true } }}
            rows={rows}
            columns={buildColumns(session)}
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
